import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import { Reflections } from "@opencanvas/shared/types";
import { BaseMessage } from "@langchain/core/messages";
import {
  createContextDocumentMessages,
  ensureStoreInConfig,
  formatArtifactContentWithTemplate,
  formatReflections,
  getModelFromConfig,
  getStringFromContent,
  isUsingO1MiniModel,
} from "../../utils.js";
import { CURRENT_ARTIFACT_PROMPT, NO_ARTIFACT_PROMPT } from "../prompts.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../state.js";
import {
  calculateCoverageConfidence,
  findNextQuestion,
} from "../../docs/session.js";
import { AnswerRecord, DocSessionState } from "../../docs/types.js";

const READY_PATTERNS = [
  /ready to (?:start|generate|draft)/i,
  /go ahead and (?:start|generate|draft)/i,
  /generate (?:the )?(?:doc|document|draft)/i,
  /we['’]?re ready/i,
];

interface ProjectUserDetails {
  project?: unknown;
  user?: unknown;
}

function toPrettyString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim() || value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function getDeterministicMessageId(message: BaseMessage): string | undefined {
  if (typeof message.id === "string" && message.id.trim()) {
    return message.id;
  }

  const kwargsId = (message as any)?.kwargs?.id;
  if (typeof kwargsId === "string" && kwargsId.trim()) {
    return kwargsId;
  }

  const additionalId = (message as any)?.additional_kwargs?.id;
  if (typeof additionalId === "string" && additionalId.trim()) {
    return additionalId;
  }

  const content = getStringFromContent(message.content);
  if (content?.trim()) {
    const suffix = content.trim().slice(-64);
    return `content:${suffix}`;
  }

  return undefined;
}

function safeParseJson<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    return undefined;
  }
}

function extractJsonSegments(raw: string): string[] {
  const results: string[] = [];
  const stack: number[] = [];
  let start = -1;

  for (let index = 0; index < raw.length; index++) {
    const char = raw[index];
    if (char === "{") {
      if (stack.length === 0) {
        start = index;
      }
      stack.push(index);
    } else if (char === "}") {
      if (stack.length) {
        stack.pop();
        if (stack.length === 0 && start !== -1) {
          results.push(raw.slice(start, index + 1));
          start = -1;
        }
      }
    }
  }

  return results;
}

function isProjectUserDetails(value: unknown): value is ProjectUserDetails {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return "project" in record || "user" in record;
}

function extractProjectUserDetails(raw: string): ProjectUserDetails | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = safeParseJson<ProjectUserDetails>(trimmed);
  if (isProjectUserDetails(direct)) {
    return direct;
  }

  for (const segment of extractJsonSegments(trimmed)) {
    const parsed = safeParseJson<ProjectUserDetails>(segment);
    if (isProjectUserDetails(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function mergeProjectUserDetails(
  session: DocSessionState,
  details: ProjectUserDetails | undefined
): DocSessionState {
  if (!details) {
    return session;
  }

  const updates: Record<string, string> = {};
  if (details.project !== undefined) {
    updates.project_details = toPrettyString(details.project);
  }
  if (details.user !== undefined) {
    updates.user_details = toPrettyString(details.user);
  }

  if (!Object.keys(updates).length) {
    return session;
  }

  const currentProject = session.dossier.project_details;
  const currentUser = session.dossier.user_details;

  const projectUnchanged =
    updates.project_details === undefined || updates.project_details === currentProject;
  const userUnchanged =
    updates.user_details === undefined || updates.user_details === currentUser;

  if (projectUnchanged && userUnchanged) {
    return session;
  }

  return {
    ...session,
    dossier: {
      ...session.dossier,
      ...updates,
    },
  };
}

function detectReadyIntent(text: string): boolean {
  if (!text.trim()) {
    return false;
  }

  return READY_PATTERNS.some((pattern) => pattern.test(text));
}

function getFieldLabel(session: DocSessionState, fieldId: string): string {
  const { definition } = session;
  const required = definition.required_fields.find((field) => field.id === fieldId);
  if (required) {
    return required.label;
  }
  const optional = definition.optional_fields.find((field) => field.id === fieldId);
  if (optional) {
    return optional.label;
  }
  return fieldId;
}

function formatAnswerSummary(session: DocSessionState): string {
  const entries = Object.entries(session.answers);
  if (!entries.length) {
    return "No answers captured yet.";
  }

  return entries
    .map(([fieldId, record]) => {
      const label = getFieldLabel(session, fieldId);
      const value = record.value.length > 320
        ? `${record.value.slice(0, 317)}...`
        : record.value;
      return `- ${label}: ${value}`;
    })
    .join("\n");
}

function processDocSessionMessages(
  session: DocSessionState,
  messages: BaseMessage[]
): DocSessionState {
  const latestHuman = [...messages].reverse().find((msg) => msg.getType() === "human");
  if (!latestHuman) {
    return session;
  }

  const messageId = getDeterministicMessageId(latestHuman);
  if (messageId && session.processedMessageIds.includes(messageId)) {
    return session;
  }

  const processedMessageIds = messageId
    ? [...session.processedMessageIds, messageId]
    : session.processedMessageIds;

  const content = getStringFromContent(latestHuman.content) ?? "";
  const trimmedContent = content.trim();

  let updatedSession: DocSessionState =
    processedMessageIds === session.processedMessageIds
      ? session
      : {
          ...session,
          processedMessageIds,
        };

  if (!trimmedContent) {
    return updatedSession;
  }

  updatedSession = mergeProjectUserDetails(
    updatedSession,
    extractProjectUserDetails(trimmedContent)
  );

  const readyIntent = detectReadyIntent(trimmedContent);

  if (updatedSession.lastAskedQuestionId) {
    const targetQuestion = updatedSession.pendingQuestions.find(
      (question) => question.id === updatedSession.lastAskedQuestionId
    );

    if (targetQuestion && !readyIntent) {
      const timestamp = Date.now();
      const updatedAnswers = { ...updatedSession.answers };

      targetQuestion.targets.forEach((targetId) => {
        if (!targetId) {
          return;
        }
        const existing = updatedAnswers[targetId];
        const timestamps = existing?.timestamps ?? [];
        const record: AnswerRecord = {
          fieldId: targetId,
          value: trimmedContent,
          source: "user",
          confidence: 0.7,
          timestamps: [...timestamps, timestamp],
        };
        updatedAnswers[targetId] = record;
      });

      const remainingQuestions = updatedSession.pendingQuestions.filter(
        (question) => question.id !== targetQuestion.id
      );
      const confidence = calculateCoverageConfidence(
        updatedSession.definition,
        updatedAnswers
      );
      const readyToGenerate =
        confidence >= 75 || remainingQuestions.length === 0;

      updatedSession = {
        ...updatedSession,
        answers: updatedAnswers,
        pendingQuestions: remainingQuestions,
        confidence,
        readyToGenerate,
        lastAskedQuestionId: undefined,
      };
    } else {
      updatedSession = {
        ...updatedSession,
        lastAskedQuestionId: undefined,
      };
    }
  }

  if (!updatedSession.readyToGenerate && readyIntent) {
    updatedSession = {
      ...updatedSession,
      readyToGenerate: true,
    };
  }

  return updatedSession;
}

function buildDocPrompt(
  session: DocSessionState,
  memories: string,
  nextQuestion?: { id: string; text: string }
): string {
  const { definition } = session;
  const requiredCount = definition.required_fields.length;
  const answeredRequiredCount = definition.required_fields.filter(
    (field) => session.answers[field.id]?.value?.trim()
  ).length;
  const missingRequired = definition.required_fields.filter(
    (field) => !session.answers[field.id]?.value?.trim()
  );
  const missingSummary = missingRequired.length
    ? `Missing required sections:\n${missingRequired
        .map((field) => `- ${field.label}: ${field.description}`)
        .join("\n")}`
    : "All required sections have at least one answer captured.";
  const answeredSummary = formatAnswerSummary(session);
  const projectDetails = session.dossier.project_details
    ? session.dossier.project_details
    : "Not provided yet.";
  const userDetails = session.dossier.user_details
    ? session.dossier.user_details
    : "Not provided yet.";
  const jsonReminder =
    !session.dossier.project_details || !session.dossier.user_details
      ? "Prompt the user to supply a JSON string with `project` and `user` keys if it has not been provided."
      : "Reference the structured JSON details when relevant.";
  const readinessGuide = session.readyToGenerate
    ? "The user has enough context to draft. If they explicitly ask, confirm readiness to begin drafting."
    : "Do NOT begin drafting yet. Continue gathering context for the document.";
  const questionGuide = nextQuestion
    ? `End your reply by asking: ${nextQuestion.text}`
    : "If the user is satisfied with the context collected, confirm whether they'd like you to begin drafting now.";

  return [
    `You are collaborating with the user to prepare a ${definition.name} (id: ${definition.id}).`,
    `Document focus: ${definition.description}`,
    `Confidence: ${session.confidence}% (${answeredRequiredCount}/${requiredCount} required sections covered).`,
    `Captured answers:\n${answeredSummary}`,
    missingSummary,
    `Project details JSON:\n${projectDetails}`,
    `User details JSON:\n${userDetails}`,
    `Assistant memories:\n${memories}`,
    jsonReminder,
    readinessGuide,
    questionGuide,
    "Keep the response concise (2-3 sentences), weave in existing details when helpful, and always finish with a clear question whenever more information is needed.",
  ].join("\n\n");
}

/**
 * Generate responses to questions. Does not generate artifacts.
 */
export const replyToGeneralInput = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const smallModel = await getModelFromConfig(config);
  const store = ensureStoreInConfig(config);
  const assistantId = config.configurable?.assistant_id;
  if (!assistantId) {
    throw new Error("`assistant_id` not found in configurable");
  }

  const memoryNamespace = ["memories", assistantId];
  const memoryKey = "reflection";
  const memories = await store.get(memoryNamespace, memoryKey);
  const memoriesAsString = memories?.value
    ? formatReflections(memories.value as Reflections)
    : "No reflections found.";

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  if (state.docsState?.active) {
    const updatedSession = processDocSessionMessages(
      state.docsState,
      state._messages as BaseMessage[]
    );
    const nextQuestion = updatedSession.readyToGenerate
      ? undefined
      : findNextQuestion(updatedSession);
    const docPrompt = buildDocPrompt(
      updatedSession,
      memoriesAsString,
      nextQuestion ? { id: nextQuestion.id, text: nextQuestion.text } : undefined
    );
    const sessionForReturn =
      nextQuestion?.id === updatedSession.lastAskedQuestionId
        ? updatedSession
        : {
            ...updatedSession,
            lastAskedQuestionId: nextQuestion?.id,
          };

    const response = await smallModel.invoke(
      [
        { role: isO1MiniModel ? "user" : "system", content: docPrompt },
        ...contextDocumentMessages,
        ...state._messages,
      ],
      { runName: "docs_conversation" }
    );

    return {
      messages: [response],
      _messages: [response],
      docsState: sessionForReturn,
    };
  }

  const generalPromptTemplate = `You are an AI assistant tasked with responding to the users question.
  
The user has generated artifacts in the past. Use the following artifacts as context when responding to the users question.

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

{currentArtifactPrompt}`;

  const formattedPrompt = generalPromptTemplate
    .replace("{reflections}", memoriesAsString)
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
          )
        : NO_ARTIFACT_PROMPT
    );

  const response = await smallModel.invoke([
    { role: isO1MiniModel ? "user" : "system", content: formattedPrompt },
    ...contextDocumentMessages,
    ...state._messages,
  ]);

  return {
    messages: [response],
    _messages: [response],
  };
};

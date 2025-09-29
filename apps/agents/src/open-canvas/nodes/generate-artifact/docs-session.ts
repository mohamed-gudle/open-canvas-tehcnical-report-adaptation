import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { getModelFromConfig, getStringFromContent } from "../../../utils.js";
import {
  DocSessionState,
  QuestionPlanItem,
  Citation,
} from "../../../docs/types.js";
import {
  getDocumentDefinition,
  loadDocumentCatalog,
  materializeQuestionPlan,
} from "../../../docs/catalog.js";
import { computeConfidence } from "../../../docs/scoring.js";
import { renderDocumentTemplate } from "../../../docs/template.js";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state.js";
import { z } from "zod";

const DOC_KEYWORDS: Array<{ type: string; phrases: string[] }> = [
  {
    type: "tech_design",
    phrases: [
      "technical design",
      "tech design",
      "design document",
      "system design",
      "architecture design",
    ],
  },
  {
    type: "prd",
    phrases: [
      "product requirements",
      "product requirement",
      "prd",
      "requirements document",
    ],
  },
  {
    type: "adr",
    phrases: [
      "architecture decision",
      "adr",
      "decision record",
    ],
  },
];

const extractionSchema = z
  .object({
    answers: z
      .array(
        z.object({
          fieldId: z.string(),
          value: z.string(),
          confidence: z.number().min(0).max(1),
        })
      )
      .describe("Any fields the user just provided information for."),
    title: z
      .string()
      .min(3)
      .max(120)
      .optional()
      .describe("Optional title for the document."),
  })
  .describe("Extracted answers from the latest user message.");

function detectDocTypeFromMessage(content: string | undefined): string | undefined {
  if (!content) return undefined;
  const normalized = content.toLowerCase();
  for (const keyword of DOC_KEYWORDS) {
    if (keyword.phrases.some((phrase) => normalized.includes(phrase))) {
      return keyword.type;
    }
  }
  if (normalized.includes("document")) {
    return "prd";
  }
  return undefined;
}

async function createSession(docType: string): Promise<DocSessionState> {
  await loadDocumentCatalog();
  const definition = await getDocumentDefinition(docType);
  const pendingQuestions = materializeQuestionPlan(definition).sort(
    (a, b) => b.priority - a.priority
  );
  return {
    active: true,
    docType: definition.id,
    definition,
    answers: {},
    dossier: {},
    pendingQuestions,
    researchPlan: [],
    citations: [],
    confidence: 0,
    readyToGenerate: false,
    template: definition.template,
    title: `${definition.name} Draft`,
    processedMessageIds: [],
  };
}

function getLatestHumanMessage(stateMessages: BaseMessage[]): BaseMessage | undefined {
  return [...stateMessages].reverse().find((message) => message.getType() === "human");
}

function getMessageId(message: BaseMessage, fallbackIndex: number): string {
  return message.id ?? `${message.getType()}-${fallbackIndex}`;
}

async function updateSessionFromMessage(
  session: DocSessionState,
  message: BaseMessage,
  messageIndex: number,
  config: LangGraphRunnableConfig
): Promise<DocSessionState> {
  const messageId = getMessageId(message, messageIndex);
  if (session.processedMessageIds.includes(messageId)) {
    return session;
  }

  let response: z.infer<typeof extractionSchema> | undefined;

  try {
    const model = (
      await getModelFromConfig(config, {
        isToolCalling: true,
        temperature: 0,
        maxTokens: 500,
      })
    )
      .withStructuredOutput(extractionSchema, {
        name: "extract_document_fields",
      })
      .withConfig({ runName: "extract_document_fields" });

    const fieldContext = session.definition.required_fields
      .concat(session.definition.optional_fields)
      .map(
        (field) =>
          `- ${field.id}: ${field.label} — ${field.description} (${field.required ? "required" : "optional"})`
      )
      .join("\n");

    const existing = Object.entries(session.dossier)
      .map(([key, value]) => `- ${key}: ${value}`)
      .join("\n");

    response = (await model.invoke([
      {
        role: "system",
        content: `You extract structured answers for the ${session.definition.name}.
Here are the fields you can populate:
${fieldContext}

Existing dossier values:
${existing || "(none)"}

If the latest user reply does not add new information for a field, return an empty list.
Do not infer beyond what the user states.`,
      },
      {
        role: "user",
        content:
          typeof message.content === "string"
            ? message.content
            : message.content
                .map((part) => ("text" in part ? part.text : ""))
                .join("\n"),
      },
    ])) as z.infer<typeof extractionSchema>;
  } catch (error) {
    console.error("docs-session: failed to extract answers", error);
  }

  const updatedAnswers = { ...session.answers };
  const updatedDossier = { ...session.dossier };
  let title = session.title;

  if (response) {
    for (const answer of response.answers) {
      if (!answer.value?.trim()) continue;
      const timestamp = Date.now();
      updatedAnswers[answer.fieldId] = {
        fieldId: answer.fieldId,
        value: answer.value.trim(),
        source: "user",
        confidence: answer.confidence,
        timestamps: [
          ...(session.answers[answer.fieldId]?.timestamps ?? []),
          timestamp,
        ],
      };
      updatedDossier[answer.fieldId] = answer.value.trim();
    }

    if (response.title) {
      title = response.title;
    }
  }

  const processedMessageIds = [...session.processedMessageIds, messageId];

  const filteredQuestions = session.pendingQuestions.filter((question) => {
    return !question.targets.every((target) =>
      Boolean(updatedDossier[target]?.trim())
    );
  });

  return {
    ...session,
    answers: updatedAnswers,
    dossier: updatedDossier,
    pendingQuestions: filteredQuestions.sort((a, b) => b.priority - a.priority),
    processedMessageIds,
    title,
    lastAskedQuestionId: undefined,
  };
}

function progressSummary(session: DocSessionState): string {
  const requiredIds = session.definition.required_fields.map((field) => field.id);
  const filled = requiredIds.filter((id) => Boolean(session.dossier[id]?.trim())).length;
  const total = requiredIds.length || 1;
  return `${filled}/${total} required fields captured`;
}

function formatQuestionMessage(session: DocSessionState, question: QuestionPlanItem): AIMessage {
  const report = computeConfidence(session.definition, session.dossier, session.citations);
  const missing = report.missingRequired
    .map((field) => `- ${field.label}`)
    .join("\n");
  const reminder = missing ? `Remaining critical items:\n${missing}\n` : "";
  const body = `Progress: ${progressSummary(session)}. Confidence ${Math.round(
    report.overall * 100
  )}%\n${reminder}${question.text}`;
  return new AIMessage({ content: body });
}

function buildArtifactFromTemplate(
  templateName: string,
  session: DocSessionState,
  citations: Citation[]
): Promise<string> {
  return renderDocumentTemplate(templateName, {
    definition: session.definition,
    dossier: session.dossier,
    citations,
    title: session.title,
  });
}

function createArtifactMarkdown(content: string, title: string): ArtifactV3 {
  return {
    currentIndex: 1,
    contents: [
      {
        index: 1,
        type: "text" as const,
        title,
        fullMarkdown: content,
      },
    ],
  };
}

interface DocSessionOutcome extends OpenCanvasGraphReturnType {
  skipFollowup?: boolean;
}

export async function maybeHandleDocSession(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<DocSessionOutcome | undefined> {
  const messages = state._messages as BaseMessage[];
  const latestHuman = getLatestHumanMessage(messages);
  const latestContent = latestHuman
    ? getStringFromContent(latestHuman.content)
    : undefined;

  let session: DocSessionState | undefined = state.docsState as DocSessionState | undefined;

  const docTypeFromMessage = detectDocTypeFromMessage(latestContent);

  if (!session && !docTypeFromMessage) {
    return undefined;
  }

  if (!session && docTypeFromMessage) {
    session = await createSession(docTypeFromMessage);
  }

  if (!session) {
    return undefined;
  }

  if (latestHuman) {
    const messageIndex = messages.findIndex((msg) => msg === latestHuman);
    session = await updateSessionFromMessage(session, latestHuman, messageIndex, config);
  }

  const confidenceReport = computeConfidence(
    session.definition,
    session.dossier,
    session.citations
  );
  const ready = confidenceReport.overall >= 0.75 && confidenceReport.missingRequired.length === 0;
  session = {
    ...session,
    confidence: confidenceReport.overall,
    readyToGenerate: ready,
  };

  if (!session.readyToGenerate) {
    const nextQuestion = session.pendingQuestions[0];
    if (!nextQuestion) {
      return {
        docsState: session,
        skipFollowup: true,
      };
    }
    if (session.lastAskedQuestionId === nextQuestion.id) {
      return {
        docsState: session,
        skipFollowup: true,
      };
    }
    const questionMessage = formatQuestionMessage(session, nextQuestion);
    session.lastAskedQuestionId = nextQuestion.id;
    return {
      docsState: session,
      messages: [questionMessage],
      _messages: [questionMessage],
      skipFollowup: true,
    };
  }

  const markdown = await buildArtifactFromTemplate(session.template, session, session.citations);
  const artifact = createArtifactMarkdown(markdown, session.title);

  return {
    artifact,
    docsState: undefined,
    skipFollowup: undefined,
  };
}

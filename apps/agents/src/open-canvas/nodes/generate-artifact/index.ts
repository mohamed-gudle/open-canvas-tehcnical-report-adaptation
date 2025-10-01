import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  isUsingO1MiniModel,
  optionallyGetSystemPromptFromConfig,
} from "../../../utils.js";
import { ArtifactV3 } from "@opencanvas/shared/types";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  OpenCanvasGraphAnnotation,
  OpenCanvasGraphReturnType,
} from "../../state.js";
import { ARTIFACT_TOOL_SCHEMA } from "./schemas.js";
import { createArtifactContent, formatNewArtifactPrompt } from "./utils.js";
import { z } from "zod";
import { BaseMessage } from "@langchain/core/messages";
import { DocSessionState, DocumentDefinition } from "../../../docs/types.js";
import { resolveDocumentDefinition } from "../../../docs/intent.js";

function buildDocumentGuidance(definition: DocumentDefinition): string {
  const parts: string[] = [
    `You are drafting a ${definition.name} (id: ${definition.id}). Write a complete, professional markdown document tailored to the user's context.`,
  ];

  if (definition.prerequisites?.trim()) {
    parts.push(
      `Assume you have access to the following prerequisite materials:
${definition.prerequisites.trim()}`
    );
  }

  if (definition.template_markdown?.trim()) {
    parts.push(
      `Follow this template structure. Replace placeholders with specific, well-reasoned content. If information is unavailable, add a short TODO note instead of leaving blanks:
${definition.template_markdown.trim()}`
    );
  } else {
    const requiredSections = definition.required_fields
      .map((field) => `- ${field.label}: ${field.description}`)
      .join("\n");
    const optionalSections = definition.optional_fields
      .map((field) => `- ${field.label}: ${field.description}`)
      .join("\n");
    const fallbackSections = [
      `Required sections:\n${requiredSections}`,
      optionalSections ? `Optional sections:\n${optionalSections}` : undefined,
    ]
      .filter(Boolean)
      .join("\n\n");
    parts.push(
      `Ensure the document includes at least the following sections with meaningful detail:
${fallbackSections}`
    );
  }

  parts.push(
    "Keep the tone formal and informative. Do not include meta commentary or describe the template itself—only output the final document.",
  );

  return parts.join("\n\n");
}

function buildDocSessionContext(session: DocSessionState): string | undefined {
  if (!session.active) {
    return undefined;
  }

  const { definition } = session;
  const getFieldLabel = (fieldId: string): string => {
    const required = definition.required_fields.find((field) => field.id === fieldId);
    if (required) return required.label;
    const optional = definition.optional_fields.find((field) => field.id === fieldId);
    return optional ? optional.label : fieldId;
  };

  const answerEntries = Object.entries(session.answers);
  const answerSummary = answerEntries.length
    ? answerEntries
        .map(([fieldId, record]) => `- ${getFieldLabel(fieldId)}: ${record.value}`)
        .join("\n")
    : "No structured answers were captured before drafting.";

  const dossierEntries = Object.entries(session.dossier ?? {});
  const dossierSummary = dossierEntries.length
    ? dossierEntries
        .map(([key, value]) => `- ${key}: ${value}`)
        .join("\n")
    : "No additional project or user metadata was provided.";

  return [
    `Context collected during planning for the ${definition.name}:`,
    `<doc-answers>\n${answerSummary}\n</doc-answers>`,
    `Additional details:\n<doc-dossier>\n${dossierSummary}\n</doc-dossier>`,
    `Confidence estimate before drafting: ${session.confidence}%.`,
  ].join("\n\n");
}

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const documentDefinition = await resolveDocumentDefinition({
    config,
    messages: state._messages as BaseMessage[],
  });
  const documentGuidance = documentDefinition
    ? buildDocumentGuidance(documentDefinition)
    : undefined;
  const docSessionContext = state.docsState
    ? buildDocSessionContext(state.docsState)
    : undefined;

  const { modelName } = getModelConfig(config, {
    isToolCalling: true,
  });
  const smallModel = await getModelFromConfig(config, {
    temperature: 0.5,
    isToolCalling: true,
  });

  const modelWithArtifactTool = smallModel.bindTools(
    [
      {
        name: "generate_artifact",
        description: ARTIFACT_TOOL_SCHEMA.description,
        schema: ARTIFACT_TOOL_SCHEMA,
      },
    ],
    {
      tool_choice: "generate_artifact",
    }
  );

  const memoriesAsString = await getFormattedReflections(config);
  const formattedNewArtifactPrompt = formatNewArtifactPrompt(
    memoriesAsString,
    modelName
  );

  const userSystemPrompt = optionallyGetSystemPromptFromConfig(config);
  const systemPromptSegments = [formattedNewArtifactPrompt];
  if (documentGuidance) {
    systemPromptSegments.push(documentGuidance);
  }
  if (docSessionContext) {
    systemPromptSegments.push(docSessionContext);
  }
  const baseSystemPrompt = systemPromptSegments.join("\n\n");
  const fullSystemPrompt = userSystemPrompt
    ? `${userSystemPrompt}\n${baseSystemPrompt}`
    : baseSystemPrompt;

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const isO1MiniModel = isUsingO1MiniModel(config);
  const response = await modelWithArtifactTool.invoke(
    [
      { role: isO1MiniModel ? "user" : "system", content: fullSystemPrompt },
      ...contextDocumentMessages,
      ...state._messages,
    ],
    { runName: "generate_artifact" }
  );
  const args = response.tool_calls?.[0].args as
    | z.infer<typeof ARTIFACT_TOOL_SCHEMA>
    | undefined;
  if (!args) {
    throw new Error("No args found in response");
  }

  const newArtifactContent = createArtifactContent(args);
  const newArtifact: ArtifactV3 = {
    currentIndex: 1,
    contents: [newArtifactContent],
  };

  return {
    artifact: newArtifact,
  };
};

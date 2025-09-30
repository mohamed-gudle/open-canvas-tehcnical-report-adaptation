import {
  createContextDocumentMessages,
  getFormattedReflections,
  getModelConfig,
  getModelFromConfig,
  getStringFromContent,
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
import { getDocumentDefinition } from "../../../docs/catalog.js";
import { DocumentDefinition } from "../../../docs/types.js";

const DOC_CONFIG_KEYS = [
  "documentType",
  "document_type",
  "docType",
  "doc_type",
];

const DEFAULT_DOC_TYPE = "project_concept_note";

const DOC_KEYWORDS: Array<{ type: string; phrases: string[] }> = [
  {
    type: "project_concept_note",
    phrases: [
      "project concept note",
      "concept note",
      "concept paper",
    ],
  },
  {
    type: "feasibility_study",
    phrases: [
      "feasibility study",
      "pre-feasibility",
      "prefeasibility",
      "bankable feasibility",
      "fs draft",
    ],
  },
  {
    type: "power_purchase_agreement",
    phrases: [
      "power purchase agreement",
      "ppa",
      "ppa term sheet",
    ],
  },
  {
    type: "environmental_impact_assessment",
    phrases: [
      "environmental impact assessment",
      "eia",
      "environmental impact study",
      "eia report",
    ],
  },
  {
    type: "free_prior_informed_consent",
    phrases: [
      "free prior and informed consent",
      "free, prior and informed consent",
      "fpic",
      "local stakeholder consultation",
      "lsc documentation",
    ],
  },
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

function normalizeDocTypeCandidate(candidate: string | undefined): string | undefined {
  if (!candidate) return undefined;
  const trimmed = candidate.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  for (const keyword of DOC_KEYWORDS) {
    if (keyword.type === lower) {
      return keyword.type;
    }
    if (keyword.phrases.some((phrase) => lower.includes(phrase))) {
      return keyword.type;
    }
  }
  return trimmed;
}

function getDocTypeFromConfig(config: LangGraphRunnableConfig): string | undefined {
  const configurable = config.configurable as Record<string, unknown> | undefined;
  if (!configurable) return undefined;
  for (const key of DOC_CONFIG_KEYS) {
    const value = configurable[key];
    if (typeof value === "string" && value.trim()) {
      return normalizeDocTypeCandidate(value);
    }
  }
  return undefined;
}

function detectDocTypeFromMessages(messages: BaseMessage[]): string | undefined {
  const latestHuman = [...messages].reverse().find((msg) => msg.getType() === "human");
  if (!latestHuman) {
    return undefined;
  }
  const content = getStringFromContent(latestHuman.content);
  if (!content) {
    return undefined;
  }
  const normalized = content.toLowerCase();
  for (const keyword of DOC_KEYWORDS) {
    if (
      keyword.phrases.some((phrase) => normalized.includes(phrase)) ||
      normalized.includes(keyword.type) ||
      normalized.includes(keyword.type.replace(/_/g, " "))
    ) {
      return keyword.type;
    }
  }
  return undefined;
}

async function resolveDocumentDefinition(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<DocumentDefinition | undefined> {
  const docTypeFromConfig = getDocTypeFromConfig(config);
  if (docTypeFromConfig) {
    try {
      return await getDocumentDefinition(docTypeFromConfig);
    } catch (error) {
      console.warn(
        `docs: unable to load definition for doc type from config (${docTypeFromConfig})`,
        error
      );
    }
  }

  const docTypeFromMessages = detectDocTypeFromMessages(state._messages as BaseMessage[]);
  if (docTypeFromMessages) {
    try {
      return await getDocumentDefinition(docTypeFromMessages);
    } catch (error) {
      console.warn(
        `docs: unable to load definition inferred from conversation (${docTypeFromMessages})`,
        error
      );
    }
  }

  try {
    return await getDocumentDefinition(DEFAULT_DOC_TYPE);
  } catch (error) {
    console.warn(
      `docs: unable to load default document definition (${DEFAULT_DOC_TYPE})`,
      error
    );
  }

  return undefined;
}

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

/**
 * Generate a new artifact based on the user's query.
 */
export const generateArtifact = async (
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> => {
  const documentDefinition = await resolveDocumentDefinition(state, config);
  const documentGuidance = documentDefinition
    ? buildDocumentGuidance(documentDefinition)
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

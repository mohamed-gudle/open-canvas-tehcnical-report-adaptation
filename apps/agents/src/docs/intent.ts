import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { getStringFromContent } from "../utils.js";
import { getDocumentDefinition } from "./catalog.js";
import { DocumentDefinition } from "./types.js";

export const DOC_CONFIG_KEYS = ["documentType", "document_type", "docType", "doc_type"] as const;

export const DEFAULT_DOC_TYPE = "project_concept_note";

export const DOC_KEYWORDS: Array<{ type: string; phrases: string[] }> = [
  {
    type: "project_concept_note",
    phrases: ["project concept note", "concept note", "concept paper"],
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
    phrases: ["power purchase agreement", "ppa", "ppa term sheet"],
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
    phrases: ["architecture decision", "adr", "decision record"],
  },
];

export function normalizeDocTypeCandidate(candidate: string | undefined): string | undefined {
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

export function getDocTypeFromConfig(
  config: LangGraphRunnableConfig
): string | undefined {
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

export function detectDocTypeFromMessages(
  messages: BaseMessage[] | undefined
): string | undefined {
  if (!messages?.length) return undefined;
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

interface ResolveDocumentDefinitionParams {
  config: LangGraphRunnableConfig;
  messages?: BaseMessage[];
  fallbackToDefault?: boolean;
}

export async function resolveDocumentDefinition({
  config,
  messages,
  fallbackToDefault = true,
}: ResolveDocumentDefinitionParams): Promise<DocumentDefinition | undefined> {
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

  const docTypeFromMessages = detectDocTypeFromMessages(messages);
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

  if (!fallbackToDefault) {
    return undefined;
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

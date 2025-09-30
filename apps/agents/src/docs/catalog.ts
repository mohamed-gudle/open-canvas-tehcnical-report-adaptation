import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import YAML from "yaml";
import {
  DocumentDefinition,
  RequirementSpec,
  QuestionPlanItem,
  QuestionSpec,
  ResearchPlanItem,
} from "./types.js";

interface RawRequirement {
  id: string;
  label: string;
  description: string;
  weight?: number;
}

interface RawQuestion {
  id: string;
  text: string;
  targets: string[];
}

interface RawResearchPrompt {
  query: string;
  applies_to: string[];
}

interface RawDocumentDefinition {
  id: string;
  name: string;
  description: string;
  stage_hint?: string;
  template: string;
  pre_requisites_documents?: string;
  document_template?: string;
  required_fields: RawRequirement[];
  optional_fields?: RawRequirement[];
  diagnostic_questions: RawQuestion[];
  research_prompts?: RawResearchPrompt[];
}

interface DocCatalogRaw {
  doc_types: RawDocumentDefinition[];
}

let cachedCatalog: Map<string, DocumentDefinition> | undefined;

function resolveCatalogPath(): string {
  const candidatePaths = new Set<string>();

  candidatePaths.add(path.resolve(process.cwd(), "resources/doc_types.yml"));

  const cwd = process.cwd();
  if (!cwd.endsWith(`${path.sep}apps${path.sep}agents`)) {
    candidatePaths.add(
      path.resolve(process.cwd(), "apps/agents/resources/doc_types.yml")
    );
  }

  for (const candidate of candidatePaths) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    "Unable to locate doc_types.yml. Checked: " + Array.from(candidatePaths).join(", ")
  );
}

const catalogPath = resolveCatalogPath();

function normalizeRequirement(
  input: RawRequirement,
  required: boolean
): RequirementSpec {
  return {
    id: input.id,
    label: input.label,
    description: input.description,
    weight: input.weight ?? 1,
    required,
  };
}

function normalizeQuestion(input: RawQuestion): QuestionSpec {
  return {
    id: input.id,
    text: input.text,
    targets: input.targets,
  };
}

export type DocumentOption = Pick<
  DocumentDefinition,
  "id" | "name" | "description" | "stage_hint"
>;

export async function loadDocumentCatalog(): Promise<Map<string, DocumentDefinition>> {
  if (cachedCatalog) return cachedCatalog;
  const rawContents = await readFile(catalogPath, "utf-8");
  const parsed = YAML.parse(rawContents) as DocCatalogRaw;
  if (!parsed || !Array.isArray(parsed.doc_types)) {
    throw new Error("doc_types.yml is missing `doc_types` array");
  }

  const entries = parsed.doc_types.map((doc) => {
    const required = doc.required_fields?.map((field) =>
      normalizeRequirement(field, true)
    );
    const optional = doc.optional_fields?.map((field) =>
      normalizeRequirement(field, false)
    ) ?? [];

    const questions = doc.diagnostic_questions?.map(normalizeQuestion) ?? [];

    const definition: DocumentDefinition = {
      id: doc.id,
      name: doc.name,
      description: doc.description,
      stage_hint: doc.stage_hint,
      template: doc.template,
      template_markdown: doc.document_template,
      prerequisites: doc.pre_requisites_documents,
      required_fields: required,
      optional_fields: optional,
      diagnostic_questions: questions,
      research_prompts: doc.research_prompts?.map((item) => ({
        query: item.query,
        applies_to: item.applies_to,
      })),
    };

    return [definition.id, definition] as const;
  });

  cachedCatalog = new Map(entries);
  return cachedCatalog;
}

export async function getDocumentDefinition(
  docType: string
): Promise<DocumentDefinition> {
  const catalog = await loadDocumentCatalog();
  const definition = catalog.get(docType);
  if (!definition) {
    const available = Array.from(catalog.keys()).join(", ");
    throw new Error(`Unknown doc type: ${docType}. Available: ${available}`);
  }
  return definition;
}

export async function listDocumentOptions(): Promise<DocumentOption[]> {
  const catalog = await loadDocumentCatalog();
  return Array.from(catalog.values()).map((definition) => ({
    id: definition.id,
    name: definition.name,
    description: definition.description,
    stage_hint: definition.stage_hint,
  }));
}

export function materializeQuestionPlan(
  definition: DocumentDefinition
): QuestionPlanItem[] {
  const coverageWeights = new Map<string, number>();
  definition.required_fields.forEach((field) => {
    coverageWeights.set(field.id, field.weight ?? 1);
  });
  definition.optional_fields.forEach((field) => {
    coverageWeights.set(field.id, field.weight ?? 0.5);
  });

  return definition.diagnostic_questions.map((question, index) => {
    const priority = question.targets.reduce((acc, fieldId) => {
      return acc + (coverageWeights.get(fieldId) ?? 0.5);
    }, 0);
    return {
      id: question.id,
      text: question.text,
      targets: question.targets,
      priority: priority + (1 / (index + 1)),
    };
  });
}

export function materializeResearchPlan(
  definition: DocumentDefinition
): ResearchPlanItem[] {
  if (!definition.research_prompts) return [];
  return definition.research_prompts.map((item, index) => ({
    id: `${definition.id}:research:${index}`,
    query: item.query,
    appliesTo: item.applies_to,
  }));
}

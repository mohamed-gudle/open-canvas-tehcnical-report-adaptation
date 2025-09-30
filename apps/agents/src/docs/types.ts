export type AnswerSource = "user" | "research" | "assumption";

export interface RequirementSpec {
  id: string;
  label: string;
  description: string;
  weight?: number;
  required: boolean;
}

export interface QuestionSpec {
  id: string;
  text: string;
  targets: string[];
}

export interface ResearchPromptSpec {
  query: string;
  applies_to: string[];
}

export interface DocumentDefinition {
  id: string;
  name: string;
  description: string;
  stage_hint?: string;
  template: string;
  template_markdown?: string;
  prerequisites?: string;
  required_fields: RequirementSpec[];
  optional_fields: RequirementSpec[];
  diagnostic_questions: QuestionSpec[];
  research_prompts?: ResearchPromptSpec[];
}

export interface AnswerRecord {
  fieldId: string;
  value: string;
  source: AnswerSource;
  confidence: number;
  timestamps: number[];
}

export interface Citation {
  id: string;
  label: string;
  url: string;
  note: string;
  appliesTo: string[];
}

export interface QuestionPlanItem {
  id: string;
  text: string;
  targets: string[];
  priority: number;
}

export interface ResearchPlanItem {
  id: string;
  query: string;
  appliesTo: string[];
}

export interface DocSessionState {
  active: boolean;
  docType: string;
  definition: DocumentDefinition;
  answers: Record<string, AnswerRecord>;
  dossier: Record<string, string>;
  pendingQuestions: QuestionPlanItem[];
  researchPlan: ResearchPlanItem[];
  citations: Citation[];
  confidence: number;
  readyToGenerate: boolean;
  template: string;
  title: string;
  processedMessageIds: string[];
  lastAskedQuestionId?: string;
}

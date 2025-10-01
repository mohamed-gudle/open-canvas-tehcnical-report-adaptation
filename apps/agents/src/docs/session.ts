import {
  materializeQuestionPlan,
  materializeResearchPlan,
} from "./catalog.js";
import {
  AnswerRecord,
  DocSessionState,
  DocumentDefinition,
  QuestionPlanItem,
} from "./types.js";

function sortQuestionsByPriority(questions: QuestionPlanItem[]): QuestionPlanItem[] {
  return [...questions].sort((a, b) => b.priority - a.priority);
}

export function createDocSession(definition: DocumentDefinition): DocSessionState {
  return {
    active: true,
    docType: definition.id,
    definition,
    answers: {},
    dossier: {},
    pendingQuestions: sortQuestionsByPriority(materializeQuestionPlan(definition)),
    researchPlan: materializeResearchPlan(definition),
    citations: [],
    confidence: 0,
    readyToGenerate: false,
    template: definition.template,
    title: `${definition.name} Draft`,
    processedMessageIds: [],
    lastAskedQuestionId: undefined,
    assumptionNote: undefined,
    assumedFieldIds: [],
  };
}

export function calculateCoverageConfidence(
  definition: DocumentDefinition,
  answers: Record<string, AnswerRecord>
): number {
  const requiredIds = definition.required_fields.map((field) => field.id);
  if (!requiredIds.length) {
    return 0;
  }
  const answeredCount = requiredIds.filter((fieldId) => {
    const value = answers[fieldId]?.value;
    return typeof value === "string" && value.trim().length > 0;
  }).length;
  return Math.round((answeredCount / requiredIds.length) * 100);
}

export function findNextQuestion(session: DocSessionState): QuestionPlanItem | undefined {
  return session.pendingQuestions[0];
}

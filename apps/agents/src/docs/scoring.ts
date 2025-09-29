import { Citation, DocumentDefinition, RequirementSpec } from "./types.js";

export interface ConfidenceReport {
  completeness: number;
  evidence: number;
  clarity: number;
  overall: number;
  missingRequired: RequirementSpec[];
}

const PLACEHOLDER_REGEX = /(tbd|to be determined|lorem ipsum|fill me)/i;

export function computeConfidence(
  definition: DocumentDefinition,
  dossier: Record<string, string>,
  citations: Citation[]
): ConfidenceReport {
  const required = definition.required_fields;
  const optional = definition.optional_fields ?? [];

  const totalWeight = required.reduce(
    (acc, field) => acc + (field.weight ?? 1),
    0
  );

  let coveredWeight = 0;
  const missingRequired: RequirementSpec[] = [];
  required.forEach((field) => {
    const value = dossier[field.id];
    const weight = field.weight ?? 1;
    if (value && value.trim().length > 0) {
      coveredWeight += weight;
    } else {
      missingRequired.push(field);
    }
  });

  const completeness = totalWeight === 0 ? 0 : coveredWeight / totalWeight;

  const citationsByField = new Map<string, number>();
  citations.forEach((citation) => {
    citation.appliesTo.forEach((fieldId) => {
      const count = citationsByField.get(fieldId) ?? 0;
      citationsByField.set(fieldId, count + 1);
    });
  });

  const evidenceDenominator = [...required, ...optional].filter(
    (field) => dossier[field.id]
  ).length;

  const evidence = evidenceDenominator
    ? [...required, ...optional].reduce((acc, field) => {
        if (!dossier[field.id]) return acc;
        return acc + (citationsByField.has(field.id) ? 1 : 0);
      }, 0) / evidenceDenominator
    : 0;

  const clarityDenominator = Object.keys(dossier).length || 1;
  const unclearCount = Object.values(dossier).reduce((acc, value) => {
    if (!value) return acc + 1;
    return PLACEHOLDER_REGEX.test(value) ? acc + 1 : acc;
  }, 0);
  const clarity = 1 - unclearCount / clarityDenominator;

  const overall = Number(
    (0.5 * completeness + 0.3 * evidence + 0.2 * clarity).toFixed(3)
  );

  return { completeness, evidence, clarity, overall, missingRequired };
}

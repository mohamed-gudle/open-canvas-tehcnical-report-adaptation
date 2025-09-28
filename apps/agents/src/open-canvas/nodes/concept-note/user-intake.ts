import { LangGraphRunnableConfig } from "@langchain/langgraph";
import {
  ClarifyingQuestion,
  ConceptNoteGraphReturnType,
  ConceptNoteGraphState,
  UserInputs,
} from "../../concept-note-state.js";
import { AIMessage, BaseMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

const MAX_QUESTIONS_PER_PROMPT = 4;
const MIN_DESCRIPTION_LENGTH = 80;

interface ClarityBlueprintEntry {
  field: keyof UserInputs;
  question: string;
  rationale: string;
  required: boolean;
  assumptionSuggestion?: string;
  priority: number;
  followUpNeeded: (inputs: UserInputs) => boolean;
}

const CLARITY_BLUEPRINT: ClarityBlueprintEntry[] = [
  {
    field: "title",
    question: "What working title should we use for this project or initiative?",
    rationale: "A clear title helps stakeholders quickly understand the concept note.",
    required: true,
    assumptionSuggestion: "I can suggest a working title if you'd like me to propose one.",
    priority: 1,
    followUpNeeded: inputs => !inputs.title || isGenericTitle(inputs.title),
  },
  {
    field: "description",
    question: "What challenge are we addressing and what change do you want to see?",
    rationale: "The description anchors every other section of the concept note.",
    required: true,
    assumptionSuggestion: "If it's easier, share a few bullet points and I'll shape the narrative.",
    priority: 2,
    followUpNeeded: inputs =>
      !inputs.description || inputs.description.trim().length < MIN_DESCRIPTION_LENGTH,
  },
  {
    field: "objectives",
    question: "What are the top 2–3 objectives or outcomes you want from the project?",
    rationale: "Objectives steer scope, success metrics, and stakeholder expectations.",
    required: false,
    assumptionSuggestion: "I can draft provisional objectives based on the problem we define.",
    priority: 3,
    followUpNeeded: inputs => !inputs.objectives || inputs.objectives.length === 0,
  },
  {
    field: "targetAudience",
    question: "Who are the primary stakeholders or beneficiaries we should plan this for?",
    rationale: "Audience definitions tailor messaging, tone, and success criteria.",
    required: false,
    assumptionSuggestion: "We can assume a general stakeholder audience if unspecified.",
    priority: 4,
    followUpNeeded: inputs => !inputs.targetAudience,
  },
  {
    field: "timeline",
    question: "What timeline or key milestones are you targeting?",
    rationale: "Schedule expectations influence the phasing and resourcing story.",
    required: false,
    assumptionSuggestion: "I can assume a 6–12 month rollout if you don't have a timeline yet.",
    priority: 5,
    followUpNeeded: inputs => !inputs.timeline,
  },
  {
    field: "budget",
    question: "Do you have a working budget or funding envelope in mind?",
    rationale: "Budget guidance helps shape scope and the investment narrative.",
    required: false,
    assumptionSuggestion: "We can note that budget will be confirmed during planning.",
    priority: 6,
    followUpNeeded: inputs => !inputs.budget,
  },
  {
    field: "scope",
    question: "Is there a geographic or organizational scope we should design around?",
    rationale: "Scope decisions influence compliance, partnerships, and delivery model.",
    required: false,
    assumptionSuggestion: "I'll assume a local or regional scope if nothing specific is set.",
    priority: 7,
    followUpNeeded: inputs => !inputs.scope,
  },
  {
    field: "keyActivities",
    question: "What major activities or workstreams have you considered so far?",
    rationale: "Activities help size the effort and align expectations.",
    required: false,
    assumptionSuggestion: "I can outline a typical phased delivery plan if needed.",
    priority: 8,
    followUpNeeded: inputs => !inputs.keyActivities || inputs.keyActivities.length === 0,
  },
  {
    field: "keyChallenges",
    question: "Any known risks, constraints, or sensitivities we should factor in?",
    rationale: "Calling out risks early lets us plan mitigations in the concept note.",
    required: false,
    assumptionSuggestion: "I'll highlight standard change management and resourcing risks.",
    priority: 9,
    followUpNeeded: inputs => !inputs.keyChallenges || inputs.keyChallenges.length === 0,
  },
  {
    field: "successMetrics",
    question: "How will you know this project worked? Any KPIs or signals of success?",
    rationale: "Success metrics tie objectives to measurable outcomes.",
    required: false,
    assumptionSuggestion: "I can draft provisional KPIs aligned to the objectives.",
    priority: 10,
    followUpNeeded: inputs => !inputs.successMetrics || inputs.successMetrics.length === 0,
  },
  {
    field: "keyPartners",
    question: "Are there partners, departments, or champions we should call out?",
    rationale: "Listing partners strengthens the delivery plan and governance model.",
    required: false,
    assumptionSuggestion: "I can list typical internal sponsors and external collaborators.",
    priority: 11,
    followUpNeeded: inputs => !inputs.keyPartners || inputs.keyPartners.length === 0,
  },
];

const BLUEPRINT_LOOKUP = new Map<keyof UserInputs, ClarityBlueprintEntry>(
  CLARITY_BLUEPRINT.map(entry => [entry.field, entry]),
);

export async function userIntakeNode(
  state: ConceptNoteGraphState,
  config: LangGraphRunnableConfig,
): Promise<ConceptNoteGraphReturnType> {
  console.log("🎯 Starting User Intake phase for concept note");
  void config;

  const latestHumanMessage = getLatestHumanMessage(state._messages);
  if (!latestHumanMessage) {
    return {
      needsUserIntervention: true,
      conceptNoteStage: "intake",
      interventionContext: {
        stage: "intake",
        reason: "no_user_input",
        prompt:
          "To craft a meaningful concept note I need a quick brief covering the project title, the problem you're solving, key objectives, target audience, scope, timeline, and any constraints or success measures you already know. Share whatever you have and I can help shape the rest.",
      },
    };
  }

  const userContent = extractMessageContent(latestHumanMessage);
  const existingInputs: UserInputs = { ...(state.userInputs ?? {}) };
  const parsedInputs = extractUserInputsFromContent(userContent);
  let mergedInputs = mergeUserInputs(existingInputs, parsedInputs);

  const userRequestedAssumptions = didUserRequestAssumptions(userContent);
  const assumedFields = userRequestedAssumptions
    ? applyAssumptionsIfRequested(mergedInputs)
    : new Set<keyof UserInputs>();

  const { updatedQuestions, questionsToAsk } = prepareClarifyingQuestions(
    state.clarifyingQuestions,
    mergedInputs,
    assumedFields,
  );

  if (questionsToAsk.length > 0) {
    const prompt = buildClarifyingPrompt(mergedInputs, questionsToAsk);
    return {
      userInputs: mergedInputs,
      clarifyingQuestions: updatedQuestions,
      needsUserIntervention: true,
      conceptNoteStage: "intake",
      interventionContext: {
        stage: "intake",
        reason: "clarify_requirements",
        prompt,
        options: [
          "Provide the clarifications listed above",
          "Ask the assistant to proceed with assumptions",
        ],
      },
    };
  }

  const intakeMessage = new AIMessage({
    id: `intake-${uuidv4()}`,
    content: buildIntakeConfirmation(mergedInputs),
  });

  return {
    userInputs: mergedInputs,
    clarifyingQuestions: updatedQuestions,
    messages: [intakeMessage],
    _messages: [intakeMessage],
    conceptNoteStage: "research",
    needsUserIntervention: false,
  };
}

function getLatestHumanMessage(messages: BaseMessage[]): BaseMessage | undefined {
  return [...messages].reverse().find(message => message.getType() === "human");
}

function extractMessageContent(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map(part => {
        if (typeof part === "string") {
          return part;
        }
        if ("text" in part && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}

function extractUserInputsFromContent(content: string): Partial<UserInputs> {
  const inputs: Partial<UserInputs> = {};
  const title = extractTitle(content);
  if (title) {
    inputs.title = title;
  }

  const description = extractDescription(content);
  if (description) {
    inputs.description = description;
  }

  const audience = extractTargetAudience(content);
  if (audience) {
    inputs.targetAudience = audience;
  }

  const budget = extractBudget(content);
  if (budget) {
    inputs.budget = budget;
  }

  const timeline = extractTimeline(content);
  if (timeline) {
    inputs.timeline = timeline;
  }

  const scope = extractScope(content);
  if (scope) {
    inputs.scope = scope;
  }

  const requirements = extractRequirements(content);
  if (requirements.length > 0) {
    inputs.requirements = requirements;
  }

  const objectives = extractObjectives(content);
  if (objectives.length > 0) {
    inputs.objectives = objectives;
  }

  const keyActivities = extractKeyActivities(content);
  if (keyActivities.length > 0) {
    inputs.keyActivities = keyActivities;
  }

  const keyChallenges = extractKeyChallenges(content);
  if (keyChallenges.length > 0) {
    inputs.keyChallenges = keyChallenges;
  }

  const successMetrics = extractSuccessMetrics(content);
  if (successMetrics.length > 0) {
    inputs.successMetrics = successMetrics;
  }

  const keyPartners = extractKeyPartners(content);
  if (keyPartners.length > 0) {
    inputs.keyPartners = keyPartners;
  }

  return inputs;
}

function mergeUserInputs(existing: UserInputs, updates: Partial<UserInputs>): UserInputs {
  const merged: UserInputs = { ...existing };

  if (updates.title) merged.title = updates.title;
  if (updates.description) merged.description = updates.description;
  if (updates.targetAudience) merged.targetAudience = updates.targetAudience;
  if (updates.budget) merged.budget = updates.budget;
  if (updates.timeline) merged.timeline = updates.timeline;
  if (updates.scope) merged.scope = updates.scope;

  if (updates.requirements) {
    merged.requirements = mergeStringLists(existing.requirements, updates.requirements);
  }

  if (updates.objectives) {
    merged.objectives = mergeStringLists(existing.objectives, updates.objectives);
  }

  if (updates.keyActivities) {
    merged.keyActivities = mergeStringLists(existing.keyActivities, updates.keyActivities);
  }

  if (updates.keyChallenges) {
    merged.keyChallenges = mergeStringLists(existing.keyChallenges, updates.keyChallenges);
  }

  if (updates.successMetrics) {
    merged.successMetrics = mergeStringLists(existing.successMetrics, updates.successMetrics);
  }

  if (updates.keyPartners) {
    merged.keyPartners = mergeStringLists(existing.keyPartners, updates.keyPartners);
  }

  if (updates.outputPreferences) {
    merged.outputPreferences = { ...existing.outputPreferences, ...updates.outputPreferences };
  }

  return merged;
}

function mergeStringLists(
  existing?: string[],
  incoming?: string[],
): string[] | undefined {
  const combined = [...(existing ?? []), ...(incoming ?? [])]
    .map(item => item.trim())
    .filter(item => item.length > 0);
  const unique = Array.from(new Set(combined));
  return unique.length > 0 ? unique : existing;
}

function didUserRequestAssumptions(content: string): boolean {
  const normalized = content.toLowerCase();
  if (!normalized) return false;

  const explicitAssumption = normalized.includes("you can assume") || normalized.includes("feel free to assume");
  const proceedLanguage =
    /(proceed|go ahead|continue|carry on|keep going)/.test(normalized) &&
    /(assume|assumption|decide|estimate|use your judgment|make a call)/.test(normalized);

  return explicitAssumption || proceedLanguage;
}

function applyAssumptionsIfRequested(inputs: UserInputs): Set<keyof UserInputs> {
  const assumedFields = new Set<keyof UserInputs>();

  for (const entry of CLARITY_BLUEPRINT) {
    if (entry.followUpNeeded(inputs)) {
      const assumed = applyAssumptionForField(entry.field, inputs);
      if (assumed) {
        assumedFields.add(entry.field);
      }
    }
  }

  return assumedFields;
}

function applyAssumptionForField(field: keyof UserInputs, inputs: UserInputs): boolean {
  switch (field) {
    case "title": {
      const suggestion = suggestWorkingTitle(inputs);
      if (suggestion) {
        inputs.title = suggestion;
        return true;
      }
      return false;
    }
    case "objectives": {
      if (!inputs.objectives || inputs.objectives.length === 0) {
        inputs.objectives = suggestObjectives(inputs);
        return true;
      }
      return false;
    }
    case "targetAudience": {
      if (!inputs.targetAudience) {
        inputs.targetAudience = "General stakeholders (assumed)";
        return true;
      }
      return false;
    }
    case "timeline": {
      if (!inputs.timeline) {
        inputs.timeline = "Approximately 6–12 months (assumed)";
        return true;
      }
      return false;
    }
    case "budget": {
      if (!inputs.budget) {
        inputs.budget = "Budget to be confirmed during planning (assumed)";
        return true;
      }
      return false;
    }
    case "scope": {
      if (!inputs.scope) {
        inputs.scope = "Local or regional focus (assumed)";
        return true;
      }
      return false;
    }
    case "keyActivities": {
      if (!inputs.keyActivities || inputs.keyActivities.length === 0) {
        inputs.keyActivities = [
          "Discovery and requirements workshops",
          "Pilot implementation of the core solution",
          "Evaluation and scale-up planning",
        ];
        return true;
      }
      return false;
    }
    case "keyChallenges": {
      if (!inputs.keyChallenges || inputs.keyChallenges.length === 0) {
        inputs.keyChallenges = [
          "Stakeholder alignment and change management",
          "Resource availability and budget approvals",
          "Data, compliance, or policy considerations",
        ];
        return true;
      }
      return false;
    }
    case "successMetrics": {
      if (!inputs.successMetrics || inputs.successMetrics.length === 0) {
        inputs.successMetrics = [
          "Achievement of the primary project objectives",
          "Stakeholder satisfaction beating target thresholds",
          "On-time delivery of critical milestones",
        ];
        return true;
      }
      return false;
    }
    case "keyPartners": {
      if (!inputs.keyPartners || inputs.keyPartners.length === 0) {
        inputs.keyPartners = [
          "Executive sponsor or leadership champion",
          "Core delivery team or PMO",
          "Key external collaborators or vendors",
        ];
        return true;
      }
      return false;
    }
    case "requirements": {
      if (!inputs.requirements || inputs.requirements.length === 0) {
        inputs.requirements = ["Detailed functional and non-functional requirements to be confirmed with stakeholders."];
        return true;
      }
      return false;
    }
    default:
      return false;
  }
}

function suggestWorkingTitle(inputs: UserInputs): string | undefined {
  if (inputs.title && !isGenericTitle(inputs.title)) {
    return inputs.title;
  }

  const description = inputs.description?.trim();
  if (description) {
    const words = description
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 4)
      .map(word => capitalize(word));

    if (words.length >= 2) {
      return `${words.slice(0, 3).join(" ")} Initiative`;
    }
  }

  if (inputs.targetAudience) {
    return `${inputs.targetAudience} Concept Initiative`;
  }

  return "Strategic Concept Note Initiative";
}

function suggestObjectives(inputs: UserInputs): string[] {
  const objectives = new Set<string>();
  objectives.add("Validate the solution approach through a structured pilot and stakeholder feedback.");
  objectives.add(
    `Deliver measurable improvements for ${inputs.targetAudience || "key stakeholders"} within the initial implementation cycle.`,
  );
  objectives.add("Establish governance, success metrics, and a roadmap that enable sustainable scale.");

  return Array.from(objectives);
}

function isGenericTitle(title?: string): boolean {
  if (!title) {
    return true;
  }
  const normalized = title.trim().toLowerCase();
  if (normalized.length <= 6) {
    return true;
  }

  const genericPhrases = [
    "concept note",
    "project concept",
    "project proposal",
    "concept paper",
    "proposal",
  ];

  return genericPhrases.includes(normalized);
}

function prepareClarifyingQuestions(
  existingQuestions: ClarifyingQuestion[] | undefined,
  inputs: UserInputs,
  assumedFields: Set<keyof UserInputs>,
): { updatedQuestions: ClarifyingQuestion[]; questionsToAsk: ClarifyingQuestion[] } {
  const now = new Date().toISOString();
  const questionMap = new Map<string, ClarifyingQuestion>();

  (existingQuestions ?? []).forEach(question => {
    questionMap.set(question.field, { ...question });
  });

  for (const entry of CLARITY_BLUEPRINT) {
    const questionKey = entry.field;
    const existing = questionMap.get(questionKey);

    if (entry.followUpNeeded(inputs)) {
      if (existing) {
        if (existing.status !== "pending") {
          existing.status = "pending";
        }
        questionMap.set(questionKey, { ...existing });
      } else {
        questionMap.set(questionKey, {
          id: `clarify-${questionKey}-${uuidv4()}`,
          field: questionKey,
          question: entry.question,
          rationale: entry.rationale,
          required: entry.required,
          status: "pending",
          timesAsked: 0,
          lastAskedAt: now,
          assumptionSuggestion: entry.assumptionSuggestion,
        });
      }
    } else if (existing) {
      const status = assumedFields.has(questionKey) ? "assumed" : "answered";
      questionMap.set(questionKey, { ...existing, status });
    }
  }

  const pendingQuestions = Array.from(questionMap.values())
    .filter(question => question.status === "pending")
    .sort((a, b) => {
      const priorityA = BLUEPRINT_LOOKUP.get(a.field as keyof UserInputs)?.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = BLUEPRINT_LOOKUP.get(b.field as keyof UserInputs)?.priority ?? Number.MAX_SAFE_INTEGER;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return (a.timesAsked ?? 0) - (b.timesAsked ?? 0);
    });

  const questionsToAsk: ClarifyingQuestion[] = [];
  for (const question of pendingQuestions) {
    const blueprint = BLUEPRINT_LOOKUP.get(question.field as keyof UserInputs);
    if (!blueprint) continue;

    if (
      question.timesAsked === 0 ||
      blueprint.required
    ) {
      questionsToAsk.push({ ...question, timesAsked: question.timesAsked + 1, lastAskedAt: now });

      if (questionsToAsk.length >= MAX_QUESTIONS_PER_PROMPT) {
        break;
      }
    }
  }

  questionsToAsk.forEach(question => {
    questionMap.set(question.field, question);
  });

  return {
    updatedQuestions: Array.from(questionMap.values()),
    questionsToAsk,
  };
}

function buildClarifyingPrompt(inputs: UserInputs, questions: ClarifyingQuestion[]): string {
  const summary = formatIntakeSummary(inputs);
  const questionLines = questions.map((question, index) => {
    const blueprint = BLUEPRINT_LOOKUP.get(question.field as keyof UserInputs);
    const rationaleLine = blueprint?.rationale ? `   Why: ${blueprint.rationale}` : undefined;
    const assumptionLine = blueprint?.assumptionSuggestion
      ? `   If unknown: ${blueprint.assumptionSuggestion}`
      : undefined;

    return [
      `${index + 1}. ${question.question}`,
      rationaleLine,
      assumptionLine,
    ]
      .filter(Boolean)
      .join("\n");
  });

  return (
    "To shape this concept note like a consultant, I want to confirm a few essentials.\n\n" +
    "Here's the working brief I have so far:\n" +
    `${summary}\n\n` +
    "Could you clarify the following?\n" +
    questionLines.join("\n") +
    "\n\nIf anything is unavailable, let me know and I can suggest assumptions or proceed with reasonable defaults."
  );
}

function buildIntakeConfirmation(inputs: UserInputs): string {
  const summary = formatIntakeSummary(inputs);
  return (
    "✅ **Intake Complete**\n\n" +
    "Here's the working brief I'm using:\n" +
    `${summary}\n\n` +
    "I'll move into research next to enrich the concept note with supporting insights."
  );
}

function formatIntakeSummary(inputs: UserInputs): string {
  const lines: string[] = [];

  if (inputs.title) {
    lines.push(`• **Title**: ${inputs.title}`);
  }
  if (inputs.description) {
    lines.push(`• **Description**: ${truncate(inputs.description, 220)}`);
  }
  if (inputs.objectives && inputs.objectives.length > 0) {
    lines.push(`• **Objectives**: ${inputs.objectives.slice(0, 3).join("; ")}`);
  }
  if (inputs.targetAudience) {
    lines.push(`• **Audience**: ${inputs.targetAudience}`);
  }
  if (inputs.timeline) {
    lines.push(`• **Timeline**: ${inputs.timeline}`);
  }
  if (inputs.scope) {
    lines.push(`• **Scope**: ${inputs.scope}`);
  }
  if (inputs.keyActivities && inputs.keyActivities.length > 0) {
    lines.push(`• **Key Activities**: ${inputs.keyActivities.slice(0, 3).join("; ")}`);
  }
  if (inputs.keyChallenges && inputs.keyChallenges.length > 0) {
    lines.push(`• **Risks / Constraints**: ${inputs.keyChallenges.slice(0, 3).join("; ")}`);
  }
  if (inputs.successMetrics && inputs.successMetrics.length > 0) {
    lines.push(`• **Success Metrics**: ${inputs.successMetrics.slice(0, 3).join("; ")}`);
  }
  if (inputs.keyPartners && inputs.keyPartners.length > 0) {
    lines.push(`• **Partners**: ${inputs.keyPartners.slice(0, 3).join("; ")}`);
  }
  if (inputs.budget) {
    lines.push(`• **Budget**: ${inputs.budget}`);
  }
  if (inputs.requirements && inputs.requirements.length > 0) {
    lines.push(`• **Requirements**: ${inputs.requirements.slice(0, 3).join("; ")}`);
  }

  return lines.length > 0 ? lines.join("\n") : "• I do not yet have specific project details confirmed.";
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 3)}...`;
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function parseBulletBlock(block: string): string[] {
  return block
    .split(/\r?\n/)
    .map(line => line.trim())
    .map(line => line.replace(/^[\-*•\d.)\s]+/, "").trim())
    .filter(line => line.length > 0);
}

function splitInlineList(value: string): string[] {
  return value
    .replace(/\sand\s/gi, ", ")
    .split(/[,;|]/)
    .map(item => item.trim())
    .filter(item => item.length > 0);
}

function extractListFromPatterns(content: string, patterns: RegExp[]): string[] {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return parseBulletBlock(match[1]);
    }
  }
  return [];
}

function extractInlineListFromPatterns(content: string, patterns: RegExp[]): string[] {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return splitInlineList(match[1]);
    }
  }
  return [];
}

function extractTitle(content: string): string | undefined {
  const titlePatterns = [
    /(?:title|project|name):\s*(.+?)(?:\n|$)/i,
    /(?:create|build|make)\s+(?:a\s+)?(?:concept\s+note\s+)?(?:about|for|on)\s+(.+?)(?:\n|\.)/i,
    /^(.+?)(?:\n|$)/,
  ];

  for (const pattern of titlePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.toLowerCase().startsWith("generate")) {
        continue;
      }
      if (candidate.toLowerCase().includes("concept note") && candidate.split(/\s+/).length <= 4) {
        continue;
      }
      if (candidate.length > 3 && !isGenericTitle(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function extractDescription(content: string): string | undefined {
  const descPatterns = [
    /(?:description|about|details?):\s*(.+?)(?:\n\n|$)/is,
    /(?:project|initiative)\s+(?:is\s+)?(?:about|involves?)\s+(.+?)(?:\n|\.)/i,
  ];

  for (const pattern of descPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate.length > 40) {
        return candidate;
      }
    }
  }

  if (content.length > 120 && !content.toLowerCase().startsWith("generate a concept note")) {
    return content.trim();
  }

  return undefined;
}

function extractTargetAudience(content: string): string | undefined {
  const audiencePatterns = [
    /(?:target\s+audience|audience|stakeholders?):\s*(.+?)(?:\n|$)/i,
    /(?:for|to)\s+(investors|donors|management|government|community|stakeholders|customers|students)/i,
  ];

  for (const pattern of audiencePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractBudget(content: string): string | undefined {
  const budgetPatterns = [
    /(?:budget|cost|funding):\s*(.+?)(?:\n|$)/i,
    /\$[\d,]+(?:\.\d{2})?/,
    /(?:\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|usd|eur|gbp)/i,
  ];

  for (const pattern of budgetPatterns) {
    const match = content.match(pattern);
    if (match) {
      return (match[1] || match[0]).trim();
    }
  }
  return undefined;
}

function extractTimeline(content: string): string | undefined {
  const timelinePatterns = [
    /(?:timeline|duration|timeframe):\s*(.+?)(?:\n|$)/i,
    /(?:over|within|in)\s+(\d+\s+(?:days?|weeks?|months?|years?))/i,
    /(\d+\s*-\s*\d+\s+(?:months?|years?))/i,
  ];

  for (const pattern of timelinePatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractScope(content: string): string | undefined {
  const scopePatterns = [
    /(?:scope|location|geography):\s*(.+?)(?:\n|$)/i,
    /(?:in|across|throughout)\s+(local|regional|national|international|global)/i,
    /(city|state|country|region|worldwide|nationwide)/i,
  ];

  for (const pattern of scopePatterns) {
    const match = content.match(pattern);
    if (match) {
      return (match[1] || match[0]).trim();
    }
  }

  return undefined;
}

function extractRequirements(content: string): string[] {
  const block = extractListFromPatterns(content, [
    /(?:requirements?|needs?|must\s+haves?):\s*((?:[-*•]\s*.+\n?)+)/i,
    /requirements?\s*\n((?:[-*•]\s*.+\n?)+)/i,
  ]);
  if (block.length > 0) {
    return block;
  }

  const enumerated = Array.from(content.matchAll(/requirement\s*(?:\d+|[A-Z])[:)\-]\s*(.+)/gi))
    .map(match => match[1].trim())
    .filter(item => item.length > 0);
  if (enumerated.length > 0) {
    return enumerated;
  }

  const inline = extractInlineListFromPatterns(content, [
    /(?:requirements?|needs?|must\s+haves?):\s*(.+?)(?:\n|$)/i,
  ]);

  return inline;
}

function extractObjectives(content: string): string[] {
  const block = extractListFromPatterns(content, [
    /(?:objectives?|goals?):\s*((?:[-*•]\s*.+\n?)+)/i,
    /objectives?\s*\n((?:[-*•]\s*.+\n?)+)/i,
  ]);
  if (block.length > 0) {
    return block;
  }

  const enumerated = Array.from(content.matchAll(/objective\s*(?:\d+|[A-Z])[:)\-]\s*(.+)/gi))
    .map(match => match[1].trim())
    .filter(item => item.length > 0);
  if (enumerated.length > 0) {
    return enumerated;
  }

  const inline = extractInlineListFromPatterns(content, [
    /(?:objectives?|goals?):\s*(.+?)(?:\n|$)/i,
  ]);
  return inline;
}

function extractKeyActivities(content: string): string[] {
  const block = extractListFromPatterns(content, [
    /(?:activities|workstreams|phases|deliverables):\s*((?:[-*•]\s*.+\n?)+)/i,
  ]);
  if (block.length > 0) {
    return block;
  }

  const enumerated = Array.from(content.matchAll(/(?:activity|phase)\s*(?:\d+|[A-Z])[:)\-]\s*(.+)/gi))
    .map(match => match[1].trim())
    .filter(item => item.length > 0);
  if (enumerated.length > 0) {
    return enumerated;
  }

  const inline = extractInlineListFromPatterns(content, [
    /(?:activities|workstreams|phases|deliverables):\s*(.+?)(?:\n|$)/i,
  ]);

  return inline;
}

function extractKeyChallenges(content: string): string[] {
  const block = extractListFromPatterns(content, [
    /(?:challenges|risks|constraints|pain\s*points):\s*((?:[-*•]\s*.+\n?)+)/i,
  ]);
  if (block.length > 0) {
    return block;
  }

  const enumerated = Array.from(content.matchAll(/(?:risk|constraint)\s*(?:\d+|[A-Z])[:)\-]\s*(.+)/gi))
    .map(match => match[1].trim())
    .filter(item => item.length > 0);
  if (enumerated.length > 0) {
    return enumerated;
  }

  const inline = extractInlineListFromPatterns(content, [
    /(?:challenges|risks|constraints|pain\s*points):\s*(.+?)(?:\n|$)/i,
  ]);

  return inline;
}

function extractSuccessMetrics(content: string): string[] {
  const block = extractListFromPatterns(content, [
    /(?:success\s+metrics|kpis?|key\s+results|impact\s+metrics):\s*((?:[-*•]\s*.+\n?)+)/i,
  ]);
  if (block.length > 0) {
    return block;
  }

  const enumerated = Array.from(content.matchAll(/(?:kpi|metric)\s*(?:\d+|[A-Z])[:)\-]\s*(.+)/gi))
    .map(match => match[1].trim())
    .filter(item => item.length > 0);
  if (enumerated.length > 0) {
    return enumerated;
  }

  const inline = extractInlineListFromPatterns(content, [
    /(?:success\s+metrics|kpis?|key\s+results|impact\s+metrics):\s*(.+?)(?:\n|$)/i,
  ]);

  return inline;
}

function extractKeyPartners(content: string): string[] {
  const block = extractListFromPatterns(content, [
    /(?:partners|departments|teams|collaborators|champions):\s*((?:[-*•]\s*.+\n?)+)/i,
  ]);
  if (block.length > 0) {
    return block;
  }

  const enumerated = Array.from(content.matchAll(/(?:partner|department|team)\s*(?:\d+|[A-Z])[:)\-]\s*(.+)/gi))
    .map(match => match[1].trim())
    .filter(item => item.length > 0);
  if (enumerated.length > 0) {
    return enumerated;
  }

  const inline = extractInlineListFromPatterns(content, [
    /(?:partners|departments|teams|collaborators|champions):\s*(.+?)(?:\n|$)/i,
  ]);

  return inline;
}

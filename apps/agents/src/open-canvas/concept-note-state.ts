import { Annotation } from "@langchain/langgraph";
import { OpenCanvasGraphAnnotation } from "./state.js";

/**
 * Shared state schema for the Guided Concept Note Builder Graph.
 * This extends the base OpenCanvas state with specific channels for concept note generation.
 */

// Core data structures for concept note builder
export interface UserInputs {
  /** Project title or topic */
  title?: string;
  /** Project description and objectives */
  description?: string;
  /** Target audience information */
  targetAudience?: string;
  /** Budget constraints */
  budget?: string;
  /** Timeline requirements */
  timeline?: string;
  /** Geographic scope */
  scope?: string;
  /** Specific requirements or constraints */
  requirements?: string[];
  /** Primary objectives or goals the project must achieve */
  objectives?: string[];
  /** Major activities or workstreams you already have in mind */
  keyActivities?: string[];
  /** Known risks, blockers, or pain points to manage */
  keyChallenges?: string[];
  /** How success will be measured or evaluated */
  successMetrics?: string[];
  /** Partners or stakeholders that must be involved */
  keyPartners?: string[];
  /** User preferences for output format */
  outputPreferences?: {
    format?: "pdf" | "markdown" | "docx";
    length?: "brief" | "standard" | "detailed";
    includeVisuals?: boolean;
  };
}

export interface DerivedData {
  /** Extracted key themes and concepts */
  keyThemes?: string[];
  /** Identified stakeholders */
  stakeholders?: string[];
  /** Risk assessment */
  risks?: Array<{
    risk: string;
    impact: "low" | "medium" | "high";
    likelihood: "low" | "medium" | "high";
    mitigation?: string;
  }>;
  /** Success metrics and KPIs */
  successMetrics?: string[];
  /** Resource requirements */
  resourceNeeds?: {
    human?: string[];
    technical?: string[];
    financial?: string;
  };
}

export interface AssumptionsLog {
  /** List of assumptions made during processing */
  assumptions: Array<{
    id: string;
    assumption: string;
    reasoning: string;
    confidence: "low" | "medium" | "high";
    stage: "intake" | "research" | "compute" | "draft" | "review";
    timestamp: string;
  }>;
}

export interface ResearchNotes {
  /** Web search results and findings */
  webFindings?: Array<{
    source: string;
    url?: string;
    relevantContent: string;
    reliability: "low" | "medium" | "high";
  }>;
  /** Best practices identified */
  bestPractices?: string[];
  /** Similar projects or case studies */
  casStudies?: Array<{
    title: string;
    description: string;
    relevantLessons: string[];
  }>;
  /** Regulatory or compliance considerations */
  compliance?: string[];
}

export interface ConceptDraft {
  /** Executive summary */
  executiveSummary?: string;
  /** Problem statement */
  problemStatement?: string;
  /** Proposed solution */
  proposedSolution?: string;
  /** Implementation approach */
  implementation?: string;
  /** Timeline and milestones */
  timeline?: string;
  /** Budget breakdown */
  budget?: string;
  /** Risk management */
  riskManagement?: string;
  /** Expected outcomes */
  expectedOutcomes?: string;
  /** Version history */
  version: number;
  lastUpdated: string;
}

export interface TodoItems {
  /** Outstanding tasks and items needing attention */
  items: Array<{
    id: string;
    task: string;
    priority: "low" | "medium" | "high";
    stage: "research" | "analysis" | "drafting" | "review" | "finalization";
    assignedTo?: string;
    dueDate?: string;
    status: "pending" | "in-progress" | "completed";
  }>;
}

export interface Citations {
  /** References and sources used */
  sources: Array<{
    id: string;
    type: "web" | "document" | "expert" | "database";
    title: string;
    url?: string;
    author?: string;
    date?: string;
    relevantPages?: string;
    credibility: "low" | "medium" | "high";
  }>;
}

/**
 * Decision table entries for handling missing data in Research/Compute nodes
 */
export interface MissingDataDecision {
  missingField: keyof UserInputs;
  decisionAction:
    | "prompt_user"
    | "make_assumption"
    | "skip_section"
    | "use_default";
  defaultValue?: any;
  assumptionReasoning?: string;
  userPrompt?: string;
  criticalityLevel: "low" | "medium" | "high";
}

export const MISSING_DATA_DECISION_TABLE: MissingDataDecision[] = [
  {
    missingField: "title",
    decisionAction: "prompt_user",
    userPrompt: "Please provide a title for your concept note.",
    criticalityLevel: "high",
  },
  {
    missingField: "description",
    decisionAction: "prompt_user",
    userPrompt: "Please describe your project or initiative in more detail.",
    criticalityLevel: "high",
  },
  {
    missingField: "targetAudience",
    decisionAction: "make_assumption",
    defaultValue: "General stakeholders",
    assumptionReasoning:
      "Assuming general stakeholder audience when not specified",
    criticalityLevel: "medium",
  },
  {
    missingField: "budget",
    decisionAction: "skip_section",
    criticalityLevel: "medium",
  },
  {
    missingField: "timeline",
    decisionAction: "make_assumption",
    defaultValue: "6-12 months",
    assumptionReasoning:
      "Standard project timeline assumption for concept notes",
    criticalityLevel: "low",
  },
  {
    missingField: "scope",
    decisionAction: "make_assumption",
    defaultValue: "Local/Regional",
    assumptionReasoning: "Assuming local scope when not specified",
    criticalityLevel: "low",
  },
];

export interface ClarifyingQuestion {
  /** Identifier for tracking follow-ups */
  id: string;
  /** Which user input this question is trying to clarify */
  field:
    | keyof UserInputs
    | "problem_context"
    | "constraints"
    | "dependencies";
  /** Question posed to the user */
  question: string;
  /** Why the question matters */
  rationale: string;
  /** Whether the graph should block without this information */
  required: boolean;
  /** Current resolution status */
  status: "pending" | "answered" | "assumed";
  /** Count of how many times it has been asked */
  timesAsked: number;
  /** Timestamp of the last time it was asked */
  lastAskedAt: string;
  /** Suggested assumption or default if the user cannot provide it */
  assumptionSuggestion?: string;
}

/**
 * Extended state annotation for the Concept Note Builder Graph
 */
export const ConceptNoteGraphAnnotation = Annotation.Root({
  // Inherit all base open-canvas state
  ...OpenCanvasGraphAnnotation.spec,

  // Concept note specific state channels
  userInputs: Annotation<UserInputs>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({}),
  }),

  derivedData: Annotation<DerivedData>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({}),
  }),

  assumptionsLog: Annotation<AssumptionsLog>({
    reducer: (state, update) => ({
      assumptions: [
        ...(state?.assumptions || []),
        ...(update?.assumptions || []),
      ],
    }),
    default: () => ({ assumptions: [] }),
  }),

  researchNotes: Annotation<ResearchNotes>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({}),
  }),

  conceptDraft: Annotation<ConceptDraft>({
    reducer: (state, update) => ({ ...state, ...update }),
    default: () => ({ version: 1, lastUpdated: new Date().toISOString() }),
  }),

  todos: Annotation<TodoItems>({
    reducer: (state, update) => ({
      items: [...(state?.items || []), ...(update?.items || [])],
    }),
    default: () => ({ items: [] }),
  }),

  citations: Annotation<Citations>({
    reducer: (state, update) => ({
      sources: [...(state?.sources || []), ...(update?.sources || [])],
    }),
    default: () => ({ sources: [] }),
  }),

  clarifyingQuestions: Annotation<ClarifyingQuestion[]>({
    reducer: (state, update) => {
      const existing = state ?? [];
      const incoming = update ?? [];
      const merged = new Map<string, ClarifyingQuestion>();

      for (const question of existing) {
        merged.set(question.id, question);
      }

      for (const question of incoming) {
        merged.set(question.id, question);
      }

      return Array.from(merged.values());
    },
    default: () => [],
  }),

  // Control flow for the concept note builder
  conceptNoteStage: Annotation<
    | "intake"
    | "research"
    | "compute"
    | "draft"
    | "review"
    | "export"
    | "completed"
  >({
    reducer: (state, update) => (update ?? state ?? "intake"),
    default: () => "intake",
  }),

  // Flag to indicate if HITL intervention is needed
  needsUserIntervention: Annotation<boolean>({
    reducer: (state, update) => (update ?? state ?? false),
    default: () => false,
  }),

  // Store intervention context
  interventionContext: Annotation<
    | {
        stage: string;
        reason: string;
        prompt?: string;
        options?: string[];
      }
    | undefined
  >(),
});

export type ConceptNoteGraphState = typeof ConceptNoteGraphAnnotation.State;
export type ConceptNoteGraphReturnType = Partial<ConceptNoteGraphState>;

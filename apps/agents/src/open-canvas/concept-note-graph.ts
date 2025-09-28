import { StateGraph, START, END } from "@langchain/langgraph";
import { ConceptNoteGraphAnnotation, ConceptNoteGraphState } from "./concept-note-state.js";
import { HumanMessage } from "@langchain/core/messages";
import {
  userIntakeNode,
  researchNode,
  computeNode,
  draftNode,
  reviewNode,
  exportNode
} from "./nodes/concept-note/index.js";

/**
 * Guided Concept Note Builder Graph
 * 
 * This LangGraph-based pipeline interviews the user, persists shared state, and supports
 * HITL interrupts between User Intake → Research → Compute → Draft → Review → Export stages.
 */

/**
 * Conditional routing function that determines the next node based on current state
 */
function routeConceptNoteFlow(state: ConceptNoteGraphState): string | typeof END {
  // Handle user intervention needs
  if (state.needsUserIntervention) {
    return "waitForUser";
  }

  // Route based on current stage
  switch (state.conceptNoteStage) {
    case "intake":
      return "userIntake";
    case "research":
      return "research";
    case "compute":
      return "compute";
    case "draft":
      return "draftGenerator";
    case "review":
      return "review";
    case "export":
      return "export";
    case "completed":
      return END;
    default:
      return "userIntake"; // Default to start
  }
}

/**
 * Handle user intervention node - pauses for HITL interaction
 */
async function waitForUserNode(_state: ConceptNoteGraphState): Promise<Partial<ConceptNoteGraphState>> {
  console.log("⏸️ Waiting for user intervention");
  void state;
  
  // This node represents a pause point for human-in-the-loop interaction
  // The actual user interaction would be handled by the UI layer
  
  return {
    // Keep current state but clear intervention flag
    needsUserIntervention: false,
    interventionContext: undefined
  };
}

/**
 * Route after user intervention
 */
function routeAfterUserIntervention(state: ConceptNoteGraphState): string {
  // Continue with the stage that was interrupted
  return routeConceptNoteFlow(state);
}

/**
 * Build the Concept Note Builder graph
 */
const builder = new StateGraph(ConceptNoteGraphAnnotation)
  // Add all the concept note nodes
  .addNode("userIntake", userIntakeNode)
  .addNode("research", researchNode)
  .addNode("compute", computeNode)
  .addNode("draftGenerator", draftNode)
  .addNode("review", reviewNode)
  .addNode("export", exportNode)
  .addNode("waitForUser", waitForUserNode)
  
  // Start the graph
  .addEdge(START, "userIntake")
  
  // Main flow with HITL interrupt capability
  .addConditionalEdges("userIntake", routeConceptNoteFlow, [
    "research",
    "waitForUser",
    END
  ])
  
  .addConditionalEdges("research", routeConceptNoteFlow, [
    "compute", 
    "waitForUser",
    END
  ])
  
  .addConditionalEdges("compute", routeConceptNoteFlow, [
    "draftGenerator",
    "waitForUser", 
    END
  ])
  
  .addConditionalEdges("draftGenerator", routeConceptNoteFlow, [
    "review",
    "waitForUser",
    END
  ])
  
  .addConditionalEdges("review", routeConceptNoteFlow, [
    "export",
    "waitForUser",
    END
  ])
  
  .addConditionalEdges("export", routeConceptNoteFlow, [
    END,
    "waitForUser"
  ])
  
  // Handle user intervention flow
  .addConditionalEdges("waitForUser", routeAfterUserIntervention, [
    "userIntake",
    "research", 
    "compute",
    "draftGenerator",
    "review",
    "export",
    END
  ]);

// Add interrupt points before critical nodes
export const conceptNoteGraph = builder.compile({
  interruptBefore: ["research", "draftGenerator", "review", "export"], // HITL interrupt points
  interruptAfter: ["userIntake", "compute"] // Additional interrupt points after key stages
});

conceptNoteGraph.name = "Concept Note Builder Graph";

/**
 * Helper function to initialize concept note generation
 */
export function createConceptNoteInput(userMessage: string, customOptions?: any): Partial<ConceptNoteGraphState> {
  const humanMessage = new HumanMessage({ content: userMessage });
  return {
    messages: [humanMessage],
    _messages: [humanMessage],
    conceptNoteStage: "intake",
    needsUserIntervention: false,
    userInputs: customOptions?.userInputs || {},
    ...customOptions
  };
}

/**
 * Helper function to resume concept note generation after user intervention
 */
export function resumeConceptNoteGeneration(
  currentState: ConceptNoteGraphState,
  userResponse?: string,
  updatedInputs?: any
): Partial<ConceptNoteGraphState> {
  const updates: Partial<ConceptNoteGraphState> = {
    needsUserIntervention: false,
    interventionContext: undefined
  };

  // Add user response if provided
  if (userResponse) {
    const humanMessage = new HumanMessage({ content: userResponse });
    updates.messages = [humanMessage];
    updates._messages = [humanMessage];
  }

  // Update user inputs if provided
  if (updatedInputs) {
    updates.userInputs = { ...currentState.userInputs, ...updatedInputs };
  }

  return updates;
}

/**
 * Type definitions for external use
 */
export type ConceptNoteInput = ReturnType<typeof createConceptNoteInput>;
export type ConceptNoteResume = ReturnType<typeof resumeConceptNoteGeneration>;

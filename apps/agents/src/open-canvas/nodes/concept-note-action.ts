import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { OpenCanvasGraphAnnotation, OpenCanvasGraphReturnType } from "../state.js";
import { conceptNoteGraph, createConceptNoteInput } from "../concept-note-graph.js";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * Concept Note Action Node - Handles the "Generate Concept Note" quick action.
 * This node triggers the concept note builder graph pipeline.
 */
export async function conceptNoteAction(
  state: typeof OpenCanvasGraphAnnotation.State,
  config: LangGraphRunnableConfig
): Promise<OpenCanvasGraphReturnType> {
  console.log("📋 Starting Concept Note Generation");

  try {
    // Get the latest human message content for the concept note generation
    const latestHumanMessage = state._messages.find(msg => msg.getType() === "human");
    const userContent = latestHumanMessage?.content as string || "Generate a concept note";

    // Create initial input for the concept note graph
    const conceptNoteInput = createConceptNoteInput(userContent);

    // Execute the concept note builder graph
    const conceptNoteResult = await conceptNoteGraph.invoke(conceptNoteInput, {
      ...config,
      configurable: {
        ...config.configurable,
        thread_id: `concept-note-${uuidv4()}` // Create separate thread for concept note
      }
    });

    // Generate initiation message
    const initiationMessage = new AIMessage({
      id: `concept-note-init-${uuidv4()}`,
      content: `🚀 **Concept Note Builder Activated**\n\n` +
               `I'm starting the guided concept note generation process. This will involve several stages:\n\n` +
               `1. **User Intake** - Gathering your requirements and preferences\n` +
               `2. **Research** - Finding relevant information and best practices\n` +
               `3. **Analysis** - Processing data and deriving insights\n` +
               `4. **Drafting** - Creating the structured concept note\n` +
               `5. **Review** - Quality checking and refinement\n` +
               `6. **Export** - Final formatting and delivery\n\n` +
               `The system will pause at key points for your input and feedback. Let's begin!`
    });

    // If the concept note graph completed and has an artifact, use it
    if (conceptNoteResult.artifact) {
      return {
        artifact: conceptNoteResult.artifact,
        messages: [initiationMessage],
        _messages: [initiationMessage]
      };
    }

    // If the concept note graph is still in progress or needs intervention
    return {
      messages: [initiationMessage],
      _messages: [initiationMessage]
    };

  } catch (error) {
    console.error("Concept Note Action error:", error);
    
    // Return error message
    const errorMessage = new AIMessage({
      id: `concept-note-error-${uuidv4()}`,
      content: `❌ **Concept Note Generation Error**\n\n` +
               `I encountered an issue while starting the concept note generation process. ` +
               `Please try again or provide more specific information about the concept note you'd like to create.\n\n` +
               `**What you can try:**\n` +
               `• Provide a clear project title and description\n` +
               `• Specify your target audience and objectives\n` +
               `• Include any specific requirements or constraints`
    });

    return {
      messages: [errorMessage],
      _messages: [errorMessage]
    };
  }
}

/**
 * Check if the request is for concept note generation
 */
export function isConceptNoteRequest(content: string): boolean {
  const lowerContent = content.toLowerCase();
  
  const conceptNoteKeywords = [
    "concept note",
    "concept paper", 
    "project proposal",
    "generate concept note",
    "create concept note",
    "build concept note",
    "concept note builder",
    "project concept",
    "proposal draft"
  ];
  
  return conceptNoteKeywords.some(keyword => lowerContent.includes(keyword));
}

/**
 * Built-in "Generate Concept Note" quick action configuration
 * This can be used as a reference for the UI to create the built-in action
 */
export const CONCEPT_NOTE_QUICK_ACTION = {
  id: "generate-concept-note-builtin",
  title: "Generate Concept Note", 
  prompt: "I'd like to create a comprehensive concept note using the guided concept note builder",
  includeReflections: false,
  includePrefix: false,
  includeRecentHistory: true
} as const;
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConceptNoteGraphState, ConceptNoteGraphReturnType, UserInputs } from "../../concept-note-state.js";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * User Intake Node - Collects user requirements and preferences for concept note generation.
 * This node interviews the user to gather essential information for the concept note.
 */
export async function userIntakeNode(
  state: ConceptNoteGraphState,
  _config: LangGraphRunnableConfig
): Promise<ConceptNoteGraphReturnType> {
  console.log("🎯 Starting User Intake phase for concept note");

  // Extract user input from the latest human message
  const latestHumanMessage = state._messages.find(msg => msg.getType() === "human");
  
  if (!latestHumanMessage) {
    return {
      needsUserIntervention: true,
      interventionContext: {
        stage: "intake",
        reason: "no_user_input",
        prompt: "Please provide some information about the concept note you'd like to create. Include details like the project title, description, target audience, and any specific requirements."
      }
    };
  }

  // Parse user input from message content
  const userContent = typeof latestHumanMessage.content === 'string' 
    ? latestHumanMessage.content 
    : latestHumanMessage.content.map(c => 'text' in c ? c.text : '').join(' ');

  // Basic extraction of user inputs
  const userInputs: UserInputs = {
    title: extractTitle(userContent),
    description: extractDescription(userContent),
    targetAudience: extractTargetAudience(userContent),
    budget: extractBudget(userContent),
    timeline: extractTimeline(userContent),
    scope: extractScope(userContent),
    requirements: extractRequirements(userContent),
    outputPreferences: {
      format: "markdown", // Default format
      length: "standard",
      includeVisuals: false
    }
  };

  // Determine if we need more information
  const missingCriticalFields = [];
  if (!userInputs.title) missingCriticalFields.push("title");
  if (!userInputs.description) missingCriticalFields.push("description");

  if (missingCriticalFields.length > 0) {
    return {
      userInputs,
      needsUserIntervention: true,
      interventionContext: {
        stage: "intake",
        reason: "missing_critical_info",
        prompt: `I need some additional information to create your concept note. Could you please provide:\n${missingCriticalFields.map(field => `- ${field.charAt(0).toUpperCase() + field.slice(1)}`).join('\n')}`
      },
      conceptNoteStage: "intake"
    };
  }

  // Generate intake confirmation message
  const intakeMessage = new AIMessage({
    id: `intake-${uuidv4()}`,
    content: `Great! I'm ready to help you create a concept note. Here's what I understand:\n\n` +
             `📋 **Title**: ${userInputs.title}\n` +
             `📝 **Description**: ${userInputs.description}\n` +
             `👥 **Target Audience**: ${userInputs.targetAudience || 'General stakeholders'}\n` +
             `📅 **Timeline**: ${userInputs.timeline || 'To be determined'}\n` +
             `🌍 **Scope**: ${userInputs.scope || 'To be determined'}\n\n` +
             `I'll now proceed to research relevant information and start building your concept note.`
  });

  return {
    userInputs,
    messages: [intakeMessage],
    _messages: [intakeMessage],
    conceptNoteStage: "research",
    needsUserIntervention: false
  };
}

// Helper functions for extracting information from user input
function extractTitle(content: string): string | undefined {
  // Look for patterns like "title:", "project:", "about", etc.
  const titlePatterns = [
    /(?:title|project|name):\s*(.+?)(?:\n|$)/i,
    /(?:create|build|make)\s+(?:a\s+)?(?:concept\s+note\s+)?(?:about|for|on)\s+(.+?)(?:\n|\.)/i,
    /^(.+?)(?:\n|\.)/
  ];
  
  for (const pattern of titlePatterns) {
    const match = content.match(pattern);
    if (match && match[1].trim().length > 3) {
      return match[1].trim();
    }
  }
  return undefined;
}

function extractDescription(content: string): string | undefined {
  // Look for description patterns
  const descPatterns = [
    /(?:description|about|details?):\s*(.+?)(?:\n\n|$)/i,
    /(?:project|initiative)\s+(?:is\s+)?(?:about|involves?)\s+(.+?)(?:\n|\.)/i
  ];
  
  for (const pattern of descPatterns) {
    const match = content.match(pattern);
    if (match && match[1].trim().length > 10) {
      return match[1].trim();
    }
  }
  
  // Fallback to using the content if it's descriptive enough
  if (content.length > 50 && !content.toLowerCase().includes("concept note")) {
    return content;
  }
  
  return undefined;
}

function extractTargetAudience(content: string): string | undefined {
  const audiencePatterns = [
    /(?:target\s+audience|audience|stakeholders?):\s*(.+?)(?:\n|$)/i,
    /(?:for|to)\s+(investors|donors|management|government|community|stakeholders)/i
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
    /(?:\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:dollars?|USD|EUR|GBP)/i
  ];
  
  for (const pattern of budgetPatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return undefined;
}

function extractTimeline(content: string): string | undefined {
  const timelinePatterns = [
    /(?:timeline|duration|timeframe):\s*(.+?)(?:\n|$)/i,
    /(?:over|within|in)\s+(\d+\s+(?:days?|weeks?|months?|years?))/i,
    /(\d+\s*-\s*\d+\s+(?:months?|years?))/i
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
    /(?:city|state|country|region|worldwide)/i
  ];
  
  for (const pattern of scopePatterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1] || match[0];
    }
  }
  return undefined;
}

function extractRequirements(content: string): string[] {
  const requirements: string[] = [];
  
  // Look for bullet points or numbered lists
  const listPatterns = [
    /(?:requirements?|needs?|must\s+haves?):\s*((?:[-*•]\s*.+\n?)+)/i,
    /(?:[-*•]\s*(.+))/g
  ];
  
  for (const pattern of listPatterns) {
    let match;
    const regex = new RegExp(pattern.source, pattern.flags);
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        requirements.push(match[1].trim());
      }
      // Prevent infinite loop for global regex
      if (!pattern.flags.includes('g')) break;
    }
  }
  
  return requirements.length > 0 ? requirements : [];
}
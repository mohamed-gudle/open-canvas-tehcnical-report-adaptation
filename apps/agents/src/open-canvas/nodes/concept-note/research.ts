import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConceptNoteGraphState, ConceptNoteGraphReturnType, MISSING_DATA_DECISION_TABLE, ResearchNotes, AssumptionsLog } from "../../concept-note-state.js";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * Research Node - Gathers additional context and information for the concept note.
 * Implements decision table logic for handling missing data.
 */
export async function researchNode(
  state: ConceptNoteGraphState,
  config: LangGraphRunnableConfig
): Promise<ConceptNoteGraphReturnType> {
  console.log("🔍 Starting Research phase for concept note");

  const { userInputs } = state;
  const researchNotes: ResearchNotes = {};
  const newAssumptions: AssumptionsLog = { assumptions: [] };

  // Apply missing data decision table
  const missingDataHandling = await handleMissingData(state);
  
  if (missingDataHandling.needsIntervention) {
    return {
      needsUserIntervention: true,
      interventionContext: missingDataHandling.interventionContext,
      conceptNoteStage: "research"
    };
  }

  // Add any new assumptions from missing data handling
  if (missingDataHandling.assumptions) {
    newAssumptions.assumptions.push(...missingDataHandling.assumptions);
  }

  // Perform research based on available information
  try {
    // Research best practices for the project type
    if (userInputs?.description) {
      const bestPractices = await researchBestPractices(userInputs.description, config);
      researchNotes.bestPractices = bestPractices;
    }

    // Research similar case studies
    if (userInputs?.title && userInputs?.description) {
      const caseStudies = await researchCaseStudies(userInputs.title, userInputs.description, config);
      researchNotes.casStudies = caseStudies;
    }

    // Research compliance and regulatory considerations
    if (userInputs?.scope) {
      const compliance = await researchCompliance(userInputs.scope, config);
      researchNotes.compliance = compliance;
    }

    // TODO: In future iterations, integrate with ExaSearch and Firecrawl for real web research
    // For now, we'll use placeholder research data
    researchNotes.webFindings = [
      {
        source: "Research Database",
        relevantContent: `Placeholder research findings for ${userInputs?.title || 'the project'}`,
        reliability: "medium"
      }
    ];

  } catch (error) {
    console.error("Research error:", error);
    // Continue with limited research data
    researchNotes.webFindings = [
      {
        source: "Internal Knowledge Base",
        relevantContent: "Basic research completed with available resources",
        reliability: "medium"
      }
    ];
  }

  // Generate research completion message
  const researchMessage = new AIMessage({
    id: `research-${uuidv4()}`,
    content: `🔍 **Research Phase Complete**\n\n` +
             `I've gathered relevant information for your concept note:\n\n` +
             `📚 **Best Practices**: ${researchNotes.bestPractices?.length || 0} practices identified\n` +
             `📋 **Case Studies**: ${researchNotes.casStudies?.length || 0} similar projects found\n` +
             `⚖️ **Compliance**: ${researchNotes.compliance?.length || 0} regulatory considerations\n` +
             `🌐 **Web Research**: ${researchNotes.webFindings?.length || 0} relevant sources found\n\n` +
             `${newAssumptions.assumptions.length > 0 ? `I made ${newAssumptions.assumptions.length} assumptions to fill in missing information.\n\n` : ''}` +
             `Moving to the analysis and computation phase...`
  });

  return {
    researchNotes,
    assumptionsLog: newAssumptions,
    messages: [researchMessage],
    _messages: [researchMessage],
    conceptNoteStage: "compute",
    needsUserIntervention: false
  };
}

/**
 * Handle missing data using the decision table
 */
async function handleMissingData(state: ConceptNoteGraphState): Promise<{
  needsIntervention: boolean;
  interventionContext?: any;
  assumptions?: Array<any>;
}> {
  const { userInputs } = state;
  const assumptions: Array<any> = [];
  
  for (const decision of MISSING_DATA_DECISION_TABLE) {
    const fieldValue = userInputs?.[decision.missingField];
    
    if (!fieldValue || fieldValue === '') {
      switch (decision.decisionAction) {
        case 'prompt_user':
          if (decision.criticalityLevel === 'high') {
            return {
              needsIntervention: true,
              interventionContext: {
                stage: "research",
                reason: "missing_critical_data",
                prompt: decision.userPrompt
              }
            };
          }
          break;
          
        case 'make_assumption':
          assumptions.push({
            id: uuidv4(),
            assumption: `${decision.missingField}: ${decision.defaultValue}`,
            reasoning: decision.assumptionReasoning || `Default assumption for ${decision.missingField}`,
            confidence: decision.criticalityLevel === 'high' ? 'medium' : 'low',
            stage: 'research',
            timestamp: new Date().toISOString()
          });
          
          // Update the user inputs with the default value
          if (userInputs) {
            (userInputs as any)[decision.missingField] = decision.defaultValue;
          }
          break;
          
        case 'skip_section':
          // Log that we're skipping this section
          assumptions.push({
            id: uuidv4(),
            assumption: `Skipping ${decision.missingField} section`,
            reasoning: `No data available for ${decision.missingField} and marked as optional`,
            confidence: 'high',
            stage: 'research',
            timestamp: new Date().toISOString()
          });
          break;
      }
    }
  }

  return {
    needsIntervention: false,
    assumptions: assumptions.length > 0 ? assumptions : undefined
  };
}

/**
 * Research best practices (placeholder implementation)
 */
async function researchBestPractices(description: string, config: LangGraphRunnableConfig): Promise<string[]> {
  // TODO: Implement actual research using web search APIs
  // For now, return placeholder best practices based on keywords
  
  const practices: string[] = [];
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes('education') || lowerDesc.includes('training')) {
    practices.push(
      "Conduct thorough needs assessment before program design",
      "Ensure curriculum aligns with learning objectives",
      "Implement regular evaluation and feedback mechanisms"
    );
  }
  
  if (lowerDesc.includes('technology') || lowerDesc.includes('digital')) {
    practices.push(
      "Follow agile development methodologies",
      "Prioritize user experience and accessibility",
      "Implement robust security and privacy measures"
    );
  }
  
  if (lowerDesc.includes('community') || lowerDesc.includes('social')) {
    practices.push(
      "Engage stakeholders early and often",
      "Ensure cultural sensitivity and inclusivity",
      "Build sustainable partnerships with local organizations"
    );
  }
  
  // Generic best practices
  practices.push(
    "Establish clear success metrics and KPIs",
    "Develop comprehensive risk management strategy",
    "Create detailed implementation timeline with milestones"
  );
  
  return practices;
}

/**
 * Research case studies (placeholder implementation)
 */
async function researchCaseStudies(title: string, description: string, config: LangGraphRunnableConfig): Promise<Array<{
  title: string;
  description: string;
  relevantLessons: string[];
}>> {
  // TODO: Implement actual case study research
  // For now, return placeholder case studies
  
  return [
    {
      title: `Similar Initiative: ${title} Case Study`,
      description: "A comparable project that achieved significant impact through strategic planning and stakeholder engagement.",
      relevantLessons: [
        "Early stakeholder engagement critical for success",
        "Phased implementation reduces risk",
        "Regular monitoring and evaluation essential"
      ]
    },
    {
      title: "Industry Best Practice Example",
      description: "An exemplar project in the same domain demonstrating effective resource utilization.",
      relevantLessons: [
        "Clear communication channels vital",
        "Adequate resource allocation prevents delays",
        "Change management requires dedicated focus"
      ]
    }
  ];
}

/**
 * Research compliance requirements (placeholder implementation)
 */
async function researchCompliance(scope: string, config: LangGraphRunnableConfig): Promise<string[]> {
  // TODO: Implement actual compliance research
  // For now, return placeholder compliance considerations
  
  const compliance: string[] = [];
  const lowerScope = scope.toLowerCase();
  
  if (lowerScope.includes('international') || lowerScope.includes('global')) {
    compliance.push(
      "International data protection regulations (GDPR, etc.)",
      "Cross-border financial reporting requirements",
      "International standards and certifications"
    );
  }
  
  if (lowerScope.includes('national') || lowerScope.includes('federal')) {
    compliance.push(
      "Federal regulatory requirements",
      "National reporting and audit standards",
      "Compliance with national policies and frameworks"
    );
  }
  
  // Generic compliance considerations
  compliance.push(
    "Local permitting and licensing requirements",
    "Environmental impact assessments",
    "Health and safety regulations",
    "Financial reporting and transparency requirements"
  );
  
  return compliance;
}
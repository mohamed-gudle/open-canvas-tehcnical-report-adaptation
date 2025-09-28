import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConceptNoteGraphState, ConceptNoteGraphReturnType, ConceptDraft } from "../../concept-note-state.js";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * Draft Node - Generates the initial concept note structure and content.
 * Uses user inputs, research findings, and derived data to create a comprehensive draft.
 */
export async function draftNode(
  state: ConceptNoteGraphState,
  config: LangGraphRunnableConfig
): Promise<ConceptNoteGraphReturnType> {
  console.log("📝 Starting Draft phase for concept note");

  const { userInputs, researchNotes, derivedData } = state;
  
  try {
    // Generate each section of the concept note
    const conceptDraft: ConceptDraft = {
      executiveSummary: generateExecutiveSummary(userInputs, derivedData),
      problemStatement: generateProblemStatement(userInputs, researchNotes),
      proposedSolution: generateProposedSolution(userInputs, derivedData, researchNotes),
      implementation: generateImplementationPlan(userInputs, derivedData),
      timeline: generateTimelineSection(userInputs, derivedData),
      budget: generateBudgetSection(userInputs, derivedData),
      riskManagement: generateRiskManagement(derivedData),
      expectedOutcomes: generateExpectedOutcomes(userInputs, derivedData),
      version: (state.draft?.version || 0) + 1,
      lastUpdated: new Date().toISOString()
    };

    // Create artifact content for the concept note
    const artifactContent = formatConceptNoteAsMarkdown(conceptDraft, userInputs);

    // Generate draft completion message
    const draftMessage = new AIMessage({
      id: `draft-${uuidv4()}`,
      content: `📝 **Concept Note Draft Complete**\n\n` +
               `I've created a comprehensive concept note with the following sections:\n\n` +
               `✅ Executive Summary\n` +
               `✅ Problem Statement\n` +
               `✅ Proposed Solution\n` +
               `✅ Implementation Plan\n` +
               `✅ Timeline & Budget\n` +
               `✅ Risk Management\n` +
               `✅ Expected Outcomes\n\n` +
               `The draft is ready for your review. You can make edits or request modifications before finalizing.`
    });

    return {
      draft: conceptDraft,
      artifact: {
        currentIndex: 1,
        contents: [
          {
            index: 1,
            type: "text",
            title: userInputs?.title ? `Concept Note: ${userInputs.title}` : "Concept Note",
            fullMarkdown: artifactContent
          }
        ]
      },
      messages: [draftMessage],
      _messages: [draftMessage],
      conceptNoteStage: "review",
      needsUserIntervention: false
    };

  } catch (error) {
    console.error("Draft generation error:", error);
    
    return {
      needsUserIntervention: true,
      interventionContext: {
        stage: "draft",
        reason: "draft_generation_failed",
        prompt: "There was an issue generating the concept note draft. Please provide additional guidance or try again."
      }
    };
  }
}

/**
 * Generate executive summary
 */
function generateExecutiveSummary(userInputs?: any, derivedData?: any): string {
  const title = userInputs?.title || "Untitled Project";
  const description = userInputs?.description || "Project description not provided";
  const keyThemes = derivedData?.keyThemes?.slice(0, 3).join(", ") || "project implementation";
  const targetAudience = userInputs?.targetAudience || "stakeholders";
  
  return `This concept note presents "${title}", a strategic initiative focused on ${keyThemes}. ` +
         `${description.substring(0, 200)}${description.length > 200 ? "..." : ""} ` +
         `The project targets ${targetAudience} and aims to deliver measurable impact through ` +
         `systematic implementation and stakeholder engagement. This initiative addresses critical ` +
         `needs identified through research and analysis, positioning it for successful execution ` +
         `with appropriate resources and support.`;
}

/**
 * Generate problem statement
 */
function generateProblemStatement(userInputs?: any, researchNotes?: any): string {
  const description = userInputs?.description || "";
  const bestPractices = researchNotes?.bestPractices || [];
  
  let problemStatement = "The current situation presents significant challenges that require targeted intervention. ";
  
  if (description) {
    problemStatement += `Based on the project description, key issues include the need for ${description.substring(0, 150)}${description.length > 150 ? "..." : ""}. `;
  }
  
  if (bestPractices.length > 0) {
    problemStatement += "Research indicates that successful initiatives in this area require strategic planning, stakeholder engagement, and systematic implementation. ";
  }
  
  problemStatement += "Without proper intervention, these challenges may persist or worsen, leading to missed opportunities and continued inefficiencies. " +
                     "This concept note proposes a comprehensive approach to address these identified issues through evidence-based solutions.";
  
  return problemStatement;
}

/**
 * Generate proposed solution
 */
function generateProposedSolution(userInputs?: any, derivedData?: any, researchNotes?: any): string {
  const title = userInputs?.title || "this initiative";
  const keyThemes = derivedData?.keyThemes || [];
  const bestPractices = researchNotes?.bestPractices || [];
  
  let solution = `The proposed solution involves implementing ${title} through a comprehensive approach that addresses `;
  
  if (keyThemes.length > 0) {
    solution += `${keyThemes.join(", ").toLowerCase()}. `;
  } else {
    solution += "the identified challenges systematically. ";
  }
  
  solution += "The solution framework includes:\n\n";
  solution += "• **Strategic Planning**: Comprehensive analysis and structured approach to implementation\n";
  solution += "• **Stakeholder Engagement**: Active involvement of all relevant parties throughout the process\n";
  solution += "• **Resource Optimization**: Efficient allocation and utilization of available resources\n";
  solution += "• **Risk Management**: Proactive identification and mitigation of potential challenges\n";
  solution += "• **Monitoring & Evaluation**: Continuous assessment and adaptive management\n\n";
  
  if (bestPractices.length > 0) {
    solution += "This approach incorporates industry best practices including:\n";
    bestPractices.slice(0, 3).forEach(practice => {
      solution += `• ${practice}\n`;
    });
  }
  
  return solution;
}

/**
 * Generate implementation plan
 */
function generateImplementationPlan(userInputs?: any, derivedData?: any): string {
  const resourceNeeds = derivedData?.resourceNeeds || {};
  const stakeholders = derivedData?.stakeholders || [];
  
  let implementation = "The implementation will follow a phased approach to ensure systematic progress and risk mitigation:\n\n";
  
  implementation += "**Phase 1: Preparation and Planning (Months 1-2)**\n";
  implementation += "• Finalize project team and governance structure\n";
  implementation += "• Complete detailed planning and resource allocation\n";
  implementation += "• Establish stakeholder engagement protocols\n";
  implementation += "• Develop monitoring and evaluation framework\n\n";
  
  implementation += "**Phase 2: Initial Implementation (Months 3-6)**\n";
  implementation += "• Launch core activities and processes\n";
  implementation += "• Begin stakeholder engagement activities\n";
  implementation += "• Implement initial monitoring systems\n";
  implementation += "• Conduct regular progress reviews\n\n";
  
  implementation += "**Phase 3: Scale and Optimize (Months 7-12)**\n";
  implementation += "• Expand activities based on initial results\n";
  implementation += "• Optimize processes and address challenges\n";
  implementation += "• Strengthen partnerships and sustainability\n";
  implementation += "• Prepare for project completion and transition\n\n";
  
  if (resourceNeeds.human?.length > 0) {
    implementation += "**Key Personnel Required:**\n";
    resourceNeeds.human.forEach((role: string) => {
      implementation += `• ${role}\n`;
    });
    implementation += "\n";
  }
  
  if (stakeholders.length > 0) {
    implementation += "**Stakeholder Engagement:**\n";
    stakeholders.slice(0, 5).forEach(stakeholder => {
      implementation += `• ${stakeholder}: Regular communication and involvement in key decisions\n`;
    });
  }
  
  return implementation;
}

/**
 * Generate timeline section
 */
function generateTimelineSection(userInputs?: any, derivedData?: any): string {
  const projectTimeline = userInputs?.timeline || "12 months";
  
  let timeline = `**Project Duration**: ${projectTimeline}\n\n`;
  timeline += "**Key Milestones**:\n\n";
  timeline += "• **Month 1**: Project initiation and team setup\n";
  timeline += "• **Month 2**: Detailed planning and stakeholder alignment\n";
  timeline += "• **Month 3**: Launch of core implementation activities\n";
  timeline += "• **Month 6**: Mid-project review and course correction\n";
  timeline += "• **Month 9**: Scale-up and optimization phase\n";
  timeline += "• **Month 12**: Project completion and final evaluation\n\n";
  timeline += "**Critical Dependencies**:\n";
  timeline += "• Timely stakeholder approvals and engagement\n";
  timeline += "• Availability of required resources and personnel\n";
  timeline += "• Resolution of any regulatory or compliance requirements\n";
  
  return timeline;
}

/**
 * Generate budget section
 */
function generateBudgetSection(userInputs?: any, derivedData?: any): string {
  const projectBudget = userInputs?.budget || "Budget to be determined";
  const resourceNeeds = derivedData?.resourceNeeds || {};
  
  let budget = `**Total Project Budget**: ${projectBudget}\n\n`;
  
  if (projectBudget !== "Budget to be determined") {
    budget += "**Budget Breakdown** (Estimated):\n\n";
    budget += "• **Personnel (60%)**: Staff salaries, consultants, and contractor fees\n";
    budget += "• **Operations (25%)**: Day-to-day operational expenses and materials\n";
    budget += "• **Equipment/Technology (10%)**: Required tools, software, and infrastructure\n";
    budget += "• **Contingency (5%)**: Risk mitigation and unexpected costs\n\n";
  } else {
    budget += "**Budget Categories** (To be detailed):\n\n";
    budget += "• Personnel costs for project team and specialists\n";
    budget += "• Operational expenses and materials\n";
    budget += "• Technology and equipment requirements\n";
    budget += "• Administrative and overhead costs\n";
    budget += "• Contingency allocation for risk management\n\n";
  }
  
  budget += "**Funding Sources**:\n";
  budget += "• To be identified based on project requirements\n";
  budget += "• May include grants, organizational funding, or partnerships\n";
  
  return budget;
}

/**
 * Generate risk management section
 */
function generateRiskManagement(derivedData?: any): string {
  const risks = derivedData?.risks || [];
  
  let riskManagement = "**Risk Assessment and Mitigation Strategy**\n\n";
  
  if (risks.length > 0) {
    riskManagement += "**Identified Risks**:\n\n";
    risks.forEach((risk: any, index: number) => {
      riskManagement += `${index + 1}. **${risk.risk}**\n`;
      riskManagement += `   - Impact: ${risk.impact} | Likelihood: ${risk.likelihood}\n`;
      if (risk.mitigation) {
        riskManagement += `   - Mitigation: ${risk.mitigation}\n`;
      }
      riskManagement += "\n";
    });
  }
  
  riskManagement += "**Risk Management Approach**:\n\n";
  riskManagement += "• **Regular Risk Reviews**: Monthly assessment of risk status and mitigation effectiveness\n";
  riskManagement += "• **Contingency Planning**: Prepare alternative approaches for high-impact risks\n";
  riskManagement += "• **Early Warning Systems**: Establish indicators to detect emerging risks\n";
  riskManagement += "• **Stakeholder Communication**: Keep stakeholders informed of risk status and responses\n";
  
  return riskManagement;
}

/**
 * Generate expected outcomes section
 */
function generateExpectedOutcomes(userInputs?: any, derivedData?: any): string {
  const successMetrics = derivedData?.successMetrics || [];
  const keyThemes = derivedData?.keyThemes || [];
  
  let outcomes = "**Expected Project Outcomes**\n\n";
  
  outcomes += "**Primary Outcomes**:\n";
  outcomes += "• Successful completion of all project deliverables within timeline and budget\n";
  outcomes += "• Achievement of stated project objectives and goals\n";
  outcomes += "• Positive stakeholder feedback and satisfaction\n";
  outcomes += "• Sustainable impact beyond project completion\n\n";
  
  if (keyThemes.length > 0) {
    outcomes += "**Thematic Outcomes**:\n";
    keyThemes.forEach(theme => {
      outcomes += `• Measurable progress in ${theme.toLowerCase()}\n`;
    });
    outcomes += "\n";
  }
  
  if (successMetrics.length > 0) {
    outcomes += "**Success Metrics**:\n";
    successMetrics.slice(0, 5).forEach(metric => {
      outcomes += `• ${metric}\n`;
    });
    outcomes += "\n";
  }
  
  outcomes += "**Long-term Impact**:\n";
  outcomes += "• Sustained benefits for target beneficiaries\n";
  outcomes += "• Improved capacity and capabilities within the organization\n";
  outcomes += "• Lessons learned and best practices for future initiatives\n";
  outcomes += "• Enhanced partnerships and stakeholder relationships\n";
  
  return outcomes;
}

/**
 * Format the complete concept note as markdown
 */
function formatConceptNoteAsMarkdown(draft: ConceptDraft, userInputs?: any): string {
  const title = userInputs?.title || "Concept Note";
  const date = new Date().toLocaleDateString();
  
  let markdown = `# ${title}\n\n`;
  markdown += `**Version**: ${draft.version} | **Date**: ${date}\n\n`;
  markdown += `---\n\n`;
  
  if (draft.executiveSummary) {
    markdown += `## Executive Summary\n\n${draft.executiveSummary}\n\n`;
  }
  
  if (draft.problemStatement) {
    markdown += `## Problem Statement\n\n${draft.problemStatement}\n\n`;
  }
  
  if (draft.proposedSolution) {
    markdown += `## Proposed Solution\n\n${draft.proposedSolution}\n\n`;
  }
  
  if (draft.implementation) {
    markdown += `## Implementation Plan\n\n${draft.implementation}\n\n`;
  }
  
  if (draft.timeline) {
    markdown += `## Timeline\n\n${draft.timeline}\n\n`;
  }
  
  if (draft.budget) {
    markdown += `## Budget\n\n${draft.budget}\n\n`;
  }
  
  if (draft.riskManagement) {
    markdown += `## Risk Management\n\n${draft.riskManagement}\n\n`;
  }
  
  if (draft.expectedOutcomes) {
    markdown += `## Expected Outcomes\n\n${draft.expectedOutcomes}\n\n`;
  }
  
  markdown += `---\n\n`;
  markdown += `*This concept note was generated using the Open Canvas Concept Note Builder*\n`;
  
  return markdown;
}
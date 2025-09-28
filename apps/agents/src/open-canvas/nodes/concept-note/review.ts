import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConceptNoteGraphState, ConceptNoteGraphReturnType, ConceptDraft, TodoItems } from "../../concept-note-state.js";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * Review Node - Validates and refines the concept note draft.
 * Performs quality checks and suggests improvements before finalization.
 */
export async function reviewNode(
  state: ConceptNoteGraphState,
  _config: LangGraphRunnableConfig
): Promise<ConceptNoteGraphReturnType> {
  console.log("🔍 Starting Review phase for concept note");

  const { draft, userInputs, derivedData, researchNotes } = state;
  
  if (!draft) {
    return {
      needsUserIntervention: true,
      interventionContext: {
        stage: "review",
        reason: "no_draft_available",
        prompt: "No draft is available for review. Please generate a draft first."
      }
    };
  }

  try {
    // Perform comprehensive review
    const reviewResults = await performQualityReview(draft, userInputs, derivedData, researchNotes);
    
    // Generate review todos if issues found
    const reviewTodos: TodoItems = { items: [] };
    
    if (reviewResults.issues.length > 0) {
      reviewResults.issues.forEach((issue) => {
        reviewTodos.items.push({
          id: uuidv4(),
          task: `Address review issue: ${issue.description}`,
          priority: issue.severity,
          stage: "review",
          status: "pending",
          assignedTo: "Review team"
        });
      });
    }

    // Determine if human intervention is needed
    const criticalIssues = reviewResults.issues.filter(issue => issue.severity === "high");
    
    if (criticalIssues.length > 0) {
      return {
        todos: reviewTodos,
        needsUserIntervention: true,
        interventionContext: {
          stage: "review",
          reason: "critical_issues_found",
          prompt: `The concept note review identified ${criticalIssues.length} critical issues that need your attention:\n\n` +
                 criticalIssues.map(issue => `• ${issue.description}`).join('\n') +
                 `\n\nWould you like to address these issues or proceed with export?`,
          options: ["Address issues", "Proceed with export", "Revise draft"]
        },
        conceptNoteStage: "review"
      };
    }

    // Create updated draft with review improvements if any
    let updatedDraft = draft;
    if (reviewResults.improvements.length > 0) {
      updatedDraft = await applyAutomaticImprovements(draft, reviewResults.improvements);
    }

    // Generate review completion message
    const reviewMessage = new AIMessage({
      id: `review-${uuidv4()}`,
      content: generateReviewMessage(reviewResults, updatedDraft)
    });

    return {
      draft: updatedDraft,
      todos: reviewTodos,
      messages: [reviewMessage],
      _messages: [reviewMessage],
      conceptNoteStage: "export",
      needsUserIntervention: false
    };

  } catch (error) {
    console.error("Review error:", error);
    
    return {
      needsUserIntervention: true,
      interventionContext: {
        stage: "review",
        reason: "review_failed",
        prompt: "There was an issue during the review process. Please try again or proceed to export."
      }
    };
  }
}

/**
 * Perform comprehensive quality review of the concept note
 */
async function performQualityReview(
  draft: ConceptDraft,
  userInputs?: any,
  derivedData?: any,
  researchNotes?: any
): Promise<{
  score: number;
  issues: Array<{ description: string; severity: "low" | "medium" | "high"; section: string }>;
  improvements: Array<{ type: string; description: string; section: string }>;
  completeness: number;
}> {
  const issues: Array<{ description: string; severity: "low" | "medium" | "high"; section: string }> = [];
  const improvements: Array<{ type: string; description: string; section: string }> = [];
  let completeness = 0;
  const totalSections = 8;

  // Check completeness of all sections
  const sections = [
    { name: "executiveSummary", content: draft.executiveSummary },
    { name: "problemStatement", content: draft.problemStatement },
    { name: "proposedSolution", content: draft.proposedSolution },
    { name: "implementation", content: draft.implementation },
    { name: "timeline", content: draft.timeline },
    { name: "budget", content: draft.budget },
    { name: "riskManagement", content: draft.riskManagement },
    { name: "expectedOutcomes", content: draft.expectedOutcomes }
  ];

  sections.forEach(section => {
    if (section.content && section.content.trim().length > 0) {
      completeness++;
      
      // Check section quality
      if (section.content.length < 100) {
        issues.push({
          description: `${section.name} section is too brief and may lack detail`,
          severity: "medium",
          section: section.name
        });
      }
      
      if (section.content.includes("To be determined") || section.content.includes("Not provided")) {
        issues.push({
          description: `${section.name} contains placeholder text that should be refined`,
          severity: "low",
          section: section.name
        });
      }
    } else {
      issues.push({
        description: `${section.name} section is missing or empty`,
        severity: "high",
        section: section.name
      });
    }
  });

  // Check alignment with user inputs
  if (userInputs?.title && draft.executiveSummary && !draft.executiveSummary.toLowerCase().includes(userInputs.title.toLowerCase())) {
    improvements.push({
      type: "alignment",
      description: "Ensure project title is prominently featured in executive summary",
      section: "executiveSummary"
    });
  }

  // Check for research integration
  if (researchNotes?.bestPractices?.length > 0) {
    const hasBestPractices = draft.proposedSolution?.includes("best practice") || 
                            draft.implementation?.includes("best practice");
    if (!hasBestPractices) {
      improvements.push({
        type: "research_integration",
        description: "Consider incorporating identified best practices into the solution or implementation",
        section: "proposedSolution"
      });
    }
  }

  // Check risk-budget alignment
  if (draft.riskManagement && draft.budget) {
    const hasFinancialRisk = draft.riskManagement.toLowerCase().includes("budget") || 
                            draft.riskManagement.toLowerCase().includes("financial");
    const hasBudgetDetails = draft.budget.includes("Budget to be determined");
    
    if (!hasFinancialRisk && hasBudgetDetails) {
      issues.push({
        description: "Consider addressing budget uncertainty as a financial risk",
        severity: "medium",
        section: "riskManagement"
      });
    }
  }

  // Check stakeholder integration
  if (derivedData?.stakeholders?.length > 0) {
    const stakeholderMentions = draft.implementation?.toLowerCase().includes("stakeholder") || false;
    if (!stakeholderMentions) {
      improvements.push({
        type: "stakeholder_integration",
        description: "Consider explicitly mentioning stakeholder engagement in implementation plan",
        section: "implementation"
      });
    }
  }

  // Calculate overall quality score
  const completenessScore = (completeness / totalSections) * 100;
  const issueScore = Math.max(0, 100 - (issues.length * 10));
  const qualityScore = (completenessScore + issueScore) / 2;

  return {
    score: qualityScore,
    issues,
    improvements,
    completeness: completenessScore
  };
}

/**
 * Apply automatic improvements that don't require user intervention
 */
async function applyAutomaticImprovements(
  draft: ConceptDraft,
  _improvements: Array<{ type: string; description: string; section: string }>
): Promise<ConceptDraft> {
  // Apply minor formatting and text improvements
  // improvements.forEach(improvement => {
  //   if (improvement.type === "formatting" && improvement.section in updatedDraft) {
  //     // Apply formatting improvements (placeholder for actual implementation)
  //     const currentContent = (updatedDraft as any)[improvement.section];
  //     if (currentContent) {
  //       (updatedDraft as any)[improvement.section] = currentContent;
  //     }
  //   }
  // });

  // Update version and timestamp
  const updatedDraft = { ...draft, version: draft.version + 0.1, lastUpdated: new Date().toISOString() };

  return updatedDraft;
}

/**
 * Generate review completion message
 */
function generateReviewMessage(
  reviewResults: { 
    score: number; 
    issues: Array<any>; 
    improvements: Array<any>; 
    completeness: number; 
  },
  _draft: ConceptDraft
): string {
  let message = `🔍 **Concept Note Review Complete**\n\n`;
  
  message += `**Quality Score**: ${Math.round(reviewResults.score)}/100\n`;
  message += `**Completeness**: ${Math.round(reviewResults.completeness)}%\n\n`;
  
  if (reviewResults.issues.length === 0) {
    message += `✅ **Excellent!** No critical issues found. Your concept note is ready for export.\n\n`;
  } else {
    const criticalIssues = reviewResults.issues.filter(issue => issue.severity === "high").length;
    const moderateIssues = reviewResults.issues.filter(issue => issue.severity === "medium").length;
    const minorIssues = reviewResults.issues.filter(issue => issue.severity === "low").length;
    
    message += `**Issues Identified**:\n`;
    if (criticalIssues > 0) message += `🔴 Critical: ${criticalIssues}\n`;
    if (moderateIssues > 0) message += `🟡 Moderate: ${moderateIssues}\n`;
    if (minorIssues > 0) message += `🟢 Minor: ${minorIssues}\n`;
    message += `\n`;
  }
  
  if (reviewResults.improvements.length > 0) {
    message += `**Improvement Suggestions**: ${reviewResults.improvements.length} recommendations for enhancement\n\n`;
  }
  
  message += `The concept note is now ready for export in your preferred format.`;
  
  return message;
}
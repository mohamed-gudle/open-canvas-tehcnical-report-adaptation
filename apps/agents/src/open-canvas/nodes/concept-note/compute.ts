import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { ConceptNoteGraphState, ConceptNoteGraphReturnType, DerivedData, TodoItems } from "../../concept-note-state.js";
import { AIMessage } from "@langchain/core/messages";
import { v4 as uuidv4 } from "uuid";

/**
 * Compute Node - Processes and analyzes collected data to derive insights for the concept note.
 * Transforms user inputs and research findings into structured data for drafting.
 */
export async function computeNode(
  state: ConceptNoteGraphState,
  _config: LangGraphRunnableConfig
): Promise<ConceptNoteGraphReturnType> {
  console.log("⚙️ Starting Compute phase for concept note");

  const { userInputs, researchNotes } = state;
  void config;
  
  // Perform computational analysis and derive key insights
  const derivedData: DerivedData = {};
  const todos: TodoItems = { items: [] };

  try {
    // Extract key themes from description and research
    derivedData.keyThemes = extractKeyThemes(userInputs?.description, researchNotes);
    
    // Identify stakeholders
    derivedData.stakeholders = identifyStakeholders(userInputs, researchNotes);
    
    // Perform risk assessment
    derivedData.risks = assessRisks(userInputs, researchNotes);
    
    // Define success metrics
    derivedData.successMetrics = defineSuccessMetrics(userInputs, derivedData.keyThemes);
    
    // Analyze resource needs
    derivedData.resourceNeeds = analyzeResourceNeeds(userInputs, derivedData.stakeholders);
    
    // Generate todo items for areas needing attention
    todos.items = generateTodoItems(userInputs, derivedData);

  } catch (error) {
    console.error("Compute error:", error);
    
    // Return with minimal derived data if computation fails
    derivedData.keyThemes = ["Project implementation", "Stakeholder engagement"];
    derivedData.stakeholders = ["Primary beneficiaries", "Project team"];
    derivedData.risks = [{
      risk: "Implementation challenges",
      impact: "medium",
      likelihood: "medium",
      mitigation: "Regular monitoring and adaptive management"
    }];
  }

  // Generate compute completion message
  const computeMessage = new AIMessage({
    id: `compute-${uuidv4()}`,
    content: `⚙️ **Analysis Complete**\n\n` +
             `I've analyzed your project and derived key insights:\n\n` +
             `🎯 **Key Themes**: ${derivedData.keyThemes?.join(', ') || 'None identified'}\n` +
             `👥 **Stakeholders**: ${derivedData.stakeholders?.length || 0} groups identified\n` +
             `⚠️ **Risks**: ${derivedData.risks?.length || 0} risks assessed\n` +
             `📊 **Success Metrics**: ${derivedData.successMetrics?.length || 0} KPIs defined\n` +
             `📋 **Action Items**: ${todos.items.length} items require attention\n\n` +
             `Ready to draft your concept note with this structured analysis...`
  });

  return {
    derivedData,
    todos,
    messages: [computeMessage],
    _messages: [computeMessage],
    conceptNoteStage: "draft",
    needsUserIntervention: false
  };
}

/**
 * Extract key themes from project description and research
 */
function extractKeyThemes(description?: string, _researchNotes?: any): string[] {
  const themes: string[] = [];
  
  if (!description) return ["Project implementation"];
  
  const lowerDesc = description.toLowerCase();
  
  // Technology themes
  if (lowerDesc.includes('technology') || lowerDesc.includes('digital') || lowerDesc.includes('software')) {
    themes.push("Technology implementation", "Digital transformation");
  }
  
  // Education themes
  if (lowerDesc.includes('education') || lowerDesc.includes('training') || lowerDesc.includes('learning')) {
    themes.push("Capacity building", "Knowledge transfer");
  }
  
  // Community themes
  if (lowerDesc.includes('community') || lowerDesc.includes('social') || lowerDesc.includes('local')) {
    themes.push("Community engagement", "Social impact");
  }
  
  // Health themes
  if (lowerDesc.includes('health') || lowerDesc.includes('medical') || lowerDesc.includes('wellness')) {
    themes.push("Health outcomes", "Public health");
  }
  
  // Environment themes
  if (lowerDesc.includes('environment') || lowerDesc.includes('sustainability') || lowerDesc.includes('green')) {
    themes.push("Environmental sustainability", "Climate action");
  }
  
  // Economic themes
  if (lowerDesc.includes('economic') || lowerDesc.includes('business') || lowerDesc.includes('income')) {
    themes.push("Economic development", "Financial sustainability");
  }
  
  if (researchNotes?.webFindings?.length) {
    const findingsText = researchNotes.webFindings
      .map((item: any) => item.relevantContent?.toLowerCase?.() || "")
      .join(" ");
    if (findingsText.includes("policy")) {
      themes.push("Policy alignment");
    }
    if (findingsText.includes("innovation")) {
      themes.push("Innovation enablement");
    }
  }

  // Generic themes if none specific found
  if (themes.length === 0) {
    themes.push("Project implementation", "Stakeholder engagement", "Impact measurement");
  }
  
  return [...new Set(themes)];
}

/**
 * Identify project stakeholders
 */
function identifyStakeholders(userInputs?: any, _researchNotes?: any): string[] {
  const stakeholders: string[] = [];
  
  // Always include basic stakeholders
  stakeholders.push("Project team", "Project beneficiaries");
  
  if (userInputs?.targetAudience) {
    stakeholders.push(userInputs.targetAudience);
  }

  if (researchNotes?.casStudies?.length) {
    stakeholders.push("Industry partners", "Subject matter experts");
  }

  if (researchNotes?.compliance?.length) {
    stakeholders.push("Regulatory bodies", "Compliance advisors");
  }
  
  // Add stakeholders based on scope
  if (userInputs?.scope) {
    const scope = userInputs.scope.toLowerCase();
    if (scope.includes('government') || scope.includes('national')) {
      stakeholders.push("Government agencies", "Policy makers");
    }
    if (scope.includes('community') || scope.includes('local')) {
      stakeholders.push("Community leaders", "Local organizations");
    }
    if (scope.includes('international') || scope.includes('global')) {
      stakeholders.push("International partners", "Donor organizations");
    }
  }
  
  // Add domain-specific stakeholders
  if (userInputs?.description) {
    const desc = userInputs.description.toLowerCase();
    if (desc.includes('education')) {
      stakeholders.push("Students", "Teachers", "Educational institutions");
    }
    if (desc.includes('health')) {
      stakeholders.push("Healthcare providers", "Patients", "Health authorities");
    }
    if (desc.includes('business') || desc.includes('economic')) {
      stakeholders.push("Business community", "Investors", "Economic partners");
    }
  }
  
  // Remove duplicates
  const uniqueStakeholders: string[] = [];
  stakeholders.forEach(stakeholder => {
    if (uniqueStakeholders.indexOf(stakeholder) === -1) {
      uniqueStakeholders.push(stakeholder);
    }
  });
  return uniqueStakeholders;
}

/**
 * Assess project risks
 */
function assessRisks(userInputs?: any, _researchNotes?: any): Array<{
  risk: string;
  impact: "low" | "medium" | "high";
  likelihood: "low" | "medium" | "high";
  mitigation?: string;
}> {
  const risks = [];
  
  // Budget-related risks
  if (!userInputs?.budget || userInputs.budget === 'To be determined') {
    risks.push({
      risk: "Inadequate funding or budget uncertainty",
      impact: "high" as const,
      likelihood: "medium" as const,
      mitigation: "Conduct detailed cost analysis and secure funding commitments early"
    });
  }
  
  // Timeline risks
  if (!userInputs?.timeline || userInputs.timeline === 'To be determined') {
    risks.push({
      risk: "Unrealistic timeline or scope creep",  
      impact: "medium" as const,
      likelihood: "medium" as const,
      mitigation: "Develop detailed project schedule with buffer time and regular milestone reviews"
    });
  }
  
  // Stakeholder risks
  risks.push({
    risk: "Limited stakeholder buy-in or engagement",
    impact: "high" as const,
    likelihood: "medium" as const,
    mitigation: "Implement comprehensive stakeholder engagement strategy from project onset"
  });
  
  // Technical risks
  if (userInputs?.description?.toLowerCase().includes('technology')) {
    risks.push({
      risk: "Technical implementation challenges or system compatibility issues",
      impact: "medium" as const,
      likelihood: "medium" as const,
      mitigation: "Conduct thorough technical assessment and pilot testing"
    });
  }
  
  // Regulatory risks
  if (researchNotes?.compliance?.length) {
    risks.push({
      risk: "Regulatory or compliance challenges",
      impact: "medium" as const,
      likelihood: "low" as const,
      mitigation: "Early engagement with regulatory bodies and compliance review"
    });
  } else {
    risks.push({
      risk: "Regulatory or compliance challenges",
      impact: "medium" as const,
      likelihood: "low" as const,
      mitigation: "Early engagement with regulatory bodies and compliance review"
    });
  }

  if (researchNotes?.webFindings?.some((finding: any) => finding.relevantContent?.toLowerCase().includes('supply chain'))) {
    risks.push({
      risk: "Supply chain disruptions or vendor delays",
      impact: "medium" as const,
      likelihood: "medium" as const,
      mitigation: "Qualify multiple vendors and maintain contingency inventory"
    });
  }
  
  return risks;
}

/**
 * Define success metrics and KPIs
 */
function defineSuccessMetrics(userInputs?: any, keyThemes?: string[]): string[] {
  const metrics: string[] = [];
  
  // Generic project metrics
  metrics.push(
    "Project completion within timeline and budget",
    "Stakeholder satisfaction scores",
    "Achievement of stated objectives"
  );
  
  // Theme-specific metrics
  if (keyThemes?.includes("Technology implementation")) {
    metrics.push("System uptime and performance metrics", "User adoption rates");
  }
  
  if (keyThemes?.includes("Community engagement")) {
    metrics.push("Community participation rates", "Feedback and satisfaction scores");
  }
  
  if (keyThemes?.includes("Capacity building")) {
    metrics.push("Training completion rates", "Skills assessment improvements");
  }
  
  if (keyThemes?.includes("Environmental sustainability")) {
    metrics.push("Environmental impact reduction", "Sustainability compliance metrics");
  }
  
  // Domain-specific metrics based on description
  if (userInputs?.description) {
    const desc = userInputs.description.toLowerCase();
    if (desc.includes('education')) {
      metrics.push("Learning outcome improvements", "Enrollment and retention rates");
    }
    if (desc.includes('health')) {
      metrics.push("Health outcome indicators", "Service delivery quality metrics");
    }
    if (desc.includes('economic')) {
      metrics.push("Economic impact measurements", "ROI and cost-benefit ratios");
    }
  }
  
  return metrics;
}

/**
 * Analyze resource requirements
 */
function analyzeResourceNeeds(userInputs?: any, stakeholders?: string[]): {
  human?: string[];
  technical?: string[];
  financial?: string;
} {
  const resourceNeeds: any = {};
  
  // Human resources
  resourceNeeds.human = ["Project manager", "Subject matter experts"];
  
  if (stakeholders?.includes("Community leaders")) {
    resourceNeeds.human.push("Community liaison officer");
  }
  
  if (userInputs?.description?.toLowerCase().includes('technology')) {
    resourceNeeds.human.push("Technical specialists", "IT support staff");
  }
  
  // Technical resources
  resourceNeeds.technical = ["Project management tools", "Communication platforms"];
  
  if (userInputs?.description?.toLowerCase().includes('digital')) {
    resourceNeeds.technical.push("Development environment", "Hosting infrastructure");
  }
  
  // Financial resources
  resourceNeeds.financial = userInputs?.budget || "Budget to be determined based on detailed costing";
  
  return resourceNeeds;
}

/**
 * Generate todo items for project planning
 */
function generateTodoItems(userInputs?: any, _derivedData?: DerivedData): Array<{
  id: string;
  task: string;
  priority: "low" | "medium" | "high";
  stage: "research" | "analysis" | "drafting" | "review" | "finalization";
  assignedTo?: string;
  dueDate?: string;
  status: "pending" | "in-progress" | "completed";
}> {
  const todos = [];
  
  // High priority items
  if (!userInputs?.budget || userInputs.budget === 'To be determined') {
    todos.push({
      id: uuidv4(),
      task: "Develop detailed budget and funding plan",
      priority: "high" as const,
      stage: "analysis" as const,
      status: "pending" as const
    });
  }
  
  if (!userInputs?.timeline || userInputs.timeline === 'To be determined') {
    todos.push({
      id: uuidv4(),
      task: "Create detailed project timeline with milestones",
      priority: "high" as const,
      stage: "analysis" as const,
      status: "pending" as const
    });
  }
  
  // Medium priority items
  todos.push({
    id: uuidv4(),
    task: "Conduct stakeholder mapping and engagement plan",
    priority: "medium" as const,
    stage: "analysis" as const,
    status: "pending" as const
  });
  
  todos.push({
    id: uuidv4(),
    task: "Develop risk mitigation strategies",
    priority: "medium" as const,
    stage: "analysis" as const,
    status: "pending" as const
  });
  
  if (derivedData?.risks?.length) {
    todos.push({
      id: uuidv4(),
      task: "Review identified risks with project stakeholders",
      priority: "medium" as const,
      stage: "review" as const,
      status: "pending" as const
    });
  }

  if (derivedData?.resourceNeeds?.human?.length) {
    todos.push({
      id: uuidv4(),
      task: "Validate resource assignments for critical roles",
      priority: "medium" as const,
      stage: "analysis" as const,
      status: "pending" as const
    });
  }

  // Low priority items
  todos.push({
    id: uuidv4(),
    task: "Design monitoring and evaluation framework",
    priority: "low" as const,
    stage: "drafting" as const,
    status: "pending" as const
  });
  
  return todos;
}

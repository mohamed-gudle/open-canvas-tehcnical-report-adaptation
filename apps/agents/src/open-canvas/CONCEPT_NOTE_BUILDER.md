# Guided Concept Note Builder Graph

## Overview

The Guided Concept Note Builder is a LangGraph-based pipeline that interviews users, persists shared state, and supports Human-in-the-Loop (HITL) interrupts to generate comprehensive concept notes through a structured workflow.

## Architecture

### State Management

The concept note builder extends the base `OpenCanvasGraphAnnotation` with specialized state channels:

```typescript
// Core state channels
userInputs: UserInputs           // Project requirements and preferences
derivedData: DerivedData         // Processed insights and analysis
assumptionsLog: AssumptionsLog   // Tracked assumptions with reasoning
researchNotes: ResearchNotes     // External research and findings
draft: ConceptDraft              // Generated concept note content
todos: TodoItems                 // Outstanding tasks and action items
citations: Citations             // References and sources
```

### Pipeline Stages

The pipeline consists of six core stages with HITL interrupt capabilities:

1. **User Intake** → 2. **Research** → 3. **Compute** → 4. **Draft** → 5. **Review** → 6. **Export**

## Core Components

### 1. User Intake Node (`user-intake.ts`)

**Purpose**: Collects user requirements and preferences for concept note generation.

**Key Features**:
- Extracts project information from user messages
- Validates critical fields (title, description)
- Triggers HITL interventions for missing information
- Uses pattern matching to parse user inputs

**Read/Write Contracts**:
- **Reads**: `_messages`, `messages`
- **Writes**: `userInputs`, `conceptNoteStage`, `needsUserIntervention`, `interventionContext`

### 2. Research Node (`research.ts`)

**Purpose**: Gathers additional context and applies missing data decision table logic.

**Key Features**:
- Implements decision table for handling missing data
- Placeholder for future ExaSearch/Firecrawl integration
- Generates assumptions log with reasoning
- Researches best practices and case studies

**Decision Table Logic**:
```typescript
const MISSING_DATA_DECISION_TABLE: MissingDataDecision[] = [
  {
    missingField: "title",
    decisionAction: "prompt_user",     // High criticality
    userPrompt: "Please provide a title for your concept note.",
    criticalityLevel: "high"
  },
  {
    missingField: "targetAudience", 
    decisionAction: "make_assumption", // Medium criticality
    defaultValue: "General stakeholders",
    assumptionReasoning: "Assuming general stakeholder audience when not specified",
    criticalityLevel: "medium"
  }
  // ... more decision rules
];
```

**Read/Write Contracts**:
- **Reads**: `userInputs`
- **Writes**: `researchNotes`, `assumptionsLog`, `conceptNoteStage`

### 3. Compute Node (`compute.ts`)

**Purpose**: Processes and analyzes collected data to derive insights.

**Analysis Functions**:
- `extractKeyThemes()` - Identifies project themes from description
- `identifyStakeholders()` - Maps stakeholder groups
- `assessRisks()` - Evaluates project risks with impact/likelihood
- `defineSuccessMetrics()` - Establishes KPIs
- `analyzeResourceNeeds()` - Determines resource requirements

**Read/Write Contracts**:
- **Reads**: `userInputs`, `researchNotes`
- **Writes**: `derivedData`, `todos`, `conceptNoteStage`

### 4. Draft Node (`draft.ts`)

**Purpose**: Generates initial concept note structure and content.

**Generated Sections**:
- Executive Summary
- Problem Statement  
- Proposed Solution
- Implementation Plan
- Timeline & Budget
- Risk Management
- Expected Outcomes

**Content Generation Strategy**:
- Uses template-based approach with dynamic content
- Integrates user inputs, research findings, and derived data
- Creates structured markdown artifact
- Maintains version history

**Read/Write Contracts**:
- **Reads**: `userInputs`, `researchNotes`, `derivedData`
- **Writes**: `draft`, `artifact`, `conceptNoteStage`

### 5. Review Node (`review.ts`)

**Purpose**: Validates and refines the concept note draft.

**Quality Assessment**:
- Completeness check (8 required sections)
- Content quality validation
- Alignment verification with user inputs
- Research integration assessment

**Review Scoring**:
```typescript
interface ReviewResults {
  score: number;           // Overall quality score (0-100)
  completeness: number;    // Section completeness percentage
  issues: Array<{          // Identified issues
    description: string;
    severity: "low" | "medium" | "high";
    section: string;
  }>;
  improvements: Array<{    // Improvement suggestions
    type: string;
    description: string;
    section: string;
  }>;
}
```

**Read/Write Contracts**:
- **Reads**: `draft`, `userInputs`, `derivedData`, `researchNotes`
- **Writes**: `todos`, `conceptNoteStage`, `needsUserIntervention`

### 6. Export Node (`export.ts`)

**Purpose**: Finalizes concept note and prepares for delivery.

**Export Features**:
- Multiple format support (markdown, future: PDF, DOCX)
- Length variants (brief, standard, detailed)
- Appendices for detailed version
- Final artifact generation

**Read/Write Contracts**:
- **Reads**: All state channels for comprehensive export
- **Writes**: `artifact`, `conceptNoteStage`

## HITL Interrupt Points

### Pre-Node Interrupts
- **Before Research**: Allow user to refine inputs
- **Before Draft**: Validate analysis results
- **Before Review**: Confirm draft approach
- **Before Export**: Final approval

### Post-Node Interrupts  
- **After User Intake**: Verify captured requirements
- **After Compute**: Review derived insights

### Intervention Handling

```typescript
interface InterventionContext {
  stage: string;           // Current pipeline stage
  reason: string;          // Why intervention is needed
  prompt?: string;         // Message to display to user
  options?: string[];      // Available user options
}
```

## Integration with Open Canvas

### Routing Integration

The concept note builder integrates with the main open-canvas graph through the `generatePath` node:

```typescript
// In generate-path/index.ts
if (isConceptNoteRequest(messageContent)) {
  return {
    next: "conceptNoteAction",
    // ... message handling
  };
}
```

### Quick Action Support

Built-in quick action configuration:
```typescript
export const CONCEPT_NOTE_QUICK_ACTION = {
  id: "generate-concept-note-builtin",
  title: "Generate Concept Note", 
  prompt: "I'd like to create a comprehensive concept note using the guided concept note builder",
  includeReflections: false,
  includePrefix: false,
  includeRecentHistory: true
};
```

## Usage Examples

### Basic Usage
```typescript
// Create concept note input
const input = createConceptNoteInput(
  "Create a concept note for a digital literacy program for seniors"
);

// Execute the graph
const result = await conceptNoteGraph.invoke(input, config);
```

### Resuming After Intervention
```typescript
// Resume after user provides additional information
const updates = resumeConceptNoteGeneration(
  currentState,
  "The program will target 500 seniors in rural communities",
  { targetAudience: "Seniors in rural communities", scope: "Rural/Regional" }
);

const result = await conceptNoteGraph.invoke(updates, config);
```

## State Persistence

The graph leverages LangGraph's built-in checkpointing and thread management:

- **Thread IDs**: Each concept note generation creates a separate thread
- **State Persistence**: All channels persist across interrupts
- **Version Tracking**: Draft versions tracked with timestamps
- **Assumption Logging**: Full audit trail of decisions made

## Future Enhancements

### Planned Integrations
1. **ExaSearch Integration**: Real web research capabilities
2. **Firecrawl Integration**: Document processing and analysis
3. **Multi-Document Workflows**: Generate related documents
4. **Advanced Templates**: Domain-specific concept note templates

### Supervisor Routing
Future iterations will include supervisor routing for:
- Multi-document generation workflows
- Parallel processing of sections
- Quality assurance routing
- Expert review integration

## Error Handling

The implementation includes comprehensive error handling:

- **Graceful Degradation**: Continue with limited data when possible
- **User Guidance**: Clear error messages and recovery suggestions  
- **State Recovery**: Maintain progress through errors
- **Logging**: Comprehensive logging for debugging

## Testing Strategy

### Unit Testing
- Individual node function testing
- State transformation validation
- Decision table logic verification

### Integration Testing  
- End-to-end pipeline execution
- HITL interrupt flow testing
- State persistence validation

### Evaluation Framework
Future evaluation using the existing `packages/evals` framework:
- Quality assessment metrics
- User satisfaction scoring
- Output completeness validation

---

## Quick Start

To trigger the concept note builder, send a message containing concept note keywords:
- "concept note"
- "project proposal" 
- "generate concept note"
- "create concept note"

The system will automatically route to the concept note builder pipeline and guide you through the structured generation process.
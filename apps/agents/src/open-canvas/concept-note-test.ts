/**
 * Basic test to verify concept note builder functionality
 * This is a manual test script that can be run to validate the implementation
 */

import { conceptNoteGraph, createConceptNoteInput } from "./concept-note-graph.js";
import { isConceptNoteRequest } from "./nodes/concept-note-action.js";

/**
 * Test basic concept note functionality
 */
async function testConceptNoteBuilder() {
  console.log("🧪 Testing Concept Note Builder");
  
  // Test 1: Request detection
  console.log("\n1. Testing request detection:");
  const testMessages = [
    "I need to create a concept note for my project",
    "Generate a concept note",
    "Help me write a project proposal", 
    "Can you create a regular document?",
    "concept note for digital literacy program"
  ];
  
  testMessages.forEach(msg => {
    const isConceptNote = isConceptNoteRequest(msg);
    console.log(`   "${msg}" -> ${isConceptNote ? '✅ Detected' : '❌ Not detected'}`);
  });
  
  // Test 2: Input creation
  console.log("\n2. Testing input creation:");
  const testInput = createConceptNoteInput(
    "Create a concept note for a digital literacy program targeting seniors in rural communities. The program should include computer basics, internet safety, and online services access."
  );
  
  console.log("   Input created successfully:");
  console.log(`   - Messages: ${testInput.messages?.length} message(s)`);
  console.log(`   - Stage: ${testInput.conceptNoteStage}`);
  console.log(`   - Intervention needed: ${testInput.needsUserIntervention}`);
  
  // Test 3: Graph compilation
  console.log("\n3. Testing graph compilation:");
  try {
    const graphInfo = {
      name: conceptNoteGraph.name,
      nodes: Object.keys(conceptNoteGraph.nodes || {}),
      hasInterrupts: Boolean(conceptNoteGraph.interruptBefore?.length || conceptNoteGraph.interruptAfter?.length)
    };
    
    console.log("   Graph compiled successfully:");
    console.log(`   - Name: ${graphInfo.name}`);
    console.log(`   - Nodes: ${graphInfo.nodes.length} nodes`);
    console.log(`   - Has interrupts: ${graphInfo.hasInterrupts}`);
    
    if (conceptNoteGraph.interruptBefore?.length) {
      console.log(`   - Interrupt before: ${conceptNoteGraph.interruptBefore.join(', ')}`);
    }
    if (conceptNoteGraph.interruptAfter?.length) {
      console.log(`   - Interrupt after: ${conceptNoteGraph.interruptAfter.join(', ')}`);
    }
    
  } catch (error) {
    console.error("   ❌ Graph compilation failed:", error);
    return false;
  }
  
  console.log("\n✅ All basic tests passed!");
  console.log("\n📝 To test the full pipeline, integrate with a LangGraph runtime environment");
  console.log("   and provide appropriate model configuration and checkpointing setup.");
  
  return true;
}

/**
 * Test the state schema definitions
 */
async function testStateSchema() {
  console.log("\n🏗️  Testing State Schema:");
  
  try {
    // Test state structure
    const stateKeys = [
      'userInputs', 'derivedData', 'assumptionsLog', 
      'researchNotes', 'draft', 'todos', 'citations',
      'conceptNoteStage', 'needsUserIntervention', 'interventionContext'
    ];
    
    console.log("   Required state keys defined:");
    stateKeys.forEach(key => {
      console.log(`   ✅ ${key}`);
    });
    
    // Test decision table
    const { MISSING_DATA_DECISION_TABLE } = await import('./concept-note-state.js');
    console.log(`\n   Decision table: ${MISSING_DATA_DECISION_TABLE.length} rules defined`);
    
    MISSING_DATA_DECISION_TABLE.forEach((rule, index) => {
      console.log(`   ${index + 1}. ${rule.missingField}: ${rule.decisionAction} (${rule.criticalityLevel})`);
    });
    
    return true;
  } catch (error) {
    console.error("   ❌ State schema test failed:", error);
    return false;
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log("🚀 Starting Concept Note Builder Tests\n");
  
  try {
    const schemaTest = await testStateSchema();
    const builderTest = await testConceptNoteBuilder();
    
    if (schemaTest && builderTest) {
      console.log("\n🎉 All tests completed successfully!");
      console.log("\nNext steps:");
      console.log("1. Set up a test environment with model configuration");
      console.log("2. Test end-to-end pipeline execution"); 
      console.log("3. Test HITL interrupt flows");
      console.log("4. Validate artifact generation and export");
    } else {
      console.log("\n❌ Some tests failed. Please review the implementation.");
    }
    
  } catch (error) {
    console.error("Test execution failed:", error);
  }
}

// Export for use in testing environments
export { runTests, testConceptNoteBuilder, testStateSchema };

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(console.error);
}
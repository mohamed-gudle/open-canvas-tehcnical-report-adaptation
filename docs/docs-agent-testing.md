# Technical Docs Agent – User Testing Guide

This guide walks through how to exercise the new document-drafting workflow end‑to‑end from the product UI. Follow the scenarios below to validate that routing, question collection, research prep, and artifact generation behave as expected.

## 1. Prep Your Environment

1. Install dependencies (root of the monorepo):
   ```bash
yarn install
```
2. Ensure the agents package builds cleanly:
   ```bash
yarn --cwd apps/agents build
```
3. Start the web client with the correct environment variables (copy `.env.example` to `.env.local` if you have not already, and populate the OpenAI/Supabase keys used elsewhere in the app):
   ```bash
yarn --cwd apps/web dev
```
4. Navigate to http://localhost:3000 and sign in with a test user.

## 2. Baseline Routing Smoke Test

Goal: confirm that doc-centric prompts route into the docs graph and persist state across turns.

1. Start a new chat ("New AFCEN Brief" button or the toolbar). Leave web search disabled for now.
2. Send a message such as “Help me draft a technical design document for the AFCEN grid analytics service.”
3. Expected results:
   - Assistant replies with a progress message rather than generating an artifact immediately (should mention confidence and missing required fields).
   - Question queue begins (first question targets a required field like context or architecture).
   - No artifact appears yet in the canvas panel.
4. Provide answers to two follow-up questions. Confirm:
   - Previously asked questions drop from the queue.
   - Confidence percentage increments as required fields are filled.
   - The assistant maintains conversation context (answers echoed in summaries as needed).
5. Refresh the browser tab. The session should reload with the same outstanding questions and previously captured answers (docs state stored in the LangGraph run state).

## 3. Direct Artifact Request Flow

Goal: verify explicit document-type instructions skip additional routing.

1. Start another new chat.
2. Send “Generate a PRD for the AFCEN satellite monitoring program. You can assume we already know the target users and success metrics.”
3. Expected results:
   - System infers doc type `prd` immediately.
   - Questions target the remaining required fields (e.g., overview, requirements).
   - If you provide answers that cover all required fields, the assistant should acknowledge readiness and produce the artifact draft after the next response.

## 4. Artifact Generation and Review

Goal: validate the Handlebars templates render correctly and artifacts surface in the canvas.

1. In an in-progress session, provide answers until confidence ≥ 75%.
2. When prompted, say “We’re ready—generate the document.”
3. Expected results:
   - Artifact panel updates with a markdown document titled “<Document Name> Draft.”
   - Assistant posts a short confirmation message noting the confidence score.
   - Sections from the template (Goals, Functional Requirements, etc.) are populated with your answers.
4. Ask the assistant to regenerate with new information (e.g., “Add a rollout plan focused on pilot cities.”). Confirm it resumes questioning for missing fields, then re-renders the artifact.

## 5. Web Search (Optional)

Goal: ensure the docs workflow cooperates with search-assisted runs.

1. Enable web search before sending your first message.
2. Issue a request like “Draft an ADR for adopting solar forecasting using {decision_topic}.”
3. After the search tool runs, confirm citations list appears in the `References` section when the artifact is generated (requires that a `citations` array be present in state; mocked data is OK if live web search isn’t configured).

## 6. Document Catalog API Check

Goal: validate the support list for quick-start UIs.

1. Call the local endpoint:
   ```bash
   curl http://localhost:3000/api/docs/options | jq
   ```
2. Confirm the response enumerates PRD, Technical Design Document, and ADR definitions (id, name, description, stage_hint).

## 7. Regression Safeguards

- Regular conversational prompts (“Summarize yesterday’s meeting notes”) should still route through standard artifact generation, not the docs workflow.
- The docs flow should never emit an empty artifact. If generation happens with low confidence, ensure the assistant either continues questions or explicitly notes assumptions.
- Switching assistants or resetting the thread should clear docs state (`docsState` field in LangGraph state should reset).

## Troubleshooting Tips

- If the assistant jumps straight to artifact generation, check the console logs for `docsState` hydration errors or missing doc definitions in `apps/agents/resources/doc_types.yml`.
- Broken template rendering usually indicates a field missing from the dossier; inspect the LangGraph run in LangSmith or add temporary logging inside `apps/agents/src/docs/nodes/generateArtifact.ts`.
- If `/api/docs/options` 404s, verify the build artifacts exist (`apps/agents/dist/docs/index.js`) or run `yarn --cwd apps/agents build` again.

Following these scenarios provides full coverage of the user-facing surfaces for the technical documentation agent: intent routing, Q&A loop, research integration, template rendering, and fallbacks.

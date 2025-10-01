import {
  ROUTE_QUERY_PROMPT,
  ROUTE_QUERY_OPTIONS_HAS_ARTIFACTS,
  ROUTE_QUERY_OPTIONS_NO_ARTIFACTS,
  CURRENT_ARTIFACT_PROMPT,
  NO_ARTIFACT_PROMPT,
} from "../../prompts.js";
import { OpenCanvasGraphAnnotation } from "../../state.js";
import {
  formatArtifactContentWithTemplate,
  getModelFromConfig,
  createContextDocumentMessages,
} from "../../../utils.js";
import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { getArtifactContent } from "@opencanvas/shared/utils/artifacts";
import z from "zod";
import { BaseMessage } from "@langchain/core/messages";
import { traceable } from "langsmith/traceable";
import { resolveDocumentDefinition } from "../../../docs/intent.js";
import { DocumentDefinition } from "../../../docs/types.js";

interface DynamicDeterminePathParams {
  state: typeof OpenCanvasGraphAnnotation.State;
  newMessages: BaseMessage[];
  config: LangGraphRunnableConfig;
}

interface RoutingDecision {
  route: "replyToGeneralInput" | "generateArtifact" | "rewriteArtifact";
  docDefinition?: DocumentDefinition;
}

/**
 * Dynamically determines the path to take using an LLM.
 */
async function dynamicDeterminePathFunc({
  state,
  newMessages,
  config,
}: DynamicDeterminePathParams): Promise<RoutingDecision | undefined> {
  const docSession = state.docsState;
  const candidateMessages = newMessages.length
    ? ([...state._messages, ...newMessages] as BaseMessage[])
    : (state._messages as BaseMessage[]);

  if (!docSession?.active) {
    const inferredDefinition = await resolveDocumentDefinition({
      config,
      messages: candidateMessages,
      fallbackToDefault: false,
    });
    if (inferredDefinition) {
      return {
        route: "replyToGeneralInput",
        docDefinition: inferredDefinition,
      } satisfies RoutingDecision;
    }
  } else if (!docSession.readyToGenerate) {
    return { route: "replyToGeneralInput" } satisfies RoutingDecision;
  }

  const currentArtifactContent = state.artifact
    ? getArtifactContent(state.artifact)
    : undefined;

  // Call model and decide if we need to respond to a users query, or generate a new artifact
  const formattedPrompt = ROUTE_QUERY_PROMPT.replace(
    "{artifactOptions}",
    currentArtifactContent
      ? ROUTE_QUERY_OPTIONS_HAS_ARTIFACTS
      : ROUTE_QUERY_OPTIONS_NO_ARTIFACTS
  )
    .replace(
      "{recentMessages}",
      state._messages
        .slice(-3)
        .map((message) => `${message.getType()}: ${message.content}`)
        .join("\n\n")
    )
    .replace(
      "{currentArtifactPrompt}",
      currentArtifactContent
        ? formatArtifactContentWithTemplate(
            CURRENT_ARTIFACT_PROMPT,
            currentArtifactContent
          )
        : NO_ARTIFACT_PROMPT
    );

  const docRoutingHint = docSession?.readyToGenerate
    ? "A documentation drafting session is ready. If the user clearly requests drafting now, routing to generateArtifact is appropriate; otherwise, continue the dialog."
    : "";

  const promptWithDocs = docRoutingHint
    ? `${formattedPrompt}\n\n<doc-session-hint>\n${docRoutingHint}\n</doc-session-hint>`
    : formattedPrompt;

  const routes = currentArtifactContent
    ? (["replyToGeneralInput", "rewriteArtifact"] as const)
    : (["replyToGeneralInput", "generateArtifact"] as const);

  const model = await getModelFromConfig(config, {
    temperature: 0,
    isToolCalling: true,
  });

  const schema = z.object({
    route: z.enum(routes).describe(
      "The route to take based on the user's query."
    ),
  });

  const modelWithTool = model.bindTools(
    [
      {
        name: "route_query",
        description: "The route to take based on the user's query.",
        schema,
      },
    ],
    {
      tool_choice: "route_query",
    }
  );

  const contextDocumentMessages = await createContextDocumentMessages(config);
  const result = await modelWithTool.invoke([
    ...contextDocumentMessages,
    ...(newMessages.length ? newMessages : []),
    {
      role: "user",
      content: promptWithDocs,
    },
  ]);

  const args = result.tool_calls?.[0]?.args as z.infer<typeof schema> | undefined;
  if (!args) {
    return undefined;
  }

  return { route: args.route } satisfies RoutingDecision;
}

export const dynamicDeterminePath = traceable(dynamicDeterminePathFunc, {
  name: "dynamic_determine_path",
});

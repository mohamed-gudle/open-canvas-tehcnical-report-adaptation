import { SearchResult } from "@opencanvas/shared/types";
import { WebSearchState } from "../state.js";
import ExaClient from "exa-js";
import { ExaRetriever } from "@langchain/exa";
import dns = require("node:dns");

const dnsPatched = dns as unknown as typeof dns & {
  __ocIPv4Patched?: boolean;
};

if (!dnsPatched.__ocIPv4Patched) {
  const originalLookup = dns.lookup.bind(dns);

  (dnsPatched as { lookup: typeof dns.lookup }).lookup = ((
    hostname: string,
    arg2?: unknown,
    arg3?: unknown
  ) => {
    if (typeof arg2 === "function") {
      return originalLookup(hostname, { family: 4 }, arg2 as any);
    }

    if (typeof arg2 === "number") {
      const family = arg2 && arg2 !== 0 ? arg2 : 4;
      return originalLookup(hostname, { family }, arg3 as any);
    }

    const options = (arg2 ?? {}) as Record<string, unknown>;
    const callback = arg3 as any;

    const patchedOptions = {
      ...options,
      family:
        typeof options.family === "number" && options.family !== 0
          ? (options.family as number)
          : 4,
    };

    return originalLookup(hostname, patchedOptions as any, callback);
  }) as typeof dns.lookup;

  dnsPatched.__ocIPv4Patched = true;
}

export async function search(
  state: WebSearchState
): Promise<Partial<WebSearchState>> {
  const exaClient = new ExaClient(process.env.EXA_API_KEY || "");
  const retriever = new ExaRetriever({
    client: exaClient as unknown as any,
    searchArgs: {
      filterEmptyResults: true,
      numResults: 5,
    },
  });

  const query = state.messages[state.messages.length - 1].content as string;
  const results = await retriever.invoke(query);

  return {
    webSearchResults: results as SearchResult[],
  };
}
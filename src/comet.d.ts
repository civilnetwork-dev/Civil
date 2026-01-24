import type { UUID } from "node:crypto";

// from https://github.com/nokazn/insignificant-types/blob/master/src/index.ts#L21
export type LimitedArray<L extends number, T = unknown> = T[] & { length: L };

export namespace SearchEngines {
  interface Bing {
    _type: "Suggestions";
    instrumentation: {
      _type: "ResponseInstrumentation" | "";
      pingUrlBase: string;
      pageLoadPingUrl: string;
    };
    queryContext: {
      originalQuery: string;
    };
    suggestionGroups: {
      searchSuggestions: {
        url: string;
        urlPingSuffix: string;
        result: {
          id: string | "";
          readLink: string | "";
          readLinkPingSuffix: string | "";
          webSearchUrl: string;
          webSearchUrlPingSuffix: string;
          name: string;
          image: {
            thumbnailUrl: string;
            hostPageUrl: string | "";
            hostPageUrlPingSuffix: string | "";
            width: number;
            height: number;
            sourceWidth: number;
            sourceHeight: number;
          };
          description: string | "";
          entityPresentationInfo: {
            entityScenario: string | "DominantEntity";
            entityTypeDisplayHint: string;
          };
          bingId: UUID;
        }[];
        displayText: string;
        query: string;
        searchKind: "WebSearch";
      }[];
    }[];
  }

  interface Phrase {
    phrase: string;
  }
}

import type * as _BareMux from "@mercuryworkshop/bare-mux";
import type { ScramjetController } from "@mercuryworkshop/scramjet";
import type { UVConfig } from "@titaniumnetwork-dev/ultraviolet";
import { EventEmitter } from "tseep";
import { registerSw, setupBareMux } from "./swUtils";

interface ProxyEntry {
    name: "uv" | "scramjet";
    value: UVConfig | ScramjetController;
}

interface ISearchBar {
    lastUrlSearched: string | URL;
    url: string;
    debugInfo: Partial<{
        currentRammerheadSession: string;
        currentTransport: `/${string}/index.mjs`;
        currentTechnology: "bare" | "wisp";
        currentTechnologyPath: `/${string}/`;
        currentProxy: "uv" | "scramjet" | "rammerhead";
    }>;
    proxyObjMap: ProxyEntry[];
    searchEngineMap: {
        name: string;
        value: `${string}?q=%s`;
    }[];
}

declare global {
    var BareMux: typeof _BareMux;
}

function isNavigableUrl(term: string): boolean {
    try {
        const u = new URL(term);
        return /^https?:|^ftp:/.test(u.protocol);
    } catch {}

    return /^[\w-]+\.[a-z]{2,}/i.test(term);
}

class SearchBar
    extends EventEmitter<{
        submit: (frame: HTMLIFrameElement, term: string) => void;
    }>
    implements ISearchBar
{
    lastUrlSearched!: string | URL;
    url!: string;
    debugInfo!: ISearchBar["debugInfo"];
    proxyObjMap: ISearchBar["proxyObjMap"];
    searchEngineMap: ISearchBar["searchEngineMap"];
    ready: Promise<void>;

    private static keys = ["lastUrlSearched", "url", "debugInfo"] as const;

    constructor() {
        super();

        const runSetup = async () => {
            await setupBareMux();
            await registerSw();
        };

        if (document.readyState === "complete") {
            this.ready = runSetup();
        } else {
            this.ready = new Promise<void>(resolve => {
                window.addEventListener(
                    "load",
                    () => runSetup().then(resolve),
                    { once: true },
                );
            });
        }

        const isJson = (string: string) => {
            try {
                JSON.parse(string);
                return true;
            } catch {
                return false;
            }
        };

        for (const key of SearchBar.keys) {
            const storageKey = key
                .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
                .toLowerCase();
            const value = localStorage.getItem(storageKey)!;
            this[key] = isJson(value) ? JSON.parse(value) : value;
        }

        this.proxyObjMap = [
            {
                name: "uv",
                get value() {
                    return self.__uv$config;
                },
            },
            {
                name: "scramjet",
                get value() {
                    return window.scramjet;
                },
            },
        ];

        this.searchEngineMap = [
            { name: "google", value: "https://www.google.com/search?q=%s" },
            { name: "ddg", value: "https://duckduckgo.com/?q=%s" },
            { name: "bing", value: "https://www.bing.com/search?q=%s" },
            { name: "brave", value: "https://search.brave.com/search?q=%s" },
            { name: "searx", value: "https://searx.org/search?q=%s" },
        ];

        this.registerHandlers();
    }

    registerHandlers() {
        const isUrl = (query: string) => {
            try {
                new URL(query);
                return true;
            } catch {}
            return false;
        };

        this.on("submit", (frame, term) => {
            const storedProxy =
                (localStorage.getItem("proxy") as "uv" | "scramjet") ||
                "scramjet";
            const proxy = this.proxyObjMap.find(p => p.name === storedProxy)!;

            let normalizedTerm: string;

            if (proxy.name === "uv") {
                normalizedTerm = term;
            } else {
                if (isNavigableUrl(term)) {
                    normalizedTerm = isUrl(term) ? term : `https://${term}`;
                } else {
                    const engine = this.searchEngineMap.find(
                        eng =>
                            eng.name ===
                            (localStorage.getItem("search") || "google"),
                    );
                    normalizedTerm =
                        engine?.value.replace("%s", encodeURIComponent(term)) ??
                        `https://www.google.com/search?q=${encodeURIComponent(term)}`;
                }
            }

            frame.contentWindow?.location.replace(
                (proxy.name === "uv" ? "/~/uv/" : "") +
                    proxy.value.encodeUrl!(normalizedTerm),
            );

            if (window.location.host === "civil.quartinal.me") {
                import("@plausible-analytics/tracker").then(({ track }) => {
                    track("Internal site visit", {
                        props: {
                            url: isUrl(term)
                                ? proxy.value.decodeUrl!(term)
                                : term,
                        },
                    });
                });
            }
        });
    }
}

export default function searchBar() {
    return new SearchBar();
}

import { EventEmitter } from "tseep";

declare global {
    var __uv$config:
        | {
              prefix: string;
              encodeUrl: (url: string) => string;
              decodeUrl: (url: string) => string;
          }
        | undefined;
}

function isNavigableUrl(term: string) {
    try {
        const u = new URL(term);
        return /^https?:|^ftp:/.test(u.protocol);
    } catch {}
    return /^[\w-]+\.[a-z]{2,}/i.test(term);
}

function getUvConfig() {
    if (
        self.__uv$config?.prefix &&
        typeof self.__uv$config?.encodeUrl === "function"
    )
        return self.__uv$config;
    return null;
}

const searchEngines = [
    { name: "google", value: "https://www.google.com/search?q=%s" },
    { name: "ddg", value: "https://duckduckgo.com/?q=%s" },
    { name: "bing", value: "https://www.bing.com/search?q=%s" },
    { name: "brave", value: "https://search.brave.com/search?q=%s" },
] as const;

class SearchBar extends EventEmitter<{
    submit: (frame: HTMLIFrameElement, term: string) => void;
}> {
    ready: Promise<void>;

    constructor() {
        super();
        this.ready = new Promise<void>(resolve => {
            const check = () => {
                if (getUvConfig()) resolve();
                else setTimeout(check, 50);
            };
            check();
        });
        this.registerHandlers();
    }

    private registerHandlers() {
        this.on("submit", (frame, term) => {
            const uvConfig = getUvConfig();
            if (!uvConfig) {
                console.error(
                    "[SearchBar] __uv$config not available... are /uv/uv.bundle.js and /uv/uv.config.js loaded?",
                );
                return;
            }

            let normalizedTerm: string;

            if (isNavigableUrl(term)) {
                try {
                    new URL(term);
                    normalizedTerm = term;
                } catch {
                    normalizedTerm = `https://${term}`;
                }
            } else {
                const engineName = localStorage.getItem("search") || "google";
                const engine = searchEngines.find(e => e.name === engineName);
                normalizedTerm =
                    engine?.value.replace("%s", encodeURIComponent(term)) ??
                    `https://www.google.com/search?q=${encodeURIComponent(term)}`;
            }

            const encoded =
                uvConfig.prefix + uvConfig.encodeUrl(normalizedTerm);

            try {
                frame.contentWindow?.location.replace(encoded);
            } catch {
                frame.src = encoded;
            }
        });
    }
}

export default function searchBar() {
    return new SearchBar();
}

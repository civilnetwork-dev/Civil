import type { UVConfig } from "@titaniumnetwork-dev/ultraviolet";
import { EventEmitter } from "tseep";

import {
    type BestProxy,
    fetchBestProxy,
    measureAndReportCompat,
} from "./bestProxy";
import { registerSw, setupBareMux } from "./swUtils";

interface ScramjetLike {
    encodeUrl: (s: string) => string;
    decodeUrl: (s: string) => string;
}

interface ProxyEntry {
    name: "uv" | "scramjet";
    value: UVConfig | ScramjetLike;
}

interface ISearchBar {
    lastUrlSearched: string | URL;
    url: string;
    debugInfo: Partial<{
        currentTransport: `/${string}/index.mjs`;
        currentTechnology: "bare" | "wisp";
        currentTechnologyPath: `/${string}/`;
        currentProxy: "uv" | "scramjet";
    }>;
    proxyObjMap: ProxyEntry[];
    searchEngineMap: {
        name: string;
        value: `${string}?q=%s`;
    }[];
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
            await registerSw();
            await setupBareMux();
            await (window as any).scramjetReady;
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
        this.on("submit", (frame, term) => {
            void this.submitFrame(frame, term);
        });
    }

    private isAbsoluteUrl(query: string) {
        try {
            void new URL(query);
            return true;
        } catch {}
        return false;
    }

    private getSelectedProxy(): ProxyEntry {
        // localStorage can hold a stale value from an older build (e.g. the
        // removed "rammerhead" engine), so match against proxyObjMap rather
        // than trusting the stored string.
        const storedProxy = localStorage.getItem("proxy");
        return (
            this.proxyObjMap.find(p => p.name === storedProxy) ??
            this.proxyObjMap.find(p => p.name === "scramjet")!
        );
    }

    private pickProxy(cfg: BestProxy | null): ProxyEntry {
        const name = cfg?.proxy;
        const entry = name && this.proxyObjMap.find(p => p.name === name);
        return entry || this.getSelectedProxy();
    }

    private normalizeTerm(term: string, proxy: ProxyEntry) {
        if (proxy.name === "uv") {
            return term;
        }

        if (isNavigableUrl(term)) {
            return this.isAbsoluteUrl(term) ? term : `https://${term}`;
        }

        const engine = this.searchEngineMap.find(
            eng => eng.name === (localStorage.getItem("search") || "google"),
        );
        return (
            engine?.value.replace("%s", encodeURIComponent(term)) ??
            `https://www.google.com/search?q=${encodeURIComponent(term)}`
        );
    }

    private createProxyUrl(term: string, proxy: ProxyEntry) {
        if (!proxy.value?.encodeUrl)
            throw new Error(`Proxy "${proxy.name}" not ready`);
        return (
            (proxy.name === "uv" ? "/~/uv/" : "") +
            proxy.value.encodeUrl(this.normalizeTerm(term, proxy))
        );
    }

    private trackInternalVisit(term: string, proxy: ProxyEntry) {
        if (window.location.host !== "civil.quartinal.me") {
            return;
        }

        window.posthog?.capture(
            "Internal site visit",
            this.isAbsoluteUrl(term)
                ? { url: proxy.value.decodeUrl!(term) }
                : { term },
        );
    }

    private async applyFrameTransport(
        sframe: any,
        key: string | undefined,
    ): Promise<void> {
        if (!key) return;
        try {
            const getT = (window as any).__civilGetTransport as
                | ((k: string) => Promise<unknown>)
                | undefined;
            if (!getT) return;
            const t = await getT(key);
            if (!t) return;
            if (sframe?.controller) sframe.controller.transport = t;
            if (sframe?.fetchHandler?.client)
                sframe.fetchHandler.client.transport = t;
            this.debugInfo = {
                ...this.debugInfo,
                currentTransport: `/${key}/index.mjs`,
            };
        } catch {}
    }

    async submitFrame(frame: HTMLIFrameElement, term: string) {
        await this.ready;
        const cfg = await fetchBestProxy(term);
        const proxy = this.pickProxy(cfg);

        if (proxy.name === "scramjet") {
            const controller = window.scramjet;
            const existing = controller.frames?.find(
                (f: any) => f.element === frame,
            );
            const sframe = existing ?? controller.createFrame(frame);
            await this.applyFrameTransport(sframe, cfg?.transport);
            sframe.go(this.normalizeTerm(term, proxy));
        } else {
            frame.contentWindow?.location.replace(
                this.createProxyUrl(term, proxy),
            );
        }
        this.trackInternalVisit(term, proxy);
        if (proxy.name === "scramjet" || proxy.name === "uv") {
            void measureAndReportCompat(
                frame,
                term,
                proxy.name,
                cfg?.transport,
            );
        }
    }
}

export default function searchBar() {
    return new SearchBar();
}

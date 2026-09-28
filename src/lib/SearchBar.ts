import { EventEmitter } from "tseep";

import { fetchBestProxy, measureAndReportCompat } from "./bestProxy";
import { getSetting, searchUrl } from "./settings";
import { registerSw, setupBareMux } from "./swUtils";
import { resolveTransport, transportKey, wantsBestProxy } from "./transport";

interface ISearchBar {
    lastUrlSearched: string | URL;
    url: string;
    debugInfo: Partial<{
        currentTransport: `/${string}/index.mjs`;
        currentTechnology: "bare" | "wisp";
        currentTechnologyPath: `/${string}/`;
    }>;
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

    // window.scramjet is assigned only at the very end of initScramjet(), the
    // last statement before that async function's own promise resolves. It's
    // read directly rather than cached because SearchBar.ready can resolve
    // before it's set: if window.scramjetReady itself was still unset when
    // runSetup() awaited it, that await resolved immediately instead of
    // actually waiting (see submitFrame).
    private isScramjetReady(): boolean {
        return Boolean(window.scramjet);
    }

    private normalizeTerm(term: string) {
        if (isNavigableUrl(term)) {
            return this.isAbsoluteUrl(term) ? term : `https://${term}`;
        }
        return searchUrl(term);
    }

    private trackInternalVisit(term: string) {
        if (window.location.host !== "civil.quartinal.me") {
            return;
        }

        window.posthog?.capture(
            "Internal site visit",
            this.isAbsoluteUrl(term)
                ? { url: window.scramjet.decodeUrl(term) }
                : { term },
        );
    }

    private async applyFrameTransport(sframe: any, key: string): Promise<void> {
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
        // With automatic picking off (or a site rule in charge) the probe
        // would be ignored, so the visited address is not sent for it.
        const cfg = wantsBestProxy(term) ? await fetchBestProxy(term) : null;

        // Re-await the real scramjetReady promise (a no-op once it's already
        // resolved) before touching window.scramjet — see isScramjetReady.
        if (!this.isScramjetReady()) {
            await Promise.resolve((window as any).scramjetReady).catch(
                () => {},
            );
        }

        const controller = window.scramjet;
        if (!controller) throw new Error("scramjet not ready");
        const existing = controller.frames?.find(
            (f: any) => f.element === frame,
        );
        const sframe = existing ?? controller.createFrame(frame);
        // Always set, never left to whatever the frame used last: a retry
        // after a failover has to actually run on the new transport.
        const transport = resolveTransport(frame, term, cfg?.transport);
        await this.applyFrameTransport(
            sframe,
            transportKey(transport, cfg?.wispVersion),
        );
        sframe.go(this.normalizeTerm(term));

        this.trackInternalVisit(term);
        if (getSetting("compatReports")) {
            void measureAndReportCompat(frame, term, transport);
        }
    }
}

export default function searchBar() {
    return new SearchBar();
}

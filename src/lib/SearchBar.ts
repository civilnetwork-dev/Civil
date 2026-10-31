import { EventEmitter } from "tseep";

import { searchUrl } from "./settings";
import { registerSw, setupBareMux } from "./swUtils";
import { resolveTransport, transportKey } from "./transport";

function isNavigableUrl(term: string): boolean {
    try {
        const u = new URL(term);
        return /^https?:|^ftp:/.test(u.protocol);
    } catch {}

    return /^[\w-]+\.[a-z]{2,}/i.test(term);
}

class SearchBar extends EventEmitter<{
    submit: (frame: HTMLIFrameElement, term: string) => void;
}> {
    ready: Promise<void>;

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
            "internal_site_visit",
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
        } catch {}
    }

    async submitFrame(frame: HTMLIFrameElement, term: string) {
        await this.ready;

        // Re-await the real scramjetReady promise (a no-op once it's already
        // resolved) before touching window.scramjet: see isScramjetReady.
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
        await this.applyFrameTransport(
            sframe,
            transportKey(resolveTransport(frame, term)),
        );
        sframe.go(this.normalizeTerm(term));

        this.trackInternalVisit(term);
    }
}

export default function searchBar() {
    return new SearchBar();
}

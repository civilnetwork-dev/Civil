import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { describe, expect, it } from "vitest";

import {
    engineNames,
    PROXY_PREFIX,
    runtimeScripts,
} from "./config/shared/runtimeScripts";
import { neutralizeEngineNames, runtimeScriptRoutes } from "./runtimeScripts";

// Default engineTokens from WebProxyDetectionService.js, iboss 1.0.170 and
// 1.0.200. The test below covers that URL signal only.
const IBOSS_ENGINE_TOKENS = [
    "ultraviolet",
    "uv.sw",
    "uv.bundle",
    "uv.config",
    "wisp",
    "scramjet",
    "baremux",
    "bare-mux",
    "corrosion",
    "rammerhead",
    "eclipse-proxy",
    "meteorproxy",
    "mercuryworkshop",
];

// Window properties iboss 1.0.200 probes with `name in window` in every frame,
// and the globals, IndexedDB names and attributes Aristotle Student and the
// proxied markup expose. See docs/research/filter-audit-2026-10-30-network.md.
const ENGINE_GLOBALS = [
    /\$scramjetController/,
    /\$scramjet(?![\w$])/,
    /__scramjet_controller/,
    /scramjet-injected/,
    /scramjet-attr/,
    /\$scram(?:err|dbg|itize)/,
];

const controllerDist = resolve(
    import.meta.dirname,
    "../node_modules/@mercuryworkshop/scramjet-controller/dist",
);
const SOURCES = [
    [runtimeScripts.engine, resolve(scramjetPath, "scramjet.js")],
    [runtimeScripts.controller, resolve(controllerDist, "controller.api.js")],
    [runtimeScripts.frame, resolve(controllerDist, "controller.inject.js")],
] as const;

async function served(url: string): Promise<string> {
    return (await runtimeScriptRoutes.request(url)).text();
}

describe("public runtime scripts", () => {
    it.each(SOURCES)(
        "serves %s with the engine names replaced and no redirect",
        async (url, source) => {
            const response = await runtimeScriptRoutes.request(url);
            expect(response.status).toBe(200);
            expect(response.headers.get("location")).toBeNull();
            expect(response.headers.get("content-type")).toContain(
                "javascript",
            );
            const body = await response.text();
            expect(body).toBe(
                neutralizeEngineNames(await readFile(source, "utf8")),
            );
            for (const name of ENGINE_GLOBALS) expect(body).not.toMatch(name);
        },
    );

    it("renames the page globals the controller and frames share", async () => {
        const [controller, frame] = await Promise.all(
            [runtimeScripts.controller, runtimeScripts.frame].map(url =>
                served(url),
            ),
        );
        // The controller injects `<global>.load(...)` into each frame, and the
        // frame bundle defines that same global.
        expect(controller).toContain(`${engineNames.controller}.load(`);
        expect(frame).toContain(`${engineNames.controller}=`);
        expect(controller).toContain(`"${engineNames.database}"`);
    });

    it("keeps the message keys the service worker reads", async () => {
        const engine = await served(runtimeScripts.engine);
        expect(engine).toContain("$scramjet$data");
        expect(engine).toContain("$scramjet$messagetype");
    });

    it("serves the WebAssembly module under its neutral URL", async () => {
        const response = await runtimeScriptRoutes.request(runtimeScripts.wasm);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("wasm");
        const bytes = new Uint8Array(await response.arrayBuffer());
        const source = await readFile(resolve(scramjetPath, "scramjet.wasm"));
        expect(bytes.byteLength).toBe(source.byteLength);
    });

    it("avoids iboss engine URL tokens and keeps missing scripts out of SSR", async () => {
        for (const url of Object.values(runtimeScripts)) {
            expect(IBOSS_ENGINE_TOKENS.some(token => url.includes(token))).toBe(
                false,
            );
        }
        for (const name of [PROXY_PREFIX, engineNames.wasmScript]) {
            expect(
                IBOSS_ENGINE_TOKENS.some(token => name.includes(token)),
            ).toBe(false);
        }
        const missing = await runtimeScriptRoutes.request(
            "/_runtime/missing.js",
        );
        expect(missing.status).toBe(404);
        const head = await runtimeScriptRoutes.request(runtimeScripts.engine, {
            method: "HEAD",
        });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe("");
    });
});

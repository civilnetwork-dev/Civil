import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { expect, it } from "vitest";

import { runtimeAssets } from "./config/shared/runtimeScripts";
import { runtimeScriptRoutes } from "./runtimeScripts";

const root = resolve(import.meta.dirname, "..");
const SOURCES = [
    [
        runtimeAssets.bare,
        "node_modules/@mercuryworkshop/bare-transport/dist/index.mjs",
    ],
    [
        runtimeAssets.libcurl,
        "node_modules/@mercuryworkshop/libcurl-transport/dist/index.mjs",
    ],
    [
        runtimeAssets.epoxy,
        "node_modules/@mercuryworkshop/epoxy-transport/dist/index.mjs",
    ],
    [runtimeAssets.muxTransport, "dist-config/baremux-transport/index.mjs"],
];
// Lightspeed Filter Helper 1.5.1.1793289492 detectBareMux resource predicates.
const RESOURCE_MARKERS = [
    /\/baremux\//i,
    /\/bare-mux\//i,
    /baremux\/worker\.js/i,
    /\/libcurl\//i,
    /\/epoxy\//i,
    /bare\.cjs/i,
    /bare-mux\.js/i,
    /libcurl\.js/i,
    /epoxy\.js/i,
];

it.each(SOURCES)(
    "serves %s modules directly with their original bytes",
    async (prefix, source) => {
        const url = `${prefix}/index.mjs`;
        const response = await runtimeScriptRoutes.request(url);
        expect(response.status).toBe(200);
        expect(response.headers.get("location")).toBeNull();
        expect(await response.text()).toBe(
            await readFile(resolve(root, source!), "utf8"),
        );
        expect(RESOURCE_MARKERS.some(pattern => pattern.test(url))).toBe(false);
    },
);

it("serves the shared worker without exposing the upstream path", async () => {
    const url = `${runtimeAssets.mux}/worker.js`;
    const response = await runtimeScriptRoutes.request(url);
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toBe(
        await readFile(resolve(baremuxPath, "worker.js"), "utf8"),
    );
    expect(RESOURCE_MARKERS.some(pattern => pattern.test(url))).toBe(false);
});

it.each(Object.values(runtimeAssets))(
    "keeps missing %s assets out of SSR",
    async prefix => {
        const response = await runtimeScriptRoutes.request(
            `${prefix}/missing.js`,
        );
        expect(response.status).toBe(404);
    },
);

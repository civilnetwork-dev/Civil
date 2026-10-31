import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { serveStatic } from "@hono/node-server/serve-static";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { Hono } from "hono";
import { etag } from "hono/etag";

import { engineNames, runtimeScripts } from "./config/shared/runtimeScripts";

const root = resolve(import.meta.dirname, "..");
const controllerDist = resolve(
    root,
    "node_modules/@mercuryworkshop/scramjet-controller/dist",
);

// The engine and controller bundles name themselves: `$scramjet` and
// `$scramjetController` on the window, a `__scramjet_controller` IndexedDB
// database, `scramjet-attr-*` attributes on proxied markup. Extension probes
// look for exactly those names (iboss 1.0.200 `name in window`, Aristotle
// Student `window.$scramjetController` and `indexedDB.databases()`), and the
// page, every proxied frame and the controller read each other's globals by
// name, so one rename has to reach all of them. `$scramjet$data` and the other
// `$scramjet$` message keys stay: the service worker and the extension shim
// read them.
const renames: [pattern: RegExp, name: string][] = [
    [/\$scramjetController/g, engineNames.controller],
    [/\$scramjet(?![\w$])/g, engineNames.engine],
    [/__scramjet_controller/g, engineNames.database],
    [/scramjet-injected/g, engineNames.injected],
    [/scramjet-attr/g, engineNames.attribute],
    // Debug and error hooks the engine leaves on every proxied window.
    [/\$scramerr/g, "$rtErr"],
    [/\$scramdbg/g, "$rtDbg"],
    [/\$scramitize/g, "$rtFlag"],
];

export function neutralizeEngineNames(source: string): string {
    return renames.reduce(
        (text, [pattern, name]) => text.replace(pattern, name),
        source,
    );
}

const bundles = {
    [runtimeScripts.engine]: resolve(scramjetPath, "scramjet.js"),
    [runtimeScripts.controller]: resolve(controllerDist, "controller.api.js"),
    [runtimeScripts.frame]: resolve(controllerDist, "controller.inject.js"),
};

// iboss 1.0.170/1.0.200 flags a page when any script src contains an engine
// token. Serve the bytes directly: a redirect would expose the old URL.
export const runtimeScriptRoutes = new Hono();
for (const [url, path] of Object.entries(bundles)) {
    let body: Promise<string> | undefined;
    runtimeScriptRoutes.get(url, etag(), async c => {
        body ??= readFile(path, "utf8").then(neutralizeEngineNames);
        c.header("cache-control", "no-cache");
        c.header("content-type", "text/javascript; charset=utf-8");
        return c.body(await body);
    });
}
runtimeScriptRoutes.get(
    runtimeScripts.start,
    serveStatic({ path: resolve(root, "dist-config/scramjet_init.js") }),
);
runtimeScriptRoutes.get(
    runtimeScripts.wasm,
    serveStatic({ path: resolve(scramjetPath, "scramjet.wasm") }),
);
// A missing runtime file must stay a 404 instead of falling through to SSR.
runtimeScriptRoutes.all("/_runtime/*", c => c.notFound());

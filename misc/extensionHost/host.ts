/**
 * Loads an unpacked extension folder and runs its background code in a
 * `node:vm` sandbox with a `chrome`/`browser` global and the web platform
 * that surrounds it — no real Chromium or WebKit underneath.
 *
 * "Emulate the API, don't emulate a browser" was the original line here, and
 * running the twenty-eight real filter bundles moved it: what stopped most of
 * them wasn't a missing `chrome.*` member but a missing `Response`,
 * `EventTarget`, `location` or `document`. So the surrounding platform is
 * provided too — see api/platform.ts, including why an MV2 background gets a
 * DOM and an MV3 service worker does not. What is still not emulated is a
 * *browser*: no rendering, no navigation, no network.
 */

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import * as vm from "node:vm";

import type { SyntheticTab } from "../browserApiEmulators/extensions/chrome/types";
import { buildAction } from "./api/action";
import { buildAlarms } from "./api/alarms";
import { buildBookmarks } from "./api/bookmarks";
import { withCallbacks } from "./api/callbacks";
import {
    buildDeclarativeNetRequest,
    matchUrl,
} from "./api/declarativeNetRequest";
import {
    buildEmptyCollections,
    buildExtensionAlias,
    buildI18n,
    buildIdentity,
    buildManagement,
    buildSystem,
    buildWindows,
} from "./api/deviceApis";
import {
    buildDeviceAttributes,
    buildNetworkingAttributes,
} from "./api/enterprise";
import { buildPlatform, type TimerHandle } from "./api/platform";
import { buildRuntime, dispatchMessage } from "./api/runtime";
import { buildScripting } from "./api/scripting";
import { buildSockets } from "./api/sockets";
import { buildStorage } from "./api/storage";
import { withFallback } from "./api/stub";
import { buildTabs } from "./api/tabs";
import {
    backgroundScriptsFromPage,
    extensionUrl,
    loadManifest,
    type ResolvedBackground,
    randomExtensionId,
    resolveBackground,
} from "./manifest";
import { createModuleLoader } from "./moduleLoader";
import { ExtensionState } from "./state";
import type { ExtensionHandle, LoadOptions } from "./types";

/**
 * `vm.constants.USE_MAIN_CONTEXT_DEFAULT_LOADER` (below) makes Node print a
 * one-time `ExperimentalWarning` the moment a script's first dynamic
 * `import(...)` actually runs — asynchronously, after the `runInContext` call
 * that triggered it has already returned, so no call this module makes can
 * wrap and un-wrap a listener around just that moment. Node only ever emits
 * it once per process for this specific feature, which is what makes a
 * module-scope filter the right size for it, installed once here rather than
 * re-applied per call: every other warning — deprecations, other experimental
 * features, whatever the rest of the process cares about — still reaches
 * whatever was already listening. This runs only when something imports this
 * module; nothing in Civil's own server path does.
 */
const EXPERIMENTAL_LOADER_WARNING = /USE_MAIN_CONTEXT_DEFAULT_LOADER/;
const priorWarningListeners = process.listeners("warning");
process.removeAllListeners("warning");
process.on("warning", warning => {
    if (
        warning.name === "ExperimentalWarning" &&
        EXPERIMENTAL_LOADER_WARNING.test(warning.message)
    ) {
        return;
    }
    for (const listener of priorWarningListeners)
        (listener as (warning: Error) => void)(warning);
});

/**
 * Compiles one background source, bundling it first if it turns out to need
 * a module linker `vm.Script`'s plain compile doesn't have.
 *
 * A static `import`/`export` statement is a genuine syntax error in a classic
 * script — the catch below catches it and bundles. A *dynamic* `import(...)`
 * call is a different problem, and not a compile-time one: it's ordinary,
 * syntactically valid classic-script code, so a plain compile always
 * succeeds, and it only fails once that call actually runs, unless the vm is
 * told how to resolve it. `USE_MAIN_CONTEXT_DEFAULT_LOADER` is that answer —
 * it resolves a dynamic import exactly the way this file's own imports
 * resolve, relative to `filename`, which is why `filename` here is always the
 * real absolute path rather than a short display name: relative resolution
 * needs a real base to resolve against. This handles even a *computed*
 * specifier (`import(backend + ".js")`), which bundling can never inline —
 * esbuild only inlines what it can see as a literal at build time. Three of
 * the tracked filters ship an ES-module service worker (`"type": "module"`)
 * or a classic script that dynamic-imports its own chunks; content scripts
 * hit the same two shapes (misc/filterProbe/sandbox.ts reuses this function
 * for exactly that).
 *
 * esbuild resolves the *static* import graph and emits one classic IIFE,
 * which is exactly what the vm can run — and what Chrome effectively does
 * anyway when it loads a module worker. Bundling is attempted only after a
 * plain compile fails, so the common case pays nothing and multi-file MV2
 * backgrounds keep sharing one global scope instead of each becoming its own
 * module.
 */
export interface CompileLinking {
    /** The vm context the compiled script will run in — must match whatever
     *  `.runInContext(...)` the caller uses, so a dynamically-imported module
     *  sees the same `chrome`, `fetch` and everything else the script does. */
    context: vm.Context;
    extensionId: string;
    extensionDir: string;
}

export async function compileScript(
    code: string,
    entryPath: string,
    linking: CompileLinking,
): Promise<vm.Script> {
    const scriptOptions = {
        filename: entryPath,
        importModuleDynamically: createModuleLoader({ ...linking, entryPath }),
    };
    try {
        return new vm.Script(code, scriptOptions);
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
        const bundled = await bundleWithEsbuild(entryPath);
        if (bundled === undefined) throw error;
        return new vm.Script(bundled, scriptOptions);
    }
}

/** Bundles `entryPath` into one classic IIFE, or returns `undefined` if
 *  esbuild produced nothing — the caller decides what to fall back to. */
async function bundleWithEsbuild(
    entryPath: string,
): Promise<string | undefined> {
    // Also a devDependency, and imported lazily for the same reason happy-dom
    // is: nothing outside this fallback needs a bundler.
    const esbuild = await import("esbuild");
    const built = await esbuild.build({
        entryPoints: [entryPath],
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        target: "es2022",
        logLevel: "silent",
        plugins: [
            {
                // Isomorphic libraries inside a vendor bundle keep their
                // Node branches — aristotleStudent's imports `node-fetch`,
                // `util`, `fs` and `string_decoder` behind a runtime
                // check that is false in a browser. Chrome never resolves
                // those either; it just never reaches them. Resolving
                // them to an empty module reproduces that, where letting
                // esbuild fail on them would lose the whole bundle over
                // code that does not run.
                name: "unreachable-node-imports",
                setup(build) {
                    build.onResolve({ filter: /.*/ }, args => {
                        if (args.kind === "entry-point") return null;
                        if (args.path.startsWith(".") || isAbsolute(args.path))
                            return null;
                        return { path: args.path, namespace: "empty" };
                    });
                    build.onLoad({ filter: /.*/, namespace: "empty" }, () => ({
                        contents: "export default {};",
                        loader: "js" as const,
                    }));
                },
            },
        ],
    });
    return built.outputFiles?.[0]?.text;
}

/** The background code to execute, in order, as `[filename, source]` pairs.
 *  A background *page* contributes its `<script>` tags — file references and
 *  inline blocks alike — rather than the HTML document itself. */
async function readBackgroundSources(
    dir: string,
    background: ResolvedBackground,
): Promise<[filename: string, code: string][]> {
    if (background.type !== "page") {
        return Promise.all(
            background.files.map(
                async file =>
                    [file, await readFile(join(dir, file), "utf-8")] as [
                        string,
                        string,
                    ],
            ),
        );
    }

    const page = background.files[0]!;
    const html = await readFile(join(dir, page), "utf-8");
    const sources: [string, string][] = [];
    for (const [index, script] of backgroundScriptsFromPage(html).entries()) {
        if ("src" in script) {
            sources.push([
                script.src,
                await readFile(join(dir, script.src), "utf-8"),
            ]);
        } else {
            sources.push([`${page}#script[${index}]`, script.code]);
        }
    }
    return sources;
}

export async function loadExtension(
    options: LoadOptions,
): Promise<ExtensionHandle> {
    const manifest = await loadManifest(options.dir);
    const background = resolveBackground(manifest);
    const target = options.target ?? "chrome";
    const extensionId = options.extensionId ?? randomExtensionId();

    const state = new ExtensionState();
    if (options.initialStorage)
        state.seedStorage("local", options.initialStorage);
    if (options.managedStorage)
        state.seedStorage("managed", options.managedStorage);

    // The extension's own translations, when it ships them — see buildI18n.
    // Absent `_locales` is normal and not an error.
    const messages = await readFile(
        join(options.dir, "_locales", "en", "messages.json"),
        "utf-8",
    )
        .then(raw => JSON.parse(raw.replace(/^﻿/, "")))
        .catch(() => ({}));

    const tab: SyntheticTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: "about:blank",
        title: "",
        favIconUrl: "",
        status: "complete",
        active: true,
        pinned: false,
        incognito: false,
        groupId: -1,
    };

    // Wrapped in withFallback: real vendor extensions reach for dozens of
    // chrome.* namespaces this host doesn't implement (chrome.windows,
    // chrome.webRequest, chrome.identity, ...). Without the fallback, the
    // first access to one of them throws and kills the whole background
    // script before it reaches the declarativeNetRequest calls this host
    // exists to observe — see api/stub.ts.
    // Each namespace is wrapped individually, not just the top-level object:
    // real bundles have crashed on missing *members* of a namespace this
    // host does implement (chrome.tabs.onCreated, chrome.runtime.onInstalled
    // before it was added above) just as often as on a whole missing
    // namespace (chrome.windows). Both need the same fallback.
    // withCallbacks wraps each implemented namespace before withFallback so
    // both calling conventions work: promise style (MV3) and trailing
    // callback (MV2's only style, and still widely used in MV3 bundles) —
    // see api/callbacks.ts for how much of this corpus depends on the
    // latter. Order matters: the fallback proxy has to be outermost so it
    // still sees, and can stub, whatever withCallbacks didn't produce.
    const api = withFallback({
        runtime: withFallback(
            withCallbacks(buildRuntime({ extensionId, manifest, state })),
        ),
        storage: withFallback(withCallbacks(buildStorage(state))),
        alarms: withFallback(withCallbacks(buildAlarms(state))),
        action: withFallback(withCallbacks(buildAction(state.actionCalls))),
        browserAction: withFallback(
            withCallbacks(buildAction(state.actionCalls)),
        ),
        tabs: withFallback(withCallbacks(buildTabs(() => tab))),
        bookmarks: withFallback(
            withCallbacks(buildBookmarks(options.initialBookmarks)),
        ),
        scripting: withFallback(
            withCallbacks(buildScripting(options.runScript)),
        ),
        // Not stubbed, because bundles read these results rather than only
        // calling them — see api/deviceApis.ts.
        windows: withFallback(withCallbacks(buildWindows(() => tab))),
        identity: withFallback(withCallbacks(buildIdentity())),
        management: withFallback(
            withCallbacks(buildManagement(extensionId, manifest)),
        ),
        i18n: withFallback(withCallbacks(buildI18n(messages))),
        system: withFallback(withCallbacks(buildSystem())),
        sockets: withFallback(withCallbacks(buildSockets())),
        enterprise: withFallback({
            deviceAttributes: withFallback(
                withCallbacks(buildDeviceAttributes()),
            ),
            networkingAttributes: withFallback(
                withCallbacks(buildNetworkingAttributes()),
            ),
        }),
        extension: withFallback(
            withCallbacks(
                buildExtensionAlias(path => extensionUrl(extensionId, path)),
            ),
        ),
        ...Object.fromEntries(
            Object.entries(buildEmptyCollections()).map(([name, empty]) => [
                name,
                withFallback(withCallbacks(empty)),
            ]),
        ),
        declarativeNetRequest: withFallback(
            withCallbacks(buildDeclarativeNetRequest(state)),
        ),
    });

    const timers = new Set<TimerHandle>();
    const sources = await readBackgroundSources(options.dir, background);
    // `importScripts` and `self.location` both resolve against the background
    // entry's own directory, not the extension root — a worker at
    // `js/worker.js` calling `importScripts("base64.js")` means
    // `js/base64.js`. Resolving from the root instead is what made
    // lanschoolWebHelper fail on a file that is right there next to its
    // worker.
    const entryPath = background.files[0] ?? "background.js";
    const entryDir = dirname(entryPath);

    const platform = await buildPlatform({
        manifestVersion: manifest.manifest_version as 2 | 3,
        extensionId,
        extensionDir: options.dir,
        dom: background.type === "scripts" || background.type === "page",
        allowNetwork: options.allowNetwork ?? false,
        network: options.network,
        target,
        backgroundPath: entryPath,
        timers,
    });

    const sandbox: Record<string, unknown> = {
        ...platform.globals,
        chrome: api,
        // Safari Web Extensions (and Firefox) expose the identical
        // WebExtensions surface as `browser`, promise-only. Every method
        // built above already returns a Promise (the one dual-mode
        // exception, runtime.sendMessage's optional callback, still resolves
        // its promise either way) — so `browser` is the same object, not a
        // second implementation. `chrome` stays defined under the "safari"
        // target too because real Safari exposes both, and extensions that
        // feature-detect via `self.browser ?? self.chrome` are common.
        browser: api,
    };
    sandbox.self = sandbox;
    sandbox.globalThis = sandbox;
    // A background page's `window` is the global object, the same way
    // `self` is — not a separate object that happens to carry the DOM. Code
    // that reads `window.chrome`, `window.location` or `window.foo` after
    // setting a bare `foo` depends on that identity.
    if (background.type === "scripts" || background.type === "page")
        sandbox.window = sandbox;
    const context = vm.createContext(sandbox);

    // A service worker global: a bundle that splits its worker across files
    // pulls the rest in with `importScripts`, synchronously, into the same
    // global. Assigned after `createContext` because it needs the context it
    // runs code in. A path may be written relative to the worker, absolute
    // from the extension root, or as a full chrome-extension:// URL.
    sandbox.importScripts = (...paths: string[]): void => {
        for (const path of paths) {
            const stripped = path.replace(/^chrome-extension:\/\/[^/]+\//, "/");
            const file = stripped.startsWith("/")
                ? stripped.slice(1)
                : join(entryDir, stripped);
            const code = readFileSync(join(options.dir, file), "utf-8");
            new vm.Script(code, { filename: file }).runInContext(context);
        }
    };

    // Populate the generated background page with the script tags Chrome
    // would have put there, before any of them runs.
    for (const [filename] of sources) platform.addScriptElement(filename);

    for (const [filename, code] of sources) {
        const script = await compileScript(code, join(options.dir, filename), {
            context,
            extensionId,
            extensionDir: options.dir,
        });
        script.runInContext(context);
    }

    // Fired once, after every background file's synchronous top-level body
    // has finished registering its listeners — including any onInstalled
    // listener itself. Real Chrome fires this exactly once per extension
    // install, which loading it into this host is the closest equivalent of.
    for (const listener of state.installedListeners)
        listener({ reason: "install" });

    return {
        id: extensionId,
        manifest,
        target,

        advanceTime(ms) {
            state.advanceTo(state.now + ms);
        },

        getStorage(area = "local") {
            return state.snapshotStorage(area);
        },

        storage: api.storage,

        async sendMessage(message) {
            const result = await dispatchMessage(state, message);
            const captured = {
                message,
                response: result.response,
                handled: result.handled,
            };
            state.capturedMessages.push(captured);
            return captured;
        },

        matchRequest(url, opts) {
            return matchUrl(state, url, opts);
        },

        get tabUrl() {
            return tab.url;
        },

        get actionCalls() {
            return state.actionCalls;
        },

        get sentMessages() {
            return state.sentMessages;
        },

        dispose() {
            // The virtual clock owns no real timers, but the sandbox's
            // `setTimeout`/`setInterval` do, and a vendor bundle's startup
            // polling loop outlives the load that created it. The DOM, when
            // there is one, runs a timer queue of its own that only closing
            // the window drains.
            for (const handle of timers) clearTimeout(handle);
            timers.clear();
            platform.dispose();
        },
    };
}

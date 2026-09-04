/**
 * Does this host emulate enough of the extension platform for the filters
 * Civil actually has to work around?
 *
 * `host.test.ts` proves the host works against a fixture written to suit it.
 * This file asks the harder question, and answers it from evidence: every
 * assertion below is driven by `fixtures/filterApiSurface.json`, a scan of
 * the twenty-eight real vendor bundles tracked in the Filter-Sources
 * repository (`buildFilterApiSurface.ts` regenerates it; that file documents
 * what the scan can and can't see). When a vendor ships a release that
 * reaches for something new, regenerating the fixture is what turns that
 * into a failing test here.
 *
 * The bundles themselves are not in this repository — the committed scan
 * result is. The last block opts back into the real thing when a checkout of
 * them happens to be present.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { FilterApiSurface } from "./fixtures/buildFilterApiSurface";
import rawSurface from "./fixtures/filterApiSurface.json";
import { loadExtension } from "./host";
import { loadManifest, resolveBackground } from "./manifest";
import type { ExtensionTarget } from "./types";
import { VENDOR_EMULATION } from "./vendorEmulation";

const FILTERS = rawSurface as unknown as Record<string, FilterApiSurface>;
const FILTER_NAMES = Object.keys(FILTERS);

/** Namespaces this host implements for real rather than absorbing into a
 *  stub (see host.ts). Callback delivery, return shapes and stored state are
 *  only meaningfully testable for these. */
const IMPLEMENTED = new Set([
    "runtime",
    "storage",
    "alarms",
    "action",
    "browserAction",
    "tabs",
    "scripting",
    "declarativeNetRequest",
]);

const tempDirs: string[] = [];
afterAll(() => {
    for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

/** Writes a throwaway unpacked extension and returns its directory. */
function writeExtension(files: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), "civil-filter-compat-"));
    tempDirs.push(dir);
    for (const [name, content] of Object.entries(files))
        writeFileSync(join(dir, name), content);
    return dir;
}

/**
 * Timeout for tests that load an MV2 background, which is the only shape that
 * pulls in a DOM (see api/platform.ts).
 *
 * Not masking a hang. That work is a happy-dom import plus a vm load — ~0.5s
 * on an idle machine — but this file runs alongside 30-odd others, and under
 * that contention it has twice crossed the 5s default. Five seconds is not a
 * meaningful bound for it; a test that genuinely hangs still blows through
 * this one.
 */
const DOM_LOAD_TIMEOUT = 20_000;

/** Drains pending microtasks. Same reasoning as host.test.ts: the probes
 *  below chain several `await`s, and each costs a tick to resume. */
async function flushMicrotasks(times = 20): Promise<void> {
    for (let i = 0; i < times; i++) await Promise.resolve();
}

// ---------------------------------------------------------------------------
// Reachability: every namespace and member the filters touch
// ---------------------------------------------------------------------------

/** Union of every `namespace.member` any tracked filter touches. */
const REQUIRED_SURFACE: Record<string, string[]> = (() => {
    const merged = new Map<string, Set<string>>();
    for (const filter of Object.values(FILTERS))
        for (const [namespace, members] of Object.entries(filter.apis)) {
            if (!merged.has(namespace)) merged.set(namespace, new Set());
            for (const member of members) merged.get(namespace)!.add(member);
        }
    return Object.fromEntries(
        [...merged].map(([namespace, members]) => [namespace, [...members]]),
    );
})();

/**
 * Runs one probe script inside the sandbox and reports which members of
 * `REQUIRED_SURFACE` came back missing.
 *
 * Probing from *inside* a loaded extension rather than by inspecting the
 * builder modules is the whole point: what a vendor bundle sees is the
 * assembled, stub-wrapped object graph that `loadExtension` composes, and
 * the wrapping is where reachability is actually decided.
 *
 * Presence and type are checked, not invocation. Calling every member with
 * no arguments would report failures that no real bundle would ever hit —
 * `tabs.get()` without a tab id throws by design — so behavior is covered by
 * the targeted blocks further down instead.
 */
async function probeMissing(
    globalName: "chrome" | "browser",
    target: ExtensionTarget,
): Promise<string[]> {
    const dir = writeExtension({
        "manifest.json": JSON.stringify({
            manifest_version: 3,
            name: "Surface probe",
            version: "1.0.0",
            background: { service_worker: "background.js" },
        }),
        "background.js": `
// Members whose correct value, in real Chrome, is \`undefined\` until
// something sets them. Reading one back as undefined is the API working,
// not a gap — \`runtime.lastError\` is undefined exactly when the last call
// succeeded, which is the normal case and the one this probe is in.
const UNSET_BY_DESIGN = new Set(["runtime.lastError", "extension.lastError"]);
const REQUIRED = ${JSON.stringify(REQUIRED_SURFACE)};
const missing = [];
for (const [namespace, members] of Object.entries(REQUIRED)) {
    for (const member of members) {
        let value;
        try {
            value = ${globalName}[namespace][member];
        } catch (error) {
            missing.push(namespace + "." + member + " threw: " + error.message);
            continue;
        }
        if ((value === undefined || value === null) && !UNSET_BY_DESIGN.has(namespace + "." + member))
            missing.push(namespace + "." + member);
    }
}
chrome.storage.local.set({ __missing: missing });
`,
    });

    const ext = await loadExtension({ dir, target });
    await flushMicrotasks();
    return ext.getStorage().__missing as string[];
}

describe("every API surface the tracked filters touch is reachable", () => {
    // One probe, reused by all twenty-eight assertions: loading the sandbox
    // is the expensive part and the answer does not depend on which filter
    // is asking.
    const missingPromise = probeMissing("chrome", "chrome");

    it.each(FILTER_NAMES)("%s", async name => {
        const missing = new Set(await missingPromise);
        const unreachable: string[] = [];
        for (const [namespace, members] of Object.entries(FILTERS[name]!.apis))
            for (const member of members) {
                const path = `${namespace}.${member}`;
                if (missing.has(path)) unreachable.push(path);
                for (const entry of missing)
                    if (entry.startsWith(`${path} threw`))
                        unreachable.push(entry);
            }
        expect(unreachable).toEqual([]);
    });

    it("exposes the identical surface on the WebKit `browser` global", async () => {
        // Safari and Firefox extensions read `browser`, and plenty of
        // cross-browser vendor bundles feature-detect with
        // `self.browser ?? self.chrome`. A member reachable through one
        // global and not the other would break exactly those bundles.
        const viaChrome = await probeMissing("chrome", "chrome");
        const viaBrowser = await probeMissing("browser", "safari");
        expect(viaBrowser).toEqual(viaChrome);
    });
});

// ---------------------------------------------------------------------------
// Callback-style calls
// ---------------------------------------------------------------------------

/**
 * Arguments for each implemented-namespace path the filters call with a
 * trailing callback, taken from `callbackCalls` in the fixture.
 *
 * This is the convention MV2 has and MV3 kept: `chrome.storage.local.get(keys, cb)`.
 * Seven of the twenty-eight filters are still MV2, where it is the *only*
 * convention available — and the MV3 ones use it too, out of habit and
 * cross-browser code sharing. A method that returns a promise and drops the
 * callback leaves those bundles waiting forever on a reply that never comes,
 * which looks like an extension that simply does nothing rather than one
 * that failed.
 */
const CALLBACK_ARGS: Record<string, unknown[]> = {
    "runtime.sendMessage": ["ping"],
    "storage.local.get": ["seeded"],
    "storage.local.set": [{ written: 1 }],
    "storage.local.remove": ["seeded"],
    "storage.sync.get": ["seeded"],
    "storage.sync.set": [{ written: 1 }],
    "storage.sync.remove": ["seeded"],
    "storage.managed.get": ["policy"],
    "tabs.query": [{ active: true }],
    "tabs.get": [1],
    "tabs.create": [{ url: "https://example.com/" }],
    "tabs.update": [1, { url: "https://example.com/" }],
    "tabs.remove": [1],
    "tabs.reload": [1],
    "tabs.sendMessage": [1, "ping"],
    "tabs.insertCSS": [1, { code: "body{}" }],
    "tabs.captureVisibleTab": [],
    "tabs.detectLanguage": [1],
    "alarms.get": ["periodic"],
    "alarms.clear": ["periodic"],
    "action.setIcon": [{ path: "icon.png" }],
    "scripting.executeScript": [{ target: { tabId: 1 } }],
    "declarativeNetRequest.updateDynamicRules": [
        { addRules: [], removeRuleIds: [] },
    ],
};

/** Every implemented-namespace path any filter calls with a callback, with
 *  the filters that do — so a failure names who breaks. */
const CALLBACK_PATHS: [path: string, callers: string[]][] = (() => {
    const byPath = new Map<string, string[]>();
    for (const [name, filter] of Object.entries(FILTERS))
        for (const path of filter.callbackCalls) {
            if (!IMPLEMENTED.has(path.split(".")[0]!)) continue;
            if (!byPath.has(path)) byPath.set(path, []);
            byPath.get(path)!.push(name);
        }
    return [...byPath].sort(([a], [b]) => a.localeCompare(b));
})();

describe("callback-style calls reach their callback", () => {
    it("covers every implemented-API callback path the fixture found", () => {
        // Guards the table above against the fixture growing past it: a
        // vendor adopting a new callback-style call should fail here loudly
        // rather than silently going untested.
        const untabled = CALLBACK_PATHS.map(([path]) => path).filter(
            path => !(path in CALLBACK_ARGS),
        );
        expect(untabled).toEqual([]);
    });

    it.each(CALLBACK_PATHS)("%s (used by %j)", async path => {
        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: `Callback probe: ${path}`,
                version: "1.0.0",
                background: { service_worker: "background.js" },
            }),
            "background.js": `
chrome.runtime.onMessage.addListener((message, sendResponse) => {
    sendResponse("pong");
});
const args = ${JSON.stringify(CALLBACK_ARGS[path])};
const [namespace, ...rest] = ${JSON.stringify(path.split("."))};
let target = chrome[namespace];
for (const step of rest.slice(0, -1)) target = target[step];
const method = rest[rest.length - 1];
target[method](...args, () => { chrome.storage.session.set({ __fired: true }); });
`,
        });

        const ext = await loadExtension({
            dir,
            initialStorage: { seeded: "value" },
        });
        await flushMicrotasks();
        expect(ext.getStorage("session").__fired).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// runtime.onMessage listener arity
// ---------------------------------------------------------------------------

describe("runtime.onMessage listeners", () => {
    const threeArg = FILTER_NAMES.filter(
        name => FILTERS[name]!.maxMessageListenerArity >= 3,
    );

    it("are written for Chrome's three arguments across the corpus", () => {
        // Twenty of the twenty-eight. Not a stylistic detail: a listener
        // declared `(message, sender, sendResponse)` and dispatched with two
        // arguments receives `undefined` where `sendResponse` belongs, so
        // every reply it attempts throws — and it throws inside the
        // extension's own listener, which reads as the vendor's code being
        // broken rather than the host's dispatch being wrong.
        expect(threeArg.length).toBeGreaterThan(FILTER_NAMES.length / 2);
    });

    it(
        "do not hear the background's own runtime.sendMessage",
        async () => {
            // Chrome fires onMessage in every frame of the extension except the
            // one that sent the message. A background page that broadcasts from
            // inside its own onMessage handler — "the state changed, tell
            // everyone" — is ordinary code, and echoing it back makes it
            // unbounded recursion: mobileguardian re-entered its own listener
            // 18,689 times that way before the stack gave out.
            const dir = writeExtension({
                "manifest.json": JSON.stringify({
                    manifest_version: 2,
                    name: "Self-broadcaster",
                    version: "1",
                    background: { scripts: ["bg.js"] },
                }),
                "bg.js": `
let received = 0;
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    received += 1;
    chrome.storage.local.set({ received });
    // The shape that recurses if the host echoes it back.
    chrome.runtime.sendMessage({ echo: message });
    sendResponse("ack");
    return false;
});
chrome.runtime.sendMessage({ startup: true });
`,
            });
            const ext = await loadExtension({ dir });
            await flushMicrotasks();

            // The startup broadcast reached no listener at all...
            expect(ext.getStorage().received).toBeUndefined();
            expect(ext.sentMessages).toContainEqual({ startup: true });

            // ...while a message from another context still arrives, exactly
            // once, and its own re-broadcast goes nowhere.
            const result = await ext.sendMessage({ fromContentScript: true });
            await flushMicrotasks();
            expect(result.response).toBe("ack");
            expect(ext.getStorage().received).toBe(1);
        },
        DOM_LOAD_TIMEOUT,
    );

    it("receive (message, sender, sendResponse) in that order", async () => {
        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: "Three-argument listener",
                version: "1",
                background: { service_worker: "sw.js" },
            }),
            "sw.js": `
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    sendResponse({ echoed: message, senderId: sender && sender.id });
    return false;
});
`,
        });
        const ext = await loadExtension({ dir, extensionId: "b".repeat(32) });
        const result = await ext.sendMessage("hello");

        expect(result.handled).toBe(true);
        expect(result.response).toEqual({
            echoed: "hello",
            senderId: "b".repeat(32),
        });
    });
});

// ---------------------------------------------------------------------------
// Background entry points
// ---------------------------------------------------------------------------

/** The four shapes the twenty-eight manifests actually use, with how many
 *  filters use each — so this block is provably exhaustive over the corpus
 *  rather than over what MV2/MV3 permit in theory. */
const BACKGROUND_SHAPES = (() => {
    const counts = new Map<string, string[]>();
    for (const [name, filter] of Object.entries(FILTERS)) {
        if (!counts.has(filter.background)) counts.set(filter.background, []);
        counts.get(filter.background)!.push(name);
    }
    return counts;
})();

describe("background entry points", () => {
    it("the corpus uses exactly the shapes covered below", () => {
        // "none" isn't in this list: every one of the 28 real bundles ships
        // some background code (two, lanschoolStudent and ciscoUmbrellaApp,
        // only *looked* backgroundless before resolveBackground learned to
        // read the legacy `app.background.scripts` shape they actually use).
        // The synthetic "no background at all" case below still covers that
        // code path — it's just that nothing in the current corpus needs it.
        expect([...BACKGROUND_SHAPES.keys()].sort()).toEqual([
            "page",
            "scripts",
            "service_worker",
        ]);
    });

    it("runs an MV3 service worker", async () => {
        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: "MV3",
                version: "1",
                background: { service_worker: "sw.js" },
            }),
            "sw.js": `chrome.storage.local.set({ ran: "service_worker" });`,
        });
        const ext = await loadExtension({ dir });
        await flushMicrotasks();
        expect(ext.getStorage().ran).toBe("service_worker");
    });

    it(
        "runs every script of an MV2 multi-script background, in order",
        async () => {
            // MV2 `background.scripts` shares one global between files, and
            // order is load-bearing: vendors put a config or a polyfill first
            // and the code that reads it second.
            const dir = writeExtension({
                "manifest.json": JSON.stringify({
                    manifest_version: 2,
                    name: "MV2 scripts",
                    version: "1",
                    background: { scripts: ["first.js", "second.js"] },
                }),
                "first.js": `var order = ["first"];`,
                "second.js": `order.push("second"); chrome.storage.local.set({ order });`,
            });
            const ext = await loadExtension({ dir });
            await flushMicrotasks();
            expect(ext.getStorage().order).toEqual(["first", "second"]);
        },
        DOM_LOAD_TIMEOUT,
    );

    it(
        "runs the scripts an MV2 background page pulls in",
        async () => {
            // Two filters (goguardian, contentkeeper) ship `background.page`
            // rather than `background.scripts` — an HTML document whose only
            // real content is its <script> tags. Treating it as "no background"
            // means neither of their service workers ever runs, and every
            // assertion about them would be about an extension that did nothing.
            const dir = writeExtension({
                "manifest.json": JSON.stringify({
                    manifest_version: 2,
                    name: "MV2 page",
                    version: "1",
                    background: { page: "background.html" },
                }),
                "background.html": `<!doctype html><html><head>
<script src="lib.js"></script>
<script src="main.js"></script>
</head><body></body></html>`,
                "lib.js": `var loaded = ["lib"];`,
                "main.js": `loaded.push("main"); chrome.storage.local.set({ loaded });`,
            });
            const ext = await loadExtension({ dir });
            await flushMicrotasks();
            expect(ext.getStorage().loaded).toEqual(["lib", "main"]);
        },
        DOM_LOAD_TIMEOUT,
    );

    it("loads a manifest with no background at all without erroring", async () => {
        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 2,
                name: "No background",
                version: "1",
            }),
        });
        await expect(loadExtension({ dir })).resolves.toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// storage.managed — how a school filter gets told what to block
// ---------------------------------------------------------------------------

describe("storage.managed", () => {
    const users = FILTER_NAMES.filter(name =>
        FILTERS[name]!.apis.storage?.includes("managed"),
    );

    it("is read by the filters that take enterprise policy", () => {
        // Not an incidental API for this corpus: a managed Chromebook hands
        // the extension its whole configuration — allowlists, block
        // categories, the tenant it reports to — through managed storage. A
        // host that returns nothing there runs the vendor's *unconfigured*
        // code path, which is not the code path a student's device runs.
        expect(users.length).toBeGreaterThan(0);
    });

    it("returns the policy the harness seeded, not an empty object", async () => {
        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: "Managed policy reader",
                version: "1",
                background: { service_worker: "sw.js" },
            }),
            "sw.js": `
chrome.storage.managed.get(["blocklistUrl"]).then(policy => {
    chrome.storage.local.set({ seenPolicy: policy.blocklistUrl });
});
`,
        });
        const ext = await loadExtension({
            dir,
            managedStorage: { blocklistUrl: "https://vendor.example/list" },
        });
        await flushMicrotasks();
        expect(ext.getStorage().seenPolicy).toBe("https://vendor.example/list");
    });
});

// ---------------------------------------------------------------------------
// declarativeNetRequest, through the path the filters actually use
// ---------------------------------------------------------------------------

describe("declarativeNetRequest as the filters drive it", () => {
    const users = FILTER_NAMES.filter(
        name => FILTERS[name]!.apis.declarativeNetRequest !== undefined,
    );

    it("is used by filters that block through the modern API", () => {
        expect(users.length).toBeGreaterThan(0);
    });

    it("blocks a URL added through updateDynamicRules at runtime", async () => {
        // The realistic shape: rules are not in the manifest, they arrive
        // from the vendor's server and get installed at runtime, usually
        // from inside onInstalled.
        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: "Dynamic blocker",
                version: "1",
                permissions: ["declarativeNetRequest"],
                background: { service_worker: "sw.js" },
            }),
            "sw.js": `
chrome.runtime.onInstalled.addListener(() => {
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
            id: 42,
            priority: 1,
            action: { type: "block" },
            condition: { urlFilter: "||proxy.example", resourceTypes: ["main_frame"] },
        }],
        removeRuleIds: [],
    });
});
`,
        });
        const ext = await loadExtension({ dir });
        await flushMicrotasks();

        expect(
            ext.matchRequest("https://proxy.example/start", {
                resourceType: "main_frame",
            }),
        ).toEqual({ action: "block", matchedRuleId: 42 });
        expect(ext.matchRequest("https://unrelated.example/").action).toBe(
            "none",
        );
    });
});

// ---------------------------------------------------------------------------
// runtime.connect
// ---------------------------------------------------------------------------

describe("runtime.connect", () => {
    const users = FILTER_NAMES.filter(name =>
        FILTERS[name]!.apis.runtime?.includes("connect"),
    );

    it("does not crash the background script of the filters that open ports", async () => {
        // Nine of the twenty-eight reference `runtime.connect`. This host
        // has no second realm to connect *to*, so ports are absorbed by the
        // universal stub rather than implemented: a bundle that opens one
        // and registers handlers on it keeps running, and the messages it
        // would have exchanged go nowhere.
        //
        // What this asserts is exactly that and no more — that port setup is
        // survivable, not that port messaging works. A test that needs a
        // reply to travel over a port is a test this host cannot serve yet.
        expect(users.length).toBeGreaterThan(0);

        const dir = writeExtension({
            "manifest.json": JSON.stringify({
                manifest_version: 3,
                name: "Port user",
                version: "1",
                background: { service_worker: "sw.js" },
            }),
            "sw.js": `
const port = chrome.runtime.connect({ name: "vendor-channel" });
port.onMessage.addListener(() => {});
port.onDisconnect.addListener(() => {});
port.postMessage({ hello: true });
chrome.storage.local.set({ survivedPortSetup: true });
`,
        });
        const ext = await loadExtension({ dir });
        await flushMicrotasks();
        expect(ext.getStorage().survivedPortSetup).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// The real bundles, when they happen to be present
// ---------------------------------------------------------------------------

const BUNDLE_ROOT =
    process.env.CIVIL_FILTER_BUNDLES ?? join(homedir(), "extensions");
const haveBundles = existsSync(BUNDLE_ROOT);

/**
 * What a filter needs before it will run its configured code path rather than
 * its "I am not set up" path.
 *
 * Lightspeed Insight refuses to start without an enterprise policy and two
 * replies from its own server, so without this it runs about four statements
 * and stops — which would make every observation of it an observation of an
 * extension that gave up.
 *
 * All three pieces come from reading the bundle, not from guessing:
 *
 *   - `schema.json` in the bundle declares the whole managed-policy surface:
 *     `EntitlementKey` and `Env`, both strings, nothing else. `js/utils.js`
 *     rejects when the value is empty, so any non-empty string gets past it —
 *     hence a random one here. It is a placeholder, not a real tenant's key,
 *     and it never leaves the process.
 *   - `Env` selects one of the bundle's own `env/{dev,qa,prod}.json` files
 *     for its endpoints, which `fetch` already serves from disk.
 *   - `js/api.js` then calls `verifyUrl/{key}` and
 *     `agentConfigUrl/{platform}/{key}` and throws on anything but 2xx. Those
 *     are the two replies below. The config fields are the ones
 *     `background.js` actually reads, and `speedTestActive: false` keeps its
 *     `client.wasm` speed-test engine (a Go/QUIC build — decompiling it shows
 *     `Lightspeed-Systems/insight-speedtest` and no entitlement logic at all)
 *     from trying to open QUIC connections that this host has no network for.
 *
 * `vendorEmulation.ts` — shared with misc/filterProbe/sandbox.ts, so a
 * bundle's configured/enrolled state is the same in both places it's tested —
 * carries the same idea for Securly, iboss, Linewize and Aristotle.
 */
const VENDOR_SETUP: Record<
    string,
    {
        managedStorage?: Record<string, unknown>;
        initialStorage?: Record<string, unknown>;
        initialBookmarks?: { title: string; url: string }[];
        network?: (request: {
            url: string;
            method: string;
        }) => Response | undefined | Promise<Response | undefined>;
    }
> = {
    ...VENDOR_EMULATION,
    lightspeedInsightAgent: {
        managedStorage: {
            EntitlementKey: randomUUID(),
            Env: "prod",
        },
        network: ({ url }) => {
            const json = (body: unknown) =>
                new Response(JSON.stringify(body), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                });
            if (url.includes("/agentconfig/keys/verify")) return json({});
            if (url.includes("/agentconfig/v2"))
                return json({
                    active: true,
                    speedTestActive: false,
                    locationDataActive: false,
                    collectPII: false,
                    log: false,
                    sendInterval: 300,
                    checkinInterval: 3600,
                    inactiveTimeout: 900,
                    minCheck: 60,
                    maxCheck: 600,
                    maxAge: 86400,
                    maxPayload: 100,
                    payloadActivityMaxCount: 100,
                    adaptiveLimit: 10,
                    chunkSize: 1024,
                    chunkCount: 4,
                    endpointURL: "https://agent.catchon.test/collect",
                    digitalEquityURL: "https://agent.catchon.test/equity",
                    speedTestURL: "https://agent.catchon.test/speed",
                });
            return undefined;
        },
    },
};

/**
 * Errors a bundle still reports after startup. Usually the bundle's own
 * behavior rather than a gap in the host — pinned rather than hidden, so a
 * change in either direction shows up as a failing test.
 *
 * `lanschoolStudent` is the one real exception: this genuinely is a host
 * gap, `chrome.app.window.create(...)`'s callback-style result being
 * `undefined` instead of a real `AppWindow` (`.setBounds`, `.show`, `.close`,
 * ...) — surfaced now that `resolveBackground` actually loads this bundle's
 * legacy `app.background` shape (misc/filterProbe/vendors.ts's own doc
 * comment has the fuller story). Left unbuilt on purpose: it's Chrome Apps'
 * window-management API, reached from this vendor's full-screen "blank
 * screen" lockdown UI, nothing to do with filtering, and lanschoolStudent
 * isn't even lanschool's primary folder for the filter-probe harness
 * anymore — lanschoolWebHelper is, since it's the one that actually blocks.
 */
const KNOWN_ASYNC_FAILURES: Record<string, RegExp> = {
    lanschoolStudent: /setBounds/,
};

/**
 * Everything above runs off the committed scan, which is what lets it run
 * anywhere. This block runs against the bundles themselves when a checkout of
 * them happens to be present.
 *
 * "Starts up" means what it says: the vendor's real background code — the
 * whole graph of it, service worker or background page — runs to completion
 * against this host's `chrome` and its surrounding platform, and neither
 * throws nor leaves a rejected promise behind. Getting there took the
 * platform layer in api/platform.ts; before it, most of these bundles died
 * on `window`, `Response`, `EventTarget` or an ES-module entry point rather
 * than on anything to do with the extension API.
 */
describe.skipIf(!haveBundles)("real vendor bundles", () => {
    /**
     * Loads one bundle and collects everything that went wrong, including
     * what surfaced after startup returned.
     *
     * Vitest installs its own `unhandledRejection`/`uncaughtException`
     * handlers and fails the run on either. That is right for test code and
     * wrong here: a vendor bundle's stray rejection is the *subject* of this
     * test, not an accident in it. So the handlers are swapped out for the
     * duration of one load and restored immediately after.
     */
    async function startupProblems(
        dir: string,
        setup?: (typeof VENDOR_SETUP)[string],
    ): Promise<string[]> {
        const problems: string[] = [];
        const describeError = (error: unknown) =>
            error instanceof Error
                ? `${error.name}: ${error.message.split("\n")[0]}`
                : String(error);

        const saved = {
            rejection: process.listeners("unhandledRejection"),
            exception: process.listeners("uncaughtException"),
        };
        process.removeAllListeners("unhandledRejection");
        process.removeAllListeners("uncaughtException");
        const onRejection = (reason: unknown) =>
            problems.push(describeError(reason));
        const onException = (error: Error) =>
            problems.push(describeError(error));
        process.on("unhandledRejection", onRejection);
        process.on("uncaughtException", onException);

        let handle: Awaited<ReturnType<typeof loadExtension>> | undefined;
        try {
            handle = await loadExtension({
                dir,
                extensionId: "a".repeat(32),
                ...(setup ?? {}),
            });
        } catch (error) {
            problems.push(describeError(error));
        }
        // Microtasks first, then one real turn: a rejection is only
        // *unhandled* once the microtask queue has drained without anyone
        // attaching a catch.
        await flushMicrotasks(50);
        await new Promise(resolve => setTimeout(resolve, 50));
        handle?.dispose();

        process.off("unhandledRejection", onRejection);
        process.off("uncaughtException", onException);
        for (const listener of saved.rejection)
            process.on("unhandledRejection", listener);
        for (const listener of saved.exception)
            process.on("uncaughtException", listener);

        return [...new Set(problems)];
    }

    it.each(FILTER_NAMES)(
        "%s starts up",
        async name => {
            const dir = join(BUNDLE_ROOT, name);
            // Asserted, not skipped past: a silent `return` here would let a
            // missing bundle report as a pass, having started up nothing.
            expect(existsSync(dir), `${name} bundle is missing`).toBe(true);

            // The committed scan has to still describe the bundle on disk, or
            // every fixture-driven assertion above is testing a stale idea of
            // this vendor.
            const manifest = await loadManifest(dir);
            expect(manifest.manifest_version).toBe(
                FILTERS[name]!.manifestVersion,
            );
            expect(resolveBackground(manifest).type).toBe(
                FILTERS[name]!.background,
            );

            const problems = await startupProblems(dir, VENDOR_SETUP[name]);
            const known = KNOWN_ASYNC_FAILURES[name];
            if (known) {
                expect(problems.join(" | ")).toMatch(known);
                return;
            }
            expect(problems).toEqual([]);
        },
        30_000,
    );
});

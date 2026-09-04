/**
 * Regenerates `filterApiSurface.json` — the record of which parts of the
 * extension API each tracked filter vendor actually touches.
 *
 * ## Why a generated fixture and not a live scan
 *
 * `filterCompat.test.ts` asks one question: does this host expose everything
 * the twenty-eight filters in the Filter-Sources repo need? Answering it
 * needs the vendors' real bundles, which are ~200MB of third-party code that
 * has no business living in this repository. So the *answer* is committed
 * (a ~40KB JSON summary) and the bundles are not: the test runs anywhere,
 * and re-deriving it is one command on a machine that has them.
 *
 * ```sh
 * bun misc/extensionHost/fixtures/buildFilterApiSurface.ts
 * # or, if the bundles live elsewhere:
 * CIVIL_FILTER_BUNDLES=/path/to/unpacked bun misc/extensionHost/fixtures/buildFilterApiSurface.ts
 * ```
 *
 * The folder names are the `folder` keys from Filter-Sources' extensions.json,
 * so a bundle directory and a tracked filter are the same thing by name.
 *
 * ## What it extracts, and how honest each field is
 *
 * `manifest*`, `permissions`, `background`, `contentScripts`: read straight
 * out of manifest.json. Exact.
 *
 * `apis`: every `chrome.<ns>.<member>` / `browser.<ns>.<member>` in the
 * bundle's JS and HTML, filtered to real extension API namespaces (see
 * `KNOWN_NAMESPACES`). A regex, not a parser — it cannot see APIs reached
 * through an alias (`const s = chrome.storage; s.local.get(...)`) and it
 * would happily record a namespace named in a comment. Both directions of
 * error are acceptable here because of what the data is used for: the test
 * asserts the host provides *at least* this surface, so a false positive
 * costs a stub that nobody needed, and a false negative is a gap the test
 * simply doesn't cover rather than one it gets wrong. The filter to known
 * namespaces exists because the raw scan pulls in `chrome.google.com` from
 * URL strings and a `browser.params` from one vendor's own object.
 *
 * `callbackCalls`: calls that pass a function as a later argument —
 * `chrome.storage.local.get(keys, cb)`. This is the *only* calling
 * convention MV2 has (Chrome added promises with MV3), so a host whose
 * implemented methods are promise-only silently never calls these back. That
 * is the specific thing this field exists to make testable; see the
 * "callback-style calls" block in filterCompat.test.ts.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { resolveBackground } from "../manifest";

/**
 * Real extension API namespaces. Anything else a `chrome.x.y` regex turns up
 * is a false positive — a hostname in a string literal, a vendor's own
 * object that happens to be named `browser`, a typo in dead code.
 * Deliberately broader than what the filters currently use: a namespace
 * appearing here does not mean anything needs it, only that if a bundle
 * mentions it, it meant the API.
 */
const KNOWN_NAMESPACES = new Set([
    "accessibilityFeatures",
    "action",
    "alarms",
    "app",
    "audio",
    "bookmarks",
    "browserAction",
    "browsingData",
    "certificateProvider",
    "clipboard",
    "commands",
    "contentSettings",
    "contextMenus",
    "cookies",
    "debugger",
    "declarativeContent",
    "declarativeNetRequest",
    "declarativeWebRequest",
    "desktopCapture",
    "devtools",
    "documentScan",
    "dom",
    "downloads",
    "enterprise",
    "events",
    "extension",
    "extensionTypes",
    "fileBrowserHandler",
    "fileSystemProvider",
    "fontSettings",
    "gcm",
    "history",
    "i18n",
    "identity",
    "idle",
    "input",
    "instanceID",
    "loginState",
    "management",
    "networking",
    "notifications",
    "offscreen",
    "omnibox",
    "pageAction",
    "pageCapture",
    "permissions",
    "platformKeys",
    "power",
    "printerProvider",
    "printing",
    "printingMetrics",
    "privacy",
    "processes",
    "proxy",
    "readingList",
    "runtime",
    "scripting",
    "search",
    "serial",
    "sessions",
    "sidePanel",
    "sockets",
    "storage",
    "system",
    "systemLog",
    "tabCapture",
    "tabGroups",
    "tabs",
    "topSites",
    "tts",
    "ttsEngine",
    "types",
    "userScripts",
    "virtualKeyboard",
    "vpnProvider",
    "wallpaper",
    "webAuthenticationProxy",
    "webNavigation",
    "webRequest",
    "windows",
]);

const MEMBER =
    /\b(?:chrome|browser)\s*\.\s*([A-Za-z_$][\w$]*)\s*\.\s*([A-Za-z_$][\w$]*)/g;

/**
 * A call whose second-or-later argument is a function literal. Run against
 * whitespace-stripped source, because minified bundles have none and
 * unminified ones would otherwise need the pattern to tolerate arbitrary
 * indentation. The `[^()]{0,240}?` argument run means calls whose earlier
 * arguments themselves contain parentheses are missed — an undercount, which
 * is the safe direction: this field is only ever used to prove that callback
 * style *is* used, never that it isn't.
 */
const CALLBACK_CALL =
    /\b(?:chrome|browser)\.([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?\.([A-Za-z_$][\w$]*)\([^()]{0,240}?,(?:function[\w$]*\(|[\w$]+=>|\([\w$,]*\)=>)/g;

/**
 * An `onMessage.addListener` registration, capturing its parameter list so
 * the arity can be counted. Chrome passes `(message, sender, sendResponse)`;
 * a listener written for three and handed two gets `undefined` where
 * `sendResponse` should be, and throws on every reply it tries to send.
 * Recorded per bundle so `filterCompat.test.ts` can assert the arity against
 * the corpus that actually depends on it rather than against a number
 * written into a comment.
 */
const MESSAGE_LISTENER =
    /onMessage\.addListener\(\s*(?:function[\w$]*\s*)?\(?\s*([^)=]{0,120}?)\s*\)?\s*(?:=>|\{)/g;

const SCANNABLE = /\.(?:js|mjs|html)$/i;
/** Source maps and bundled model weights blow past this; nothing that big is
 *  hand-written API-calling code. */
const MAX_FILE_BYTES = 12 * 1024 * 1024;

export interface FilterApiSurface {
    manifestVersion: 2 | 3;
    /** How the extension declares background code, in the shape
     *  `manifest.ts:resolveBackground` has to handle. */
    background: "service_worker" | "scripts" | "page" | "none";
    permissions: string[];
    hostPermissions: string[];
    contentScripts: number;
    declarativeNetRequestRulesets: number;
    /** namespace -> members touched, both sorted. */
    apis: Record<string, string[]>;
    /** `"storage.local.get"`-style paths called with a function argument. */
    callbackCalls: string[];
    /** Most parameters any `runtime.onMessage` listener in this bundle
     *  declares. 3 means it expects Chrome's `(message, sender, sendResponse)`. */
    maxMessageListenerArity: number;
    scannedFiles: number;
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path, out);
        else out.push(path);
    }
    return out;
}

function scanBundle(dir: string): FilterApiSurface {
    // A BOM before `{` is real in a couple of these bundles and JSON.parse
    // rejects it.
    const manifest = JSON.parse(
        readFileSync(join(dir, "manifest.json"), "utf8").replace(/^﻿/, ""),
    );
    const background = resolveBackground(manifest).type;

    const apis = new Map<string, Set<string>>();
    const callbackCalls = new Set<string>();
    let maxMessageListenerArity = 0;
    let scannedFiles = 0;

    for (const file of walk(dir)) {
        if (!SCANNABLE.test(file)) continue;
        if (statSync(file).size > MAX_FILE_BYTES) continue;
        scannedFiles++;
        // latin1, not utf8: these are third-party bundles of unknown
        // encoding and every pattern here is ASCII, so decoding bytes
        // one-to-one is both faster and immune to a bad UTF-8 sequence
        // truncating a file mid-scan.
        const text = readFileSync(file, "latin1");

        for (const [, namespace, member] of text.matchAll(MEMBER)) {
            if (!KNOWN_NAMESPACES.has(namespace!)) continue;
            if (!apis.has(namespace!)) apis.set(namespace!, new Set());
            apis.get(namespace!)!.add(member!);
        }

        const dense = text.replace(/\s+/g, "");
        for (const [, a, b, c] of dense.matchAll(CALLBACK_CALL)) {
            if (!KNOWN_NAMESPACES.has(a!)) continue;
            callbackCalls.add(b ? `${a}.${b}.${c}` : `${a}.${c}`);
        }

        for (const [, params = ""] of text.matchAll(MESSAGE_LISTENER)) {
            const arity = params.trim()
                ? params.split(",").filter(part => part.trim()).length
                : 0;
            maxMessageListenerArity = Math.max(maxMessageListenerArity, arity);
        }
    }

    return {
        manifestVersion: manifest.manifest_version,
        background,
        permissions: (manifest.permissions ?? []).filter(
            (p: unknown) => typeof p === "string",
        ),
        hostPermissions: manifest.host_permissions ?? [],
        contentScripts: (manifest.content_scripts ?? []).length,
        declarativeNetRequestRulesets: (
            manifest.declarative_net_request?.rule_resources ?? []
        ).length,
        apis: Object.fromEntries(
            [...apis]
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([ns, members]) => [ns, [...members].sort()]),
        ),
        callbackCalls: [...callbackCalls].sort(),
        maxMessageListenerArity,
        scannedFiles,
    };
}

function main(): void {
    const root =
        process.env.CIVIL_FILTER_BUNDLES ?? join(homedir(), "extensions");
    const out: Record<string, FilterApiSurface> = {};

    for (const folder of readdirSync(root).sort()) {
        const dir = join(root, folder);
        if (!statSync(dir).isDirectory()) continue;
        out[folder] = scanBundle(dir);
        process.stdout.write(
            `${folder}: mv${out[folder]!.manifestVersion} ` +
                `${Object.keys(out[folder]!.apis).length} namespaces, ` +
                `${out[folder]!.callbackCalls.length} callback-style calls\n`,
        );
    }

    const target = join(import.meta.dirname, "filterApiSurface.json");
    writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
    process.stdout.write(
        `\nwrote ${Object.keys(out).length} filters to ${target}\n`,
    );
}

main();

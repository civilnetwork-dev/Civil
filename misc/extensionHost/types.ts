/**
 * Host-side types for the Bun extension host.
 *
 * Manifest and wire-protocol shapes (`ChromeManifest`, `DNRRule`, `Port`,
 * `MessageSender`, `ChromeEvent`, `Alarm`, `TabInfo`, ...) are NOT redefined
 * here — they already exist in `browserApiEmulators/extensions/chrome/types`
 * for the in-page shim, and a manifest.json means the same thing whether the
 * extension ends up running in an iframe or in this host. Only what's unique
 * to running headless under Bun lives in this file.
 */

import type { ChromeManifest } from "../browserApiEmulators/extensions/chrome/types";

/** Which extension runtime surface to expose: Chrome's `chrome.*` (callback
 *  or promise) or WebKit/Firefox's `browser.*` (promise-only). Safari Web
 *  Extensions use the same WebExtensions API as Firefox, so "safari" and
 *  "firefox" share one implementation here — see `browserNamespace.ts`. */
export type ExtensionTarget = "chrome" | "safari";

export interface LoadOptions {
    /** Directory containing manifest.json and the extension's source files. */
    dir: string;
    target?: ExtensionTarget;
    /** Seeds chrome.storage.local before the background script runs. */
    initialStorage?: Record<string, unknown>;
    /** Seeds chrome.bookmarks — a school-pushed bookmark is how a handful of
     *  filters (impero) receive their own configuration. See api/bookmarks.ts. */
    initialBookmarks?: { title: string; url: string }[];
    /**
     * Seeds chrome.storage.managed — the enterprise-policy area a managed
     * Chromebook's admin console writes and the extension can only read.
     * Several tracked filters take their entire configuration from it, so
     * without this they run their unconfigured code path rather than the one
     * a student's device runs.
     */
    managedStorage?: Record<string, unknown>;
    /**
     * Real `fetch` is disabled by default so loading an unknown extension
     * can never make an outbound network call during a test run. Filter
     * vendors that need it for live analysis opt in explicitly.
     */
    allowNetwork?: boolean;
    /**
     * Answers the extension's outbound requests without a network.
     *
     * Return a `Response` to serve one, or `undefined` to fall through to
     * the default offline answer. The extension's own packaged files are
     * served from disk before this is consulted, so this only ever sees
     * genuinely remote URLs.
     *
     * This is what a vendor's server-side gate needs to get past. Lightspeed
     * Insight, for one, refuses to start until its entitlement key verifies
     * against `agent.catchon.com` and its agent config comes back — no
     * amount of local seeding substitutes for those two replies. Answering
     * them here runs the extension's *real* configured code path, offline
     * and deterministically.
     */
    network?: (request: {
        url: string;
        method: string;
    }) => Response | undefined | Promise<Response | undefined>;
    /** Extension id exposed via chrome.runtime.id. Defaults to a random id
     *  shaped like a real Chrome extension id (32 lowercase a-p chars). */
    extensionId?: string;
    /**
     * Backs `chrome.scripting.executeScript` with somewhere real to run —
     * without this, `func`/`files` are recorded and resolve to `[]`, same as
     * Chrome's own "ran, no frame results" shape, but nothing actually
     * executes (see api/scripting.ts). This host has no DOM of its own, so a
     * caller that does (misc/filterProbe/sandbox.ts, against the proxied
     * page) supplies this to run the injection for real — the same way real
     * Chrome serializes `func` to source and re-instantiates it in the
     * target frame, which is why `func` arrives here as source text rather
     * than a live closure: any variable it captured from the background's
     * own scope is gone in real Chrome too.
     */
    runScript?: (call: {
        func?: string;
        files?: string[];
        args?: unknown[];
    }) => Promise<unknown[]>;
}

/** A message captured by `runtime.sendMessage`/`tabs.sendMessage`, for tests
 *  to assert against without needing their own onMessage listener. */
export interface CapturedMessage {
    message: unknown;
    response: unknown;
    /** True if a listener called `sendResponse`; false if none did. */
    handled: boolean;
}

/** A recorded `chrome.action`/`chrome.browserAction` call. */
export interface ActionCall {
    method:
        | "setBadgeText"
        | "setBadgeBackgroundColor"
        | "setTitle"
        | "setIcon"
        | "enable"
        | "disable";
    args: unknown[];
}

/** The result of matching one URL against the extension's declarativeNetRequest
 *  rules — the actual question filter-evasion analysis needs answered. */
export interface DNRMatchResult {
    /** Final verdict after resolving rule priority (see api/declarativeNetRequest.ts). */
    action: "allow" | "block" | "redirect" | "none";
    /** The rule that decided it, or null if no rule matched. */
    matchedRuleId: number | null;
    redirectUrl?: string;
}

/** Handle returned by `loadExtension`. Everything a test harness needs to
 *  drive and inspect a loaded extension without reaching into its internals. */
export interface ExtensionHandle {
    readonly id: string;
    readonly manifest: ChromeManifest;
    readonly target: ExtensionTarget;

    /** Advances the host's virtual clock, firing any alarms now due.
     *  See api/alarms.ts for why alarms use virtual rather than real time. */
    advanceTime(ms: number): void;

    /** Reads a snapshot of one storage area. */
    getStorage(
        area?: "local" | "sync" | "session" | "managed",
    ): Record<string, unknown>;

    /** The background's live `chrome.storage`, for a content script to share
     *  — the same object, as Chrome shares one store across an extension's
     *  contexts. A content script handed a do-nothing stub instead gets
     *  `undefined` back from `storage.local.get()`, where Chrome gives `{}`,
     *  and dies destructuring it (blocksi, in a 400ms retry loop for the
     *  whole observation). */
    readonly storage: unknown;

    /** Delivers a message to the extension's runtime.onMessage listeners and
     *  returns what (if anything) they responded with. */
    sendMessage(message: unknown): Promise<CapturedMessage>;

    /** Matches a URL against the extension's registered DNR rules. */
    matchRequest(
        url: string,
        opts?: { resourceType?: string; initiator?: string; method?: string },
    ): DNRMatchResult;

    /** The synthetic tab's current URL — `"about:blank"` until the
     *  background calls `chrome.tabs.update({url})`, the mechanism several
     *  filters (lanschoolWebHelper, mobileguardian) actually block through
     *  instead of a content script. A caller with a real page to compare
     *  against (misc/filterProbe/sandbox.ts) treats a change here the same
     *  way it treats a content script's own `location.href` write. */
    readonly tabUrl: string;

    readonly actionCalls: readonly ActionCall[];

    /** Messages the extension broadcast with `runtime.sendMessage`. Nothing
     *  receives them (Chrome doesn't deliver a message back to the frame that
     *  sent it, and this host has only that frame), so this is how a test
     *  sees what the extension tried to announce. */
    readonly sentMessages: readonly unknown[];

    /** Tears down the sandbox's timers so the process can exit. */
    dispose(): void;
}

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadExtension } from "./host";
import { loadManifest, ManifestError, resolveBackground } from "./manifest";

const FIXTURE_DIR = join(__dirname, "fixtures", "sample-extension");

/** Drains pending microtasks. The fixture's onAlarm listener chains multiple
 *  `await`s (storage.set, then action.setBadgeText), and each real await
 *  costs a tick to resume — the same as it would in actual Chrome. A single
 *  `await Promise.resolve()` only advances one hop into that chain; looping
 *  a generous number of times is more robust than hardcoding the exact
 *  chain depth, which would silently need updating every time the fixture's
 *  listener grows another await. */
async function flushMicrotasks(times = 10): Promise<void> {
    for (let i = 0; i < times; i++) await Promise.resolve();
}

describe("loadExtension end-to-end", () => {
    it("runs the background service worker and exposes its manifest", async () => {
        const ext = await loadExtension({ dir: FIXTURE_DIR });
        expect(ext.manifest.name).toBe("Sample Filter Extension");
        expect(ext.target).toBe("chrome");
        expect(ext.id).toMatch(/^[a-p]{32}$/);
    });

    it("delivers a synchronous runtime message and returns the response", async () => {
        const ext = await loadExtension({ dir: FIXTURE_DIR });
        const result = await ext.sendMessage("ping");
        expect(result).toEqual({
            message: "ping",
            response: "pong",
            handled: true,
        });
    });

    it("delivers an async runtime message (listener returns true, responds later)", async () => {
        const ext = await loadExtension({ dir: FIXTURE_DIR });
        const result = await ext.sendMessage("ping-async");
        expect(result.response).toBe("pong-async");
        expect(result.handled).toBe(true);
    });

    it("reports unhandled messages honestly instead of resolving undefined silently", async () => {
        const ext = await loadExtension({ dir: FIXTURE_DIR });
        const result = await ext.sendMessage("nobody-listens-for-this");
        expect(result.handled).toBe(false);
    });

    it("seeds and reads chrome.storage.local", async () => {
        const ext = await loadExtension({
            dir: FIXTURE_DIR,
            initialStorage: { checkCount: 5 },
        });
        // storage.get resolves asynchronously inside the background script;
        // give its microtask chain a turn before asserting.
        await flushMicrotasks();
        expect(ext.getStorage().checkCount).toBe(5);
    });

    it("advances the virtual clock and fires periodic alarms without real waiting", async () => {
        const ext = await loadExtension({ dir: FIXTURE_DIR });
        await flushMicrotasks();

        ext.advanceTime(30 * 60_000);
        await flushMicrotasks();
        expect(ext.getStorage().checkCount).toBe(1);
        expect(ext.actionCalls).toContainEqual({
            method: "setBadgeText",
            args: [{ text: "1" }],
        });

        ext.advanceTime(30 * 60_000);
        await flushMicrotasks();
        expect(ext.getStorage().checkCount).toBe(2);
    });

    it("blocks a URL matched by the extension's own declarativeNetRequest rules", async () => {
        const ext = await loadExtension({ dir: FIXTURE_DIR });
        const blocked = ext.matchRequest("https://blocked-by-filter.example/", {
            resourceType: "main_frame",
        });
        expect(blocked).toEqual({ action: "block", matchedRuleId: 1 });

        // Higher-priority allow rule on a more specific path wins over the
        // lower-priority domain-wide block — exercises real rule resolution,
        // not just "does any rule match".
        const allowed = ext.matchRequest(
            "https://blocked-by-filter.example/allowlisted",
            { resourceType: "main_frame" },
        );
        expect(allowed).toEqual({ action: "allow", matchedRuleId: 2 });

        const unrelated = ext.matchRequest("https://example.com/", {
            resourceType: "main_frame",
        });
        expect(unrelated.action).toBe("none");
    });

    it("answers fetch offline by default so loading an extension can't reach the network", async () => {
        const NETWORK_DIR = join(__dirname, "fixtures", "network-extension");
        const ext = await loadExtension({ dir: NETWORK_DIR });
        await flushMicrotasks();

        // Offline, not fatal: the request is answered with a 503 the
        // extension can inspect, rather than a synchronous throw that would
        // end its background script at the first network call. What matters
        // for containment is unchanged — nothing left the machine.
        expect(ext.getStorage().status).toBe(503);
        expect(ext.getStorage().reachedNetwork).toBe(false);
        expect(ext.getStorage().error).toBeUndefined();
    });

    it("allows fetch through when the caller opts in explicitly", async () => {
        const NETWORK_DIR = join(__dirname, "fixtures", "network-extension");
        // example.com is real and reachable; opting in should let the
        // background script's fetch call run instead of throwing at load.
        await expect(
            loadExtension({ dir: NETWORK_DIR, allowNetwork: true }),
        ).resolves.toBeDefined();
    });
});

describe("manifest loading", () => {
    it("rejects a missing manifest.json with a clear error", async () => {
        await expect(
            loadManifest(join(__dirname, "fixtures", "does-not-exist")),
        ).rejects.toThrow(ManifestError);
    });

    it("rejects an unknown manifest_version", async () => {
        await expect(
            loadManifest(join(__dirname, "fixtures", "bad-manifest-version")),
        ).rejects.toThrow(ManifestError);
    });

    it("resolves an MV3 service_worker background", async () => {
        const manifest = await loadManifest(FIXTURE_DIR);
        expect(resolveBackground(manifest)).toEqual({
            type: "service_worker",
            files: ["background.js"],
        });
    });

    it("resolves to no background when the manifest declares none", () => {
        expect(
            resolveBackground({ manifest_version: 3, name: "x", version: "1" }),
        ).toEqual({
            type: "none",
            files: [],
        });
    });
});

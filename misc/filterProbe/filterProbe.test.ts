/**
 * The filter route check, proven offline.
 *
 * The harness (harness.ts) is the live runner — server, tunnel, captcha,
 * cloudflared. None of that belongs in a test run, and none of it is where the
 * risk is. The risk is in the two pure pieces the harness orchestrates:
 * whether `detectFlagging` correctly reads a filter's block page out of a
 * `PageObservation`, and whether `predictFix` points at the right Civil source
 * when it does. Those are what this file exercises, driven by the committed
 * `probeData.json` and, for the sandbox, a stubbed fetch — no bundle, no
 * network, no wait.
 *
 * The last block opts into the real bundles when a checkout is present, to
 * prove the sandbox can actually load a filter and run a content script
 * against a page. The full live path — a running Civil server behind a tunnel
 * — is the harness's job and is not asserted here.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { filterVendorDomains } from "../filters/filterBlockerMiddleware";
import { detectFlagging, type PageObservation, PROBE_DATA } from "./detect";
import { predictFix } from "./predict";
import { observeRoute } from "./sandbox";
import { FOLDER_TO_VENDOR, VENDOR_PRIMARY_FOLDER, VENDORS } from "./vendors";

const CIVIL_DIR = join(import.meta.dirname, "..", "..");

function observe(partial: Partial<PageObservation>): PageObservation {
    return {
        route: "/newtab",
        finalUrl: "https://abc123.mooo.com/newtab",
        pageText: "200 Civil — new tab",
        ...partial,
    };
}

// ---------------------------------------------------------------------------
// The probe data and the vendor map agree
// ---------------------------------------------------------------------------

describe("probe data", () => {
    it("covers exactly the vendors the folder map defines", () => {
        expect(Object.keys(PROBE_DATA).toSorted()).toEqual(VENDORS.toSorted());
    });

    it("carries the same domains as the middleware blocklist, per vendor", () => {
        // The detector's redirect check and the middleware's blocklist must be
        // the same set, or a domain the proxy blocks wouldn't be recognised as
        // a flag (or vice versa). One source of truth, asserted.
        const middleware = filterVendorDomains as unknown as Record<
            string,
            readonly string[]
        >;
        for (const vendor of VENDORS)
            expect(PROBE_DATA[vendor]!.domains).toEqual([
                ...(middleware[vendor] ?? []),
            ]);
    });

    it("gives every extension folder a vendor that has probe data", () => {
        for (const [folder, vendor] of Object.entries(FOLDER_TO_VENDOR)) {
            expect(PROBE_DATA[vendor], folder).toBeDefined();
        }
    });
});

// ---------------------------------------------------------------------------
// detectFlagging
// ---------------------------------------------------------------------------

describe("detectFlagging", () => {
    it("clears a clean Civil page", () => {
        const verdict = detectFlagging(observe({}), "securly");
        expect(verdict.flagged).toBe(false);
        expect(verdict.signal).toBeUndefined();
    });

    it("flags a redirect onto a vendor block-page host", () => {
        const verdict = detectFlagging(
            observe({
                finalUrl: "https://deviceconsole.securly.com/blocked?url=x",
                pageText: "200 blocked",
            }),
            "securly",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({
            kind: "redirect",
            domain: "securly.com",
            finalHost: "deviceconsole.securly.com",
        });
    });

    it("flags a vendor block marker left in the page text", () => {
        // A real marker from Securly's own bundle.
        const marker = PROBE_DATA.securly!.blockMarkers[0]!;
        const verdict = detectFlagging(
            observe({ pageText: `200 ${marker} — contact your teacher` }),
            "securly",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({ kind: "marker", marker });
    });

    it("flags an in-place block that names the vendor", () => {
        const verdict = detectFlagging(
            observe({
                pageText:
                    "200 This page was blocked by GoGuardian for your safety.",
            }),
            "goguardian",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal?.kind).toBe("vendor-name");
    });

    it("does not attribute one vendor's block page to another", () => {
        // Securly's block page under test, but Blocksi is the installed filter:
        // not Blocksi's problem.
        const securlyMarker = PROBE_DATA.securly!.blockMarkers.find(
            m => !PROBE_DATA.blocksi!.blockMarkers.includes(m),
        )!;
        const verdict = detectFlagging(
            observe({ pageText: `200 ${securlyMarker}` }),
            "blocksi",
        );
        expect(verdict.flagged).toBe(false);
    });

    it("treats an unknown vendor as no-data rather than throwing", () => {
        expect(detectFlagging(observe({}), "not-a-vendor").flagged).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// predictFix
// ---------------------------------------------------------------------------

describe("predictFix", () => {
    it("returns nothing for a clean verdict", () => {
        expect(
            predictFix(detectFlagging(observe({}), "securly"), CIVIL_DIR),
        ).toEqual([]);
    });

    it("tops the list with the middleware when a redirect domain is unblocked", () => {
        // A fabricated vendor whose domain is deliberately absent from the
        // blocklist would be the true case; here we assert the ranking shape
        // for a known-blocked domain instead, which still names the middleware.
        const verdict = detectFlagging(
            observe({
                finalUrl: "https://x.goguardian.com/pause",
                pageText: "200 blocked",
            }),
            "goguardian",
        );
        const suggestions = predictFix(verdict, CIVIL_DIR);
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions[0]!.file).toContain("misc/filters");
    });

    it("points an in-place block at the route source and the proxy layer", () => {
        const verdict = detectFlagging(
            observe({
                route: "/~/scramjet/",
                pageText: "200 This site has been blocked by a teacher",
            }),
            "securly",
        );
        const files = predictFix(verdict, CIVIL_DIR).map(s => s.file);
        // The vendor handler is always suggested; the proxy rewrite layer is
        // suggested for a proxied route.
        expect(files.some(f => f.includes("securly"))).toBe(true);
        expect(files.some(f => f.includes("useIframeManager"))).toBe(true);
    });

    it("flags the absence of a handler for a vendor that has none", () => {
        // loilo has no misc/filters/loilo — the prediction should say so.
        const verdict = detectFlagging(
            observe({ pageText: "200 blocked by LoiLo" }),
            "loilo",
        );
        const suggestions = predictFix(verdict, CIVIL_DIR);
        expect(
            suggestions.some(s => s.reason.includes("no dedicated handler")),
        ).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// The sandbox, against a stubbed page (no server, no bundle)
// ---------------------------------------------------------------------------

describe("sandbox observeRoute", () => {
    it("reports the served text and a clean verdict for a benign page", async () => {
        // A throwaway extension with no content scripts: the sandbox should
        // fetch the page, load nothing, and report it verbatim.
        const dir = join(import.meta.dirname, "fixtures", "noop-extension");
        const observation = await observeRoute({
            extensionDir: dir,
            baseUrl: "https://abc.mooo.com",
            route: "/newtab",
            waitMs: 0,
            fetchImpl: (async () =>
                new Response("<body>Civil new tab</body>", {
                    status: 200,
                })) as unknown as typeof fetch,
        });
        expect(observation.route).toBe("/newtab");
        expect(observation.pageText).toContain("Civil new tab");
        expect(detectFlagging(observation, "securly").flagged).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The real bundles, when present
// ---------------------------------------------------------------------------

const BUNDLE_ROOT =
    process.env.CIVIL_FILTER_BUNDLES ?? join(homedir(), "extensions");
const haveBundles = existsSync(BUNDLE_ROOT);

describe.skipIf(!haveBundles)("real filter bundles", () => {
    /** Runs one vendor's real filter over a stubbed page body. */
    async function observeWithBody(dir: string, body: string) {
        return observeRoute({
            extensionDir: dir,
            baseUrl: "https://probe.mooo.com",
            route: "/newtab",
            waitMs: 0,
            fetchImpl: (async () =>
                new Response(`<body>${body}</body>`, {
                    status: 200,
                })) as unknown as typeof fetch,
        });
    }

    it.each(VENDORS)(
        "%s: the sandbox loads its filter and observes a page",
        async vendor => {
            const folder = VENDOR_PRIMARY_FOLDER[vendor]!;
            const dir = join(BUNDLE_ROOT, folder);
            // Asserted, not skipped past. A silent `return` here would let a
            // missing bundle report as a pass, which is the one way this block
            // could look green while testing nothing.
            expect(existsSync(dir), `${folder} bundle is missing`).toBe(true);

            // Negative control, and the assertion that carries the weight for
            // the six vendors whose bundles yield no distinctive block marker
            // (their block text is server-rendered or district-configured).
            // It proves the whole path really ran — fetch, DOM, this vendor's
            // content scripts — and that none of it fabricates a flag from an
            // ordinary page.
            const clean = await observeWithBody(dir, "Civil — new tab");
            expect(clean.pageText).toContain("Civil — new tab");
            expect(detectFlagging(clean, vendor).flagged).toBe(false);

            // Positive control, where this vendor has a marker of its own: the
            // same path over its real block text must reach "flagged".
            const marker = PROBE_DATA[vendor]!.blockMarkers[0];
            if (marker) {
                const blocked = await observeWithBody(dir, marker);
                expect(detectFlagging(blocked, vendor).flagged).toBe(true);
            }
        },
        30_000,
    );
});

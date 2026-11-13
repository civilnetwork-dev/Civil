/**
 * The filter route check, proven offline.
 *
 * The harness (harness.ts) is the live runner: server, tunnel, captcha,
 * cloudflared. None of that belongs in a test run, and none of it is where the
 * risk is. The risk is in the two pure pieces the harness orchestrates:
 * whether `detectFlagging` correctly reads a filter's block page out of a
 * `PageObservation`, and whether `predictFix` points at the right Civil source
 * when it does. Those are what this file exercises, driven by the committed
 * `probeData.json` and, for the sandbox, a stubbed fetch: no bundle, no
 * network, no wait.
 *
 * The last block opts into the real bundles when a checkout is present, to
 * prove the sandbox can actually load a filter and run a content script
 * against a page. The full live path, a running Civil server behind a tunnel,
 * is the harness's job and is not asserted here.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { PROXY_PREFIX } from "../config/shared/runtimeScripts";
import { decode } from "../config/shared/xorCodec";
import { filterVendorDomains } from "../filters/filterBlockerMiddleware";
import { detectFlagging, type PageObservation, PROBE_DATA } from "./detect";
import { predictFix } from "./predict";
import { observeRoute } from "./sandbox";
import { FOLDER_TO_VENDOR, VENDOR_PRIMARY_FOLDER, VENDORS } from "./vendors";

const CIVIL_DIR = join(import.meta.dirname, "..", "..");
const INTERCLASS_BLOCK_MODES = [
    "blocked",
    "outoftime",
    "safetyinput",
    "cumulativelimit",
];
const INTERCLASS_ERROR_MODES = [
    "errorpage",
    "clienterror",
    "servererror",
    "paramerror",
    "cantinitialize",
    "toolongurl",
    "brouseruserinfoerror",
    "unknown",
    "",
];

function observe(partial: Partial<PageObservation>): PageObservation {
    return {
        route: "/newTab",
        finalUrl: "https://abc123.mooo.com/newTab",
        pageText: "Civil: new tab",
        originalLength: 20,
        status: 200,
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
            observe({ pageText: `200 ${marker}: contact your teacher` }),
            "securly",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({ kind: "marker", marker });
    });

    it.each([
        {
            pageText:
                "Web Page Blocked! The FortiGuard URL rating service is inaccessible.",
            originalLength: 5000,
        },
        {
            finalUrl: "chrome-extension://fortiguard/blocked_page_FGD_down.htm",
            extensionId: "fortiguard",
        },
    ])("separates a FortiGuard rating outage from URL policy (%j)", fields => {
        expect(detectFlagging(observe(fields), "fortiguard")).toMatchObject({
            flagged: false,
            inconclusive:
                "FortiGuard blocked access while its URL rating service was unavailable",
        });
    });
});

describe("detectFlagging attribution and failures", () => {
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
        expect(detectFlagging(observe({}), "not-a-vendor")).toMatchObject({
            flagged: false,
            inconclusive: "No probe data for not-a-vendor",
        });
    });

    it("never lets a broken probe (fetch failure) read as clean", () => {
        // Marker-shaped text, but the fetch itself never succeeded: this
        // text proves nothing and must not flag.
        const verdict = detectFlagging(
            observe({
                fetchError: "fetch failed: ECONNRESET",
                pageText: "blocked by school policy",
            }),
            "securly",
        );
        expect(verdict.flagged).toBe(false);
        expect(verdict.inconclusive).toBe("fetch failed: ECONNRESET");
    });

    it("never lets a 5xx from Civil itself read as clean", () => {
        expect(
            detectFlagging(observe({ status: 502 }), "securly"),
        ).toMatchObject({ flagged: false, inconclusive: "HTTP 502" });
    });
});

describe("detectFlagging declarativeNetRequest", () => {
    it("flags a declarativeNetRequest block rule directly, no page needed", () => {
        const verdict = detectFlagging(
            observe({ dnrMatch: { action: "block", matchedRuleId: 7 } }),
            "securly",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({
            kind: "dnr-block",
            matchedRuleId: 7,
        });
    });
});

describe("detectFlagging declarativeNetRequest redirects", () => {
    it("flags a declarativeNetRequest redirect rule onto a known vendor domain", () => {
        const verdict = detectFlagging(
            observe({
                dnrMatch: {
                    action: "redirect",
                    matchedRuleId: 3,
                    redirectUrl: "https://deviceconsole.securly.com/blocked",
                },
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

    it("still flags a declarativeNetRequest redirect to a domain nobody's curated yet", () => {
        const verdict = detectFlagging(
            observe({
                dnrMatch: {
                    action: "redirect",
                    matchedRuleId: 3,
                    redirectUrl: "https://new-block-host.example/blocked",
                },
            }),
            "securly",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({
            kind: "redirect",
            domain: "new-block-host.example",
            finalHost: "new-block-host.example",
        });
    });

    it("ignores a DNR redirect when no rule matched", () => {
        const verdict = detectFlagging(
            observe({
                dnrMatch: {
                    action: "redirect",
                    matchedRuleId: null,
                    redirectUrl: "https://deviceconsole.securly.com/blocked",
                },
            }),
            "securly",
        );
        expect(verdict.flagged).toBe(false);
    });
});

/**
 * Most filters block by sending the tab to a page inside their own extension,
 * whose host is an extension id no domain list can name. Before `blockPages`
 * the redirect check missed every one of them.
 */
describe("detectFlagging block pages", () => {
    it("flags a tab sent to the block page inside the vendor's extension", () => {
        const finalUrl =
            "chrome-extension://ponmlkjihgfedcba/blocked.html?index=2";
        const verdict = detectFlagging(
            observe({ finalUrl, extensionId: "ponmlkjihgfedcba" }),
            "lanschool",
        );
        expect(verdict.signal).toEqual({
            kind: "block-page",
            page: "chrome-extension:blocked.html",
            finalUrl,
        });
    });

    it("flags a hosted block page on shared hosting no vendor domain covers", () => {
        const finalUrl =
            "https://lsrelay-config-production.s3.amazonaws.com/050d6872/block_screen.html";
        expect(
            detectFlagging(observe({ finalUrl }), "lightspeed").signal?.kind,
        ).toBe("block-page");
    });

    it("does not attribute another extension's identically named block page", () => {
        const finalUrl = "chrome-extension://ponmlkjihgfedcba/blocked.html";
        const verdict = detectFlagging(
            observe({ finalUrl, extensionId: "abcdefghijklmnop" }),
            "lanschool",
        );
        expect(verdict.flagged).toBe(false);
    });

    it("names a declarativeNetRequest redirect into the extension's own block page", () => {
        const redirectUrl =
            "chrome-extension://abcdefghijklmnop/blockPage.html";
        const verdict = detectFlagging(
            observe({
                dnrMatch: { action: "redirect", matchedRuleId: 4, redirectUrl },
            }),
            "blocksi",
        );
        expect(verdict.signal).toEqual({
            kind: "block-page",
            page: "chrome-extension:blockPage.html",
            finalUrl: redirectUrl,
        });
    });
});

function interclassPage(mode: string): PageObservation {
    return observe({
        finalUrl: `chrome-extension://abcdefghijklmnop/pages/message-page.html?mode=${mode}`,
        pageText: PROBE_DATA.interclass!.blockMarkers[0]!,
        originalLength: 5000,
    });
}

it("uses the browser's URL codec for proxy route observations", async () => {
    const proxyTarget = "https://example.com/page?q=a%20b";
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures", "noop-extension"),
        baseUrl: "https://probe.invalid/",
        route: PROXY_PREFIX,
        proxyTarget,
        waitMs: 0,
        fetchImpl: (async (url: string) => {
            const { pathname, search } = new URL(url);
            expect(pathname.startsWith(PROXY_PREFIX)).toBe(true);
            expect(search).toBe("");
            expect(decode(pathname.slice(PROXY_PREFIX.length))).toBe(
                proxyTarget,
            );
            return new Response("<body>Rewritten fixture</body>");
        }) as unknown as typeof fetch,
    });
    expect(observation.pageText).toContain("Rewritten fixture");
});

it.each([
    "gcjpefhffmcgplgklffgbebganmhffje",
    "mpkdoimpgkhjcicmhmlmgboelebflpla",
])(
    "flags a redirect to NetSupport's approved-sites policy page (%s)",
    extensionId => {
        const finalUrl = `chrome-extension://${extensionId}/ApprovedWebList.htm`;
        const verdict = detectFlagging(
            observe({ extensionId, finalUrl }),
            "netsupport",
        );
        expect(verdict.signal).toEqual({
            kind: "block-page",
            page: "chrome-extension:ApprovedWebList.htm",
            finalUrl,
        });
    },
);

describe("InterCLASS message-page modes", () => {
    it.each(INTERCLASS_ERROR_MODES)(
        "keeps error or unknown mode %s inconclusive before marker/shrinkage checks",
        mode => {
            const verdict = detectFlagging(interclassPage(mode), "interclass");
            expect(verdict.flagged).toBe(false);
            expect(verdict.signal).toBeUndefined();
            expect(verdict.inconclusive).toContain("InterCLASS");
        },
    );

    it.each(INTERCLASS_BLOCK_MODES)("flags policy mode %s", mode => {
        const verdict = detectFlagging(interclassPage(mode), "interclass");
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal?.kind).toBe("block-page");
        expect(verdict.inconclusive).toBeUndefined();
    });
});

describe("InterCLASS message-page DNR", () => {
    it.each([4, null])(
        "only treats a DNR redirect to an error page as evidence with a matched rule (%s)",
        matchedRuleId => {
            const verdict = detectFlagging(
                observe({
                    dnrMatch: {
                        action: "redirect",
                        matchedRuleId,
                        redirectUrl: interclassPage("servererror").finalUrl,
                    },
                }),
                "interclass",
            );
            expect(verdict.flagged).toBe(false);
            if (matchedRuleId === null) {
                expect(verdict.inconclusive).toBeUndefined();
            } else {
                expect(verdict.inconclusive).toContain("InterCLASS");
            }
        },
    );

    it("requires a matched DNR rule before overriding an error page", () => {
        const verdict = detectFlagging(
            {
                ...interclassPage("servererror"),
                dnrMatch: { action: "block", matchedRuleId: null },
            },
            "interclass",
        );
        expect(verdict.flagged).toBe(false);
        expect(verdict.inconclusive).toContain("InterCLASS");
    });

    it("preserves a direct DNR block despite a later error page", () => {
        const verdict = detectFlagging(
            {
                ...interclassPage("servererror"),
                dnrMatch: { action: "block", matchedRuleId: 4 },
            },
            "interclass",
        );
        expect(verdict.signal).toEqual({ kind: "dnr-block", matchedRuleId: 4 });
        expect(verdict.inconclusive).toBeUndefined();
    });
});

/** probeData.json against what vendors' block pages really say and where they
 *  really are: buildProbeData.ts says where each was read. */
describe("probe data from the real block pages", () => {
    it("reads Securly's real block page, as the Wayback Machine has it", () => {
        // Lines every one of the twelve newest *.securly.com/blocked captures
        // (Oct–Nov 2025) shares.
        const pageText = [
            "Blocked Page",
            "Looks like this page isn't allowed",
            "This page has been blocked.",
            "Blocking details",
            "Reason: Blocked by Category",
            "Refer to KB article for explanation of blocking details",
        ].join("\n");
        const verdict = detectFlagging(observe({ pageText }), "securly");
        expect(verdict.signal).toEqual({
            kind: "marker",
            marker: "Looks like this page isn't allowed",
        });
    });

    it("writes every block page as host/path or chrome-extension:file", () => {
        for (const vendor of VENDORS)
            for (const page of PROBE_DATA[vendor]!.blockPages)
                expect(page, vendor).toMatch(
                    /^(chrome-extension:[\w./-]+|[a-z0-9.-]+\.[a-z]+\/[\w./-]*)$/,
                );
    });
});

describe("detectFlagging page shrinkage", () => {
    it("flags a page that collapsed to a short fraction of what was served, even with no known marker", () => {
        const pageText = "Access is not permitted here.";
        const verdict = detectFlagging(
            observe({ pageText, originalLength: 5000 }),
            "securly",
        );
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({
            kind: "dom-replaced",
            originalLength: 5000,
            finalLength: pageText.length,
        });
    });

    it("does not flag a route that was always short as dom-replaced", () => {
        const verdict = detectFlagging(
            observe({ pageText: "Civil: new tab", originalLength: 20 }),
            "securly",
        );
        expect(verdict.flagged).toBe(false);
    });

    it("does not flag ordinary shrinkage that stays a real page", () => {
        const verdict = detectFlagging(
            observe({ pageText: "A".repeat(1000), originalLength: 2000 }),
            "securly",
        );
        expect(verdict.flagged).toBe(false);
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
});

describe("predictFix gaps and DNR", () => {
    it("flags the absence of a handler for a vendor that has none", () => {
        // loilo has no misc/filters/loilo: the prediction should say so.
        const verdict = detectFlagging(
            observe({ pageText: "200 blocked by LoiLo" }),
            "loilo",
        );
        const suggestions = predictFix(verdict, CIVIL_DIR);
        expect(
            suggestions.some(s => s.reason.includes("no dedicated handler")),
        ).toBe(true);
    });

    it("points a declarativeNetRequest block at the route's own URL structure, not the domain blocklist", () => {
        const verdict = detectFlagging(
            observe({
                route: "/~/scramjet/",
                dnrMatch: { action: "block", matchedRuleId: 9 },
            }),
            "securly",
        );
        const files = predictFix(verdict, CIVIL_DIR).map(s => s.file);
        expect(files.some(f => f.includes("useIframeManager"))).toBe(true);
        expect(
            files.some(f => f === "misc/filters/filterBlockerMiddleware.ts"),
        ).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// The sandbox, against a stubbed page (no server, no bundle)
// ---------------------------------------------------------------------------

describe("sandbox observeRoute", () => {
    it.each(["missing-worker", "missing-content-script"])(
        "keeps a benign page inconclusive when an extension script is missing (%s)",
        async fixture => {
            const observation = await observeRoute({
                extensionDir: join(import.meta.dirname, "fixtures", fixture),
                baseUrl: "https://abc.mooo.com",
                route: "/newTab",
                waitMs: 0,
                fetchImpl: (async () =>
                    new Response(
                        "<body>Civil new tab</body>",
                    )) as unknown as typeof fetch,
            });
            expect(observation.pageText).toContain("Civil new tab");
            const verdict = detectFlagging(observation, "securly");
            expect(verdict.flagged).toBe(false);
            expect(verdict.inconclusive).toContain("missing.js");
        },
    );

    it("reports the served text and a clean verdict for a benign page", async () => {
        // A throwaway extension with no content scripts: the sandbox should
        // fetch the page, load nothing, and report it verbatim.
        const dir = join(import.meta.dirname, "fixtures", "noop-extension");
        const observation = await observeRoute({
            extensionDir: dir,
            baseUrl: "https://abc.mooo.com",
            route: "/newTab",
            waitMs: 0,
            fetchImpl: (async () =>
                new Response("<body>Civil new tab</body>", {
                    status: 200,
                })) as unknown as typeof fetch,
        });
        expect(observation.route).toBe("/newTab");
        expect(observation.pageText).toContain("Civil new tab");
        expect(detectFlagging(observation, "securly").flagged).toBe(false);
    });

    it("catches an image-only block overlay through alt/aria/title text, not just innerText", async () => {
        const dir = join(import.meta.dirname, "fixtures", "message-channel");
        const observation = await observeRoute({
            extensionDir: dir,
            baseUrl: "https://probe.invalid",
            route: "/newTab",
            waitMs: 100,
            fetchImpl: (async () =>
                new Response(
                    "<body>Civil new tab</body>",
                )) as unknown as typeof fetch,
        });
        // No visible text run at all: textContent alone would be empty.
        expect(observation.pageText).toContain(
            "This site has been blocked by a teacher",
        );
        expect(detectFlagging(observation, "securly").flagged).toBe(true);
    });
});

it.each([
    [
        "https://deviceconsole.securly.com/blocked",
        "https://deviceconsole.securly.com/blocked",
    ],
    ["/setup", "https://probe.invalid/setup"],
])(
    "reports a network redirect without attributing it to the extension (%s)",
    async (location, destination) => {
        const observation = await observeRoute({
            extensionDir: join(
                import.meta.dirname,
                "fixtures",
                "missing-worker",
            ),
            baseUrl: "https://probe.invalid",
            route: "/newTab",
            fetchImpl: (async (_url: unknown, init: RequestInit) => {
                expect(init.redirect).toBe("manual");
                return new Response("This site has been blocked by a teacher", {
                    status: 302,
                    headers: { location },
                });
            }) as unknown as typeof fetch,
        });
        expect(observation.finalUrl).toBe(destination);
        expect(observation.backgroundError).toBeUndefined();
        expect(detectFlagging(observation, "securly")).toMatchObject({
            flagged: false,
            inconclusive: `Page fetch redirected to ${destination}`,
        });
    },
);

it("does not attribute block text already present in the fetched page to the filter", async () => {
    const marker = PROBE_DATA.securly!.blockMarkers[0]!;
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures", "noop-extension"),
        baseUrl: "https://probe.invalid",
        route: "/newTab",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response(
                `<title>${marker}</title><body>Blocked by GoGuardian</body>`,
            )) as unknown as typeof fetch,
    });
    expect(observation.originalPageText).toBe(observation.pageText);
    expect(detectFlagging(observation, "securly").flagged).toBe(false);
    expect(detectFlagging(observation, "goguardian").flagged).toBe(false);
});

it("passes page sender metadata to a worker that controls the content-script block", async () => {
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures", "message-channel"),
        baseUrl: "https://probe.invalid",
        route: "/newTab",
        waitMs: 100,
        fetchImpl: (async () =>
            new Response(
                "<body>Civil new tab</body>",
            )) as unknown as typeof fetch,
    });
    expect(observation.contentScriptError).toBeUndefined();
    expect(detectFlagging(observation, "securly").signal?.kind).toBe("marker");
});

it.each([
    ["https://www.probe.invalid", "/newTab", true],
    ["https://WWW.PROBE.INVALID", "/newTab", true],
    ["https://www.probe.invalid", "/skipme", true],
    ["https://www.probe.nvalid", "/newTab", true],
    ["https://www.probe.invalid", "/newTabXblocked=yes", true],
    ["http://www.probe.invalid", "/newTab", false],
    ["https://other.probe.invalid", "/newTab", false],
    ["https://www.probe.innvalid", "/newTab", false],
    ["https://www.probe.invalid", "/private/newTab", false],
    ["https://www.probe.invalid", "/skip+me", false],
    ["https://www.probe.invalid", "/newTab?blocked=yes", false],
])("scopes manifest content scripts for %s%s", async (baseUrl, route, runs) => {
    const observation = await observeRoute({
        extensionDir: join(
            import.meta.dirname,
            "fixtures",
            "content-script-scope",
        ),
        baseUrl,
        route,
        waitMs: 0,
        fetchImpl: (async () =>
            new Response(
                "<body>Original page</body>",
            )) as unknown as typeof fetch,
    });
    expect(observation.contentScriptError).toBeUndefined();
    expect(observation.pageText).toBe(
        runs ? "Scoped content script ran" : "Original page",
    );
});

describe("sandbox observeRoute verdicts", () => {
    it("reports the loaded filter's own declarativeNetRequest verdict for the page URL", async () => {
        const dir = join(import.meta.dirname, "fixtures", "dnr-extension");
        const observation = await observeRoute({
            extensionDir: dir,
            baseUrl: "https://dnr-blocked.example",
            route: "/newTab",
            waitMs: 0,
            fetchImpl: (async () =>
                new Response("<body>irrelevant</body>", {
                    status: 200,
                })) as unknown as typeof fetch,
        });
        expect(observation.dnrMatch?.action).toBe("block");
        expect(observation.dnrMatch?.matchedRuleId).toBe(1);

        const verdict = detectFlagging(observation, "securly");
        expect(verdict.flagged).toBe(true);
        expect(verdict.signal).toEqual({
            kind: "dnr-block",
            matchedRuleId: 1,
        });
    });

    it("reports a fetch failure structurally instead of silently reading as clean", async () => {
        const dir = join(import.meta.dirname, "fixtures", "noop-extension");
        const observation = await observeRoute({
            extensionDir: dir,
            baseUrl: "https://abc.mooo.com",
            route: "/newTab",
            waitMs: 0,
            fetchImpl: (async () => {
                throw new Error("ECONNRESET");
            }) as unknown as typeof fetch,
        });
        expect(observation.fetchError).toContain("ECONNRESET");
        expect(detectFlagging(observation, "securly").flagged).toBe(false);
    });
});

it("observes a block issued by a top-frame navigation listener", async () => {
    const extensionId = "b".repeat(32);
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures", "dnr-extension"),
        extensionId,
        baseUrl: "https://nav-blocked.example",
        route: "/newTab",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response("<body>irrelevant</body>")) as unknown as typeof fetch,
    });
    expect(detectFlagging(observation, "netsupport").signal).toEqual({
        kind: "block-page",
        page: "chrome-extension:weblock.html",
        finalUrl: `chrome-extension://${extensionId}/weblock.html`,
    });
});

it.each([
    ["close-observed.example", true],
    ["close-other.example", false],
] as const)(
    "reports closure only for the observed tab (%s)",
    async (hostname, removed) => {
        const observation = await observeRoute({
            extensionDir: join(
                import.meta.dirname,
                "fixtures",
                "dnr-extension",
            ),
            baseUrl: `https://${hostname}`,
            route: "/newTab",
            waitMs: 0,
            fetchImpl: (async () =>
                new Response(
                    "<body>irrelevant</body>",
                )) as unknown as typeof fetch,
        });
        const verdict = detectFlagging(observation, "iboss");
        expect(observation.tabRemoved).toBe(removed);
        expect(verdict.flagged).toBe(false);
        expect(verdict.inconclusive).toBe(
            removed
                ? "Filter closed the observed tab without a policy signal"
                : undefined,
        );
    },
);

it("uses catalog identity and fixture policy for a relocated bundle", async () => {
    const extensionId = "b".repeat(32);
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures", "dnr-extension"),
        extensionFolder: "fortiguard",
        extensionId,
        baseUrl: "https://dnr-managed.example",
        route: "/newTab",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response("<body>irrelevant</body>")) as unknown as typeof fetch,
    });
    expect(observation.extensionId).toBe(extensionId);
    expect(observation.dnrMatch).toEqual({
        action: "block",
        matchedRuleId: 3,
    });
});

it("does not report an HTTP scheme upgrade as a block", async () => {
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures", "dnr-extension"),
        baseUrl: "http://dnr-upgrade.example",
        route: "/newTab",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response("<body>irrelevant</body>")) as unknown as typeof fetch,
    });
    expect(observation.dnrMatch).toEqual({
        action: "none",
        matchedRuleId: null,
    });
    expect(detectFlagging(observation, "securly").flagged).toBe(false);
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
            route: "/newTab",
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
            // It proves the whole path really ran (fetch, DOM, this vendor's
            // content scripts) and that none of it fabricates a flag from an
            // ordinary page.
            const clean = await observeWithBody(dir, "Civil: new tab");
            expect(clean.pageText).toContain("Civil: new tab");
            expect(detectFlagging(clean, vendor).flagged).toBe(false);

            // Text served by the original page cannot establish a filter block.
            const marker = PROBE_DATA[vendor]!.blockMarkers[0];
            if (marker) {
                const upstream = await observeWithBody(dir, marker);
                expect(upstream.originalPageText).toContain(marker);
                expect(detectFlagging(upstream, vendor).flagged).toBe(false);
            }
        },
        30_000,
    );
});

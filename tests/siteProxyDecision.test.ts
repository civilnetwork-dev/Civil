import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These two functions decide which proxy engine and transport every site gets.
 * They're pure branching over scores and headers, they have no UI, and when they
 * are wrong the symptom is "this site is broken on Civil" — attributed to the
 * proxy engine rather than to the picker. That combination is exactly what unit
 * tests are for.
 */

// --- db stub -------------------------------------------------------------
// Only the shapes siteProxy.ts actually calls are modelled.
const updateSet = vi.fn();
let existingRow: Record<string, unknown> | null = null;

vi.mock("../misc/database/db", () => ({
    db: {
        select: () => ({
            from: () => ({
                where: () => ({
                    limit: async () => (existingRow ? [existingRow] : []),
                }),
            }),
        }),
        update: () => ({
            set: (values: unknown) => {
                updateSet(values);
                return { where: async () => undefined };
            },
        }),
        insert: () => ({
            values: () => ({
                onConflictDoUpdate: () => ({
                    returning: async () => [existingRow ?? {}],
                }),
            }),
        }),
    },
}));

vi.mock("user-agents", () => ({
    default: class {
        toString() {
            return "test-agent";
        }
    },
}));

const { probeSite, recordCompatFeedback } = await import(
    "../misc/database/models/siteProxy"
);

function row(over: Record<string, unknown> = {}) {
    return {
        hostname: "example.com",
        proxy: "scramjet",
        transport: "epoxy",
        wispVersion: 2,
        score: 50,
        scoreScramjet: null,
        scoreUv: null,
        latencyMs: 100,
        reason: "",
        ...over,
    };
}

/** Minimal Response stand-in: probeSite only reads headers. */
function fakeResponse(headers: Record<string, string>) {
    return { headers: new Headers(headers) } as Response;
}

beforeEach(() => {
    vi.clearAllMocks();
    existingRow = null;
    vi.unstubAllGlobals();
});

describe("recordCompatFeedback", () => {
    it("returns null for a hostname with no stored config", async () => {
        existingRow = null;
        await expect(
            recordCompatFeedback("example.com", "scramjet", "epoxy", 90),
        ).resolves.toBeNull();
        expect(updateSet).not.toHaveBeenCalled();
    });

    describe("once both engines have been measured, it picks the better one", () => {
        it("prefers scramjet when its score is higher", async () => {
            existingRow = row({ scoreUv: 40, proxy: "uv" });
            const picked = await recordCompatFeedback(
                "example.com",
                "scramjet",
                "epoxy",
                90,
            );
            expect(picked).toBe("scramjet");
            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    proxy: "scramjet",
                    reason: "sj=90,uv=40",
                }),
            );
        });

        it("prefers uv when its score is higher", async () => {
            existingRow = row({ scoreScramjet: 30, proxy: "scramjet" });
            const picked = await recordCompatFeedback(
                "example.com",
                "uv",
                "epoxy",
                85,
            );
            expect(picked).toBe("uv");
            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({ proxy: "uv", reason: "sj=30,uv=85" }),
            );
        });

        it("breaks a tie in favour of scramjet", async () => {
            // `>=` in the comparison — scramjet is the intended default engine.
            existingRow = row({ scoreUv: 70, proxy: "uv" });
            await expect(
                recordCompatFeedback("example.com", "scramjet", "epoxy", 70),
            ).resolves.toBe("scramjet");
        });
    });

    describe("with only one engine measured, it explores", () => {
        it("switches to the other engine when this one scored poorly", async () => {
            existingRow = row({ scoreScramjet: null, scoreUv: null });
            const picked = await recordCompatFeedback(
                "example.com",
                "scramjet",
                "epoxy",
                50, // < 70 → weak
            );
            expect(picked).toBe("uv");
            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({
                    reason: "explore-uv(from scramjet@50,err=0)",
                }),
            );
        });

        it("treats any rewriter error as weak even at a high score", async () => {
            existingRow = row();
            await expect(
                recordCompatFeedback(
                    "example.com",
                    "scramjet",
                    "epoxy",
                    100,
                    3,
                ),
            ).resolves.toBe("uv");
        });

        it("stays put when the score is good", async () => {
            existingRow = row();
            const picked = await recordCompatFeedback(
                "example.com",
                "scramjet",
                "epoxy",
                95,
            );
            expect(picked).toBe("scramjet");
            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({ reason: "scramjet@95,err=0" }),
            );
        });

        it("does not explore back to an engine already measured", async () => {
            // uv already has a score, so a weak scramjet result must not bounce
            // to uv on the explore path — the comparison branch handles it.
            existingRow = row({ scoreUv: 20 });
            const picked = await recordCompatFeedback(
                "example.com",
                "scramjet",
                "epoxy",
                50,
            );
            expect(picked).toBe("scramjet");
            expect(updateSet).toHaveBeenCalledWith(
                expect.objectContaining({ reason: "sj=50,uv=20" }),
            );
        });

        it("uses 70 as the weakness threshold, inclusive of 70 as 'good'", async () => {
            existingRow = row();
            await expect(
                recordCompatFeedback("example.com", "scramjet", "epoxy", 70),
            ).resolves.toBe("scramjet");

            vi.clearAllMocks();
            existingRow = row();
            await expect(
                recordCompatFeedback("example.com", "scramjet", "epoxy", 69),
            ).resolves.toBe("uv");
        });
    });

    it("records the reported score against the right engine column", async () => {
        existingRow = row();
        await recordCompatFeedback("example.com", "uv", "epoxy", 77);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ scoreUv: 77, scoreScramjet: null }),
        );
    });

    it("keeps the stored transport when none is reported", async () => {
        existingRow = row({ transport: "libcurl" });
        await recordCompatFeedback("example.com", "scramjet", undefined, 90);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ transport: "libcurl" }),
        );
    });

    it("truncates the reason to the column width", async () => {
        existingRow = row({ reason: "x".repeat(500), scoreUv: 10 });
        await recordCompatFeedback("example.com", "scramjet", "epoxy", 90);
        const values = updateSet.mock.calls[0][0] as { reason: string };
        expect(values.reason.length).toBeLessThanOrEqual(240);
    });
});

describe("probeSite", () => {
    function stubFetch(res: Response | null) {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => {
                if (!res) throw new Error("network down");
                return res;
            }),
        );
    }

    it("chooses uv for a plain, unprotected response", async () => {
        stubFetch(fakeResponse({}));
        const d = await probeSite("https://example.com/");
        expect(d.proxy).toBe("uv");
        expect(d.reason).toContain("simple>bare");
    });

    it("chooses scramjet when the site blocks framing", async () => {
        // x-frame-options + strict CSP = 2 + 3 points, over the threshold of 3.
        stubFetch(
            fakeResponse({
                "x-frame-options": "DENY",
                "content-security-policy": "frame-ancestors 'none'",
                "content-type": "text/html",
            }),
        );
        const d = await probeSite("https://example.com/");
        expect(d.proxy).toBe("scramjet");
        expect(d.reason).toContain("x-frame-options");
        expect(d.reason).toContain("strict-csp");
    });

    it("counts COOP and COEP toward scramjet", async () => {
        stubFetch(
            fakeResponse({
                "cross-origin-opener-policy": "same-origin",
                "cross-origin-embedder-policy": "require-corp",
            }),
        );
        const d = await probeSite("https://example.com/");
        expect(d.proxy).toBe("scramjet");
        expect(d.reason).toContain("coop");
        expect(d.reason).toContain("coep");
    });

    it("ignores unsafe-none COOP/COEP, which are the permissive defaults", async () => {
        stubFetch(
            fakeResponse({
                "cross-origin-opener-policy": "unsafe-none",
                "cross-origin-embedder-policy": "unsafe-none",
            }),
        );
        const d = await probeSite("https://example.com/");
        expect(d.reason).not.toContain("coop");
        expect(d.reason).not.toContain("coep");
        expect(d.proxy).toBe("uv");
    });

    it("picks epoxy for a Cloudflare-fronted site", async () => {
        stubFetch(fakeResponse({ "cf-ray": "abc123", server: "cloudflare" }));
        const d = await probeSite("https://example.com/");
        expect(d.transport).toBe("epoxy");
        expect(d.reason).toContain("cf>epoxy");
    });

    it("survives a failed probe and still returns a usable decision", async () => {
        stubFetch(null);
        const d = await probeSite("https://example.com/");
        // No headers to score, so it must fall back rather than throw.
        expect(d.proxy).toBe("uv");
        expect(d.transport).toBe("bare");
        expect(d.latencyMs).toBeTypeOf("number");
    });

    it("always produces a reason", async () => {
        stubFetch(fakeResponse({}));
        const d = await probeSite("https://example.com/");
        expect(d.reason.length).toBeGreaterThan(0);
    });

    /**
     * KNOWN GAP, pinned so a fix is a deliberate act.
     *
     * probeSite ends with:
     *
     *     if (reasons.length === 0)
     *         reasons.push(res ? "plain-response" : "no-probe");
     *
     * That branch is unreachable. Points only come from header checks (each of
     * which pushes a reason) plus `content-type: text/html` (+1, no reason), so
     * the most points achievable with an empty `reasons` array is 1 — which
     * satisfies `scramjetPoints <= 1` and pushes "simple>bare". So `reasons` is
     * never empty, and neither "plain-response" nor "no-probe" can ever be set.
     *
     * Consequence: a site whose probe timed out is recorded with exactly the
     * same reason as a genuinely simple site. Since `reason` is the only stored
     * record of why an engine was chosen, that makes a failed probe invisible
     * when debugging a bad decision.
     */
    it("cannot currently distinguish a failed probe from a simple site", async () => {
        stubFetch(null);
        const failed = await probeSite("https://example.com/");

        stubFetch(fakeResponse({}));
        const simple = await probeSite("https://example.com/");

        expect(failed.reason).toBe("simple>bare");
        expect(simple.reason).toBe("simple>bare");
        expect(failed.reason).toBe(simple.reason);
        // The two intended markers are dead code today:
        expect(failed.reason).not.toContain("no-probe");
        expect(simple.reason).not.toContain("plain-response");
    });

    it("clamps the score to 0..100", async () => {
        const cases: Record<string, string>[] = [
            {},
            { "x-frame-options": "DENY" },
            {
                "x-frame-options": "DENY",
                "content-security-policy": "sandbox; frame-ancestors 'none'",
                "cross-origin-opener-policy": "same-origin",
                "cross-origin-embedder-policy": "require-corp",
                "content-type": "text/html",
            },
        ];
        for (const headers of cases) {
            stubFetch(fakeResponse(headers));
            const d = await probeSite("https://example.com/");
            expect(d.score).toBeGreaterThanOrEqual(0);
            expect(d.score).toBeLessThanOrEqual(100);
        }
    });

    it("returns a valid wispVersion", async () => {
        stubFetch(fakeResponse({}));
        const d = await probeSite("https://example.com/");
        expect([1, 2]).toContain(d.wispVersion);
    });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These two functions decide the transport (and, historically, the proxy
 * engine) every site gets. Scramjet is now the only proxy engine Civil
 * ships, so `proxy` is always "scramjet" here -- these tests cover what
 * still varies: the transport pick and the score/reason a decision is
 * recorded with. They're pure branching over scores and headers, they have
 * no UI, and when they are wrong the symptom is "this site is broken on
 * Civil" — attributed to the proxy engine rather than to the picker. That
 * combination is exactly what unit tests are for.
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

const { probeSite, recordCompatFeedback } =
    await import("../misc/database/models/siteProxy");

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
            recordCompatFeedback("example.com", "epoxy", 90),
        ).resolves.toBeNull();
        expect(updateSet).not.toHaveBeenCalled();
    });

    it("always records scramjet, even for a row stored before uv was removed", async () => {
        // A pre-removal row can still say proxy: "uv" -- there's no DB-level
        // enum on the column -- but every new feedback call must self-heal
        // it forward rather than perpetuate it.
        existingRow = row({ proxy: "uv", scoreUv: 80 });
        const picked = await recordCompatFeedback("example.com", "epoxy", 90);
        expect(picked).toBe("scramjet");
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ proxy: "scramjet" }),
        );
    });

    it("records the score into both score and scoreScramjet", async () => {
        existingRow = row();
        await recordCompatFeedback("example.com", "epoxy", 77);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ score: 77, scoreScramjet: 77 }),
        );
    });

    it("leaves scoreUv untouched -- it's frozen history, not migrated away", async () => {
        existingRow = row({ scoreUv: 42 });
        await recordCompatFeedback("example.com", "epoxy", 90);
        const values = updateSet.mock.calls[0]![0] as Record<string, unknown>;
        expect(values).not.toHaveProperty("scoreUv");
    });

    it("keeps the stored transport when none is reported", async () => {
        existingRow = row({ transport: "libcurl" });
        await recordCompatFeedback("example.com", undefined, 90);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ transport: "libcurl" }),
        );
    });

    it("uses the reported transport over the stored one", async () => {
        existingRow = row({ transport: "libcurl" });
        await recordCompatFeedback("example.com", "bare", 90);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ transport: "bare" }),
        );
    });

    it("formats the reason as scramjet@<compat>,err=<rewriterErrors>", async () => {
        existingRow = row();
        await recordCompatFeedback("example.com", "epoxy", 95, 2);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "scramjet@95,err=2" }),
        );
    });

    it("defaults rewriterErrors to 0 when omitted", async () => {
        existingRow = row();
        await recordCompatFeedback("example.com", "epoxy", 95);
        expect(updateSet).toHaveBeenCalledWith(
            expect.objectContaining({ reason: "scramjet@95,err=0" }),
        );
    });

    it("truncates the reason to the column width", async () => {
        existingRow = row({ reason: "x".repeat(500) });
        // The reason this function writes is always short
        // (scramjet@N,err=N), so the truncation only matters if the
        // computed string itself grows past 240 -- pin the guard with a
        // pathologically large compat value to prove it still clamps rather
        // than just happening to fit today.
        await recordCompatFeedback("example.com", "epoxy", 9e300);
        const values = updateSet.mock.calls[0]![0] as { reason: string };
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

    it("always resolves to scramjet -- the only proxy engine Civil ships", async () => {
        stubFetch(fakeResponse({ "x-frame-options": "DENY" }));
        const strict = await probeSite("https://example.com/");
        expect(strict.proxy).toBe("scramjet");

        stubFetch(fakeResponse({}));
        const plain = await probeSite("https://example.com/");
        expect(plain.proxy).toBe("scramjet");
    });

    it("still tags a plain, unprotected response as simple>bare", async () => {
        stubFetch(fakeResponse({}));
        const d = await probeSite("https://example.com/");
        expect(d.transport).toBe("bare");
        expect(d.reason).toContain("simple>bare");
    });

    it("still tags strict framing/CSP defenses in the reason", async () => {
        stubFetch(
            fakeResponse({
                "x-frame-options": "DENY",
                "content-security-policy": "frame-ancestors 'none'",
                "content-type": "text/html",
            }),
        );
        const d = await probeSite("https://example.com/");
        expect(d.reason).toContain("x-frame-options");
        expect(d.reason).toContain("strict-csp");
    });

    it("counts COOP and COEP toward the reason", async () => {
        stubFetch(
            fakeResponse({
                "cross-origin-opener-policy": "same-origin",
                "cross-origin-embedder-policy": "require-corp",
            }),
        );
        const d = await probeSite("https://example.com/");
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
        expect(d.proxy).toBe("scramjet");
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
     * when debugging a bad decision. Unrelated to the proxy-engine removal —
     * this gap predates it and still exists in the transport-only picker.
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

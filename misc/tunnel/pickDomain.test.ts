import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { create as createCache } from "flat-cache";
import { describe, expect, it, vi } from "vitest";
import type { Classification } from "../filters/domainReputation";
import type { Registry, RegistryDomain } from "./freedns";
import { pickTunnelDomain } from "./pickDomain";

const CACHE_ID = "freedns-blocked.json";

function dom(domain: string, id: number, status = "public"): RegistryDomain {
    return {
        domain,
        id,
        hosts: 0,
        status,
        ownerName: "",
        ownerId: 0,
        age: 0,
        created: "",
    };
}

/** A client whose registry is `domains`, served `perPage` at a time. */
function fakeClient(domains: RegistryDomain[], perPage = 2) {
    const pages: RegistryDomain[][] = [];
    for (let i = 0; i < domains.length; i += perPage) {
        pages.push(domains.slice(i, i + perPage));
    }
    const totalPages = Math.max(1, pages.length);
    const getRegistry = vi.fn(
        async (page = 1): Promise<Registry> => ({
            domainsInfo: { pageStart: 0, pageEnd: 0, total: domains.length },
            pagesInfo: { currentPage: page, totalPages },
            domains: pages[page - 1] ?? [],
        }),
    );
    return { getRegistry };
}

const allow = async (domain: string): Promise<Classification> => ({
    domain,
    blocked: false,
    by: [],
});

function tmp(): string {
    return mkdtempSync(join(tmpdir(), "civil-pick-"));
}

describe("pickTunnelDomain", () => {
    it("never returns a blocked domain and caches the block", async () => {
        const cacheDir = tmp();
        const client = fakeClient([
            dom("blocked.com", 1),
            dom("clean.com", 2),
            dom("also-clean.com", 3),
        ]);
        const classify = vi.fn(
            async (d: string): Promise<Classification> =>
                d === "blocked.com"
                    ? { domain: d, blocked: true, by: ["blocksi"] }
                    : { domain: d, blocked: false, by: [] },
        );

        const picked = await pickTunnelDomain({
            client,
            classify,
            cacheDir,
            random: () => 0,
        });

        expect(picked.name).not.toBe("blocked.com");
        expect(["clean.com", "also-clean.com"]).toContain(picked.name);

        // The block was persisted…
        const persisted = createCache({ cacheId: CACHE_ID, cacheDir });
        expect(persisted.keys()).toEqual(["blocked.com"]);
        expect(persisted.getKey("blocked.com")).toEqual(["blocksi"]);
    });

    it("skips already-blocked domains and does not rewrite the cache", async () => {
        const cacheDir = tmp();
        // Pre-seed the block cache.
        const seed = createCache({ cacheId: CACHE_ID, cacheDir });
        seed.setKey("blocked.com", ["fortiguard"]);
        seed.save();

        const client = fakeClient([dom("blocked.com", 1), dom("clean.com", 2)]);
        const classify = vi.fn(allow);

        const picked = await pickTunnelDomain({ client, classify, cacheDir });

        expect(picked.name).toBe("clean.com");
        // Known-blocked domain never re-hits the checkers.
        expect(classify).not.toHaveBeenCalledWith("blocked.com");
        // No new block → no allow-domains leaked into the file.
        const after = createCache({ cacheId: CACHE_ID, cacheDir });
        expect(after.keys()).toEqual(["blocked.com"]);
    });

    it("randomises the pick among survivors", async () => {
        const domains = [dom("a.com", 1), dom("b.com", 2), dom("c.com", 3)];
        const low = await pickTunnelDomain({
            client: fakeClient(domains),
            classify: allow,
            cacheDir: tmp(),
            random: () => 0,
        });
        const high = await pickTunnelDomain({
            client: fakeClient(domains),
            classify: allow,
            cacheDir: tmp(),
            random: () => 0.999,
        });
        expect(["a.com", "b.com", "c.com"]).toContain(low.name);
        expect(low.name).not.toBe(high.name);
    });

    it("throws when every candidate is blocked", async () => {
        const client = fakeClient([dom("blocked.com", 1)]);
        const classify = async (d: string): Promise<Classification> => ({
            domain: d,
            blocked: true,
            by: ["cisco"],
        });
        await expect(
            pickTunnelDomain({ client, classify, cacheDir: tmp() }),
        ).rejects.toThrow(/blocked/);
    });

    it("tries the next batch when the first is entirely blocked", async () => {
        // A block cache accumulated over many runs can make an early batch
        // come back fully blocked even though clean domains exist further
        // into the registry — this is what stopping at maxCandidates used to
        // get wrong (see pickTunnelDomain's own doc comment). Blocked-ness is
        // keyed on call order rather than domain name so the assertion holds
        // regardless of how `shuffle` reorders the registry; `concurrency: 1`
        // makes that order deterministic.
        const domains = Array.from({ length: 5 }, (_, i) =>
            dom(`d${i}.com`, i + 1),
        );
        let calls = 0;
        const classify = async (d: string): Promise<Classification> => {
            calls++;
            return calls < 5
                ? { domain: d, blocked: true, by: ["securly"] }
                : { domain: d, blocked: false, by: [] };
        };

        const picked = await pickTunnelDomain({
            client: fakeClient(domains),
            classify,
            cacheDir: tmp(),
            maxCandidates: 2,
            concurrency: 1,
        });

        expect(calls).toBe(5);
        expect(domains.map(d => d.domain)).toContain(picked.name);
    });
});

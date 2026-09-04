/**
 * Pick a FreeDNS base domain that no tracked filter blocks — the cross-check
 * the tunnel's module doc calls "the caller's (eventual) job", now built.
 *
 * FreeDNS' registry is the candidate pool (misc/tunnel/freedns `getRegistry`);
 * misc/filters/domainReputation says whether a filter blocks a bare domain.
 * A domain survives if no filter blocks it. Among the survivors the pick is
 * random, so we never hand filters one fixed hostname to learn.
 *
 * ## The cache is the block set
 *
 * Classifying a domain means live calls to vendor rating APIs, so the result is
 * worth keeping. What we persist (via `flat-cache`, to `data/`) is the set of
 * *blocked* domains: the stable, expensive-to-find, actionable negative.
 * Survivors are derived as `registry ∖ blocked` at pick time, so they can never
 * be served stale from disk. The file is rewritten only when that set grows —
 * i.e. only when a new domain gets blocked — which is the requested trigger.
 *
 * ponytail: a domain in the block cache is never re-tested (it short-circuits
 * the vendor calls), so a domain that later becomes unblocked stays out. Delete
 * the cache file to re-test from scratch; a TTL per entry is the upgrade if that
 * ever matters. Clean domains are re-classified every run, which is what "runs
 * each of them through the filter checker" asks for; `maxCandidates` bounds
 * how many go out at once, so a run never stampedes the vendor APIs — see
 * `pickTunnelDomain`'s own doc comment for why that's a batch size, not a
 * ceiling: the pool it draws from is finite and shrinks as it's used.
 */

import { join } from "node:path";
import { create as createCache } from "flat-cache";
import {
    type Classification,
    classifyDomain,
} from "../filters/domainReputation";
import type { FreeDnsClient, RegistryDomain } from "./freedns";

export interface PickDomainOptions {
    /** A logged-in client (its `getRegistry` is all this needs). */
    client: Pick<FreeDnsClient, "getRegistry">;
    /** Override the classifier (tests inject a stub). */
    classify?: (domain: string) => Promise<Classification>;
    /** Where the block cache lives. Default: the repo's gitignored `data/`. */
    cacheDir?: string;
    cacheId?: string;
    /** Registry pages to enumerate. Default: all of them. */
    maxPages?: number;
    /** Batch size for classifying not-yet-blocked domains — tried in order
     *  until one batch has a survivor, or the registry runs out. Default 50;
     *  `Infinity` classifies literally every public domain in one batch. */
    maxCandidates?: number;
    /** Concurrent vendor lookups. Default 8. */
    concurrency?: number;
    /** Injectable RNG (tests pass a deterministic one). */
    random?: () => number;
}

export interface PickedDomain {
    name: string;
    id: number;
}

/** Every public domain FreeDNS lists, deduped, minus the plainly unusable. */
async function listPublicDomains(
    client: Pick<FreeDnsClient, "getRegistry">,
    maxPages: number,
): Promise<RegistryDomain[]> {
    const first = await client.getRegistry(1);
    const pages = Math.min(first.pagesInfo.totalPages || 1, maxPages);

    const rows = [...first.domains];
    for (let page = 2; page <= pages; page++) {
        rows.push(...(await client.getRegistry(page)).domains);
    }

    const seen = new Set<string>();
    return rows.filter(
        d =>
            d.domain &&
            d.id &&
            !/private|disabled/i.test(d.status) &&
            !seen.has(d.domain) &&
            seen.add(d.domain) !== undefined,
    );
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a;
}

/** Run `fn` over `items` at most `limit` at a time. */
async function mapLimit<T>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<void>,
): Promise<void> {
    let cursor = 0;
    const worker = async (): Promise<void> => {
        while (cursor < items.length) {
            await fn(items[cursor++]!);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, worker),
    );
}

/**
 * Resolve a FreeDNS base domain no filter blocks, at random among the clean
 * ones. Throws only if every domain in the registry (minus the already-known
 * -blocked ones) came back blocked.
 *
 * `maxCandidates` is a batch size, not a hard ceiling: the block cache only
 * grows as this runs (against the same finite public registry), so the
 * clean pool thins with every repeated run. Stopping at one blocked batch
 * meant a harness re-run could fail outright once enough of the registry had
 * accumulated into the cache, even with plenty of clean domains left
 * further into `fresh` — confirmed against this project's own accumulated
 * cache (2000+ entries after repeated runs) failing two runs straight on a
 * batch of 50. Batching (rather than classifying all of `fresh` up front)
 * keeps the original "never stampede the vendor APIs" intent for the common
 * case where the first batch already has a survivor.
 */
export async function pickTunnelDomain(
    options: PickDomainOptions,
): Promise<PickedDomain> {
    const {
        client,
        classify = classifyDomain,
        cacheDir = join(import.meta.dirname, "..", "..", "data"),
        cacheId = "freedns-blocked.json",
        maxPages = Number.POSITIVE_INFINITY,
        maxCandidates = 50,
        concurrency = 8,
        random = Math.random,
    } = options;

    const cache = createCache({ cacheId, cacheDir });
    const knownBlocked = new Set(cache.keys());

    const domains = await listPublicDomains(client, maxPages);
    const fresh = shuffle(
        domains.filter(d => !knownBlocked.has(d.domain)),
        random,
    );
    const batchSize = Number.isFinite(maxCandidates)
        ? Math.max(1, maxCandidates)
        : fresh.length;

    let checked = 0;
    let newBlocks = 0;
    for (let start = 0; start < fresh.length; start += batchSize) {
        const batch = fresh.slice(start, start + batchSize);
        checked += batch.length;

        const survivors: RegistryDomain[] = [];
        await mapLimit(batch, concurrency, async d => {
            const result = await classify(d.domain);
            if (result.blocked) {
                cache.setKey(d.domain, result.by);
                newBlocks++;
            } else {
                survivors.push(d);
            }
        });

        if (survivors.length > 0) {
            if (newBlocks > 0) cache.save();
            const chosen = survivors[Math.floor(random() * survivors.length)]!;
            return { name: chosen.domain, id: chosen.id };
        }
    }

    if (newBlocks > 0) cache.save();

    throw new Error(
        `pickTunnelDomain: all ${checked} candidate domain(s) in the ` +
            `registry were blocked — clear ${cacheId} to re-test, or the ` +
            `registry itself may be exhausted.`,
    );
}

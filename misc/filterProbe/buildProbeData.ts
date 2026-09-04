/**
 * Regenerates `probeData.json` — per vendor, the signals that mean "this
 * filter noticed the proxy and blocked it".
 *
 * ## Why a committed fixture (same reasoning as extensionHost's)
 *
 * Deciding whether a page is a filter's block page needs to know what a
 * filter's block page looks like, and that knowledge lives in ~200MB of
 * vendor bundles that have no business in this repository. So the *answer* is
 * committed (a small JSON) and the bundles are not; on a machine that has
 * them, one command regenerates it:
 *
 * ```sh
 * bun misc/filterProbe/buildProbeData.ts
 * # or, if the bundles live elsewhere:
 * CIVIL_FILTER_BUNDLES=/path/to/unpacked bun misc/filterProbe/buildProbeData.ts
 * ```
 *
 * ## What it extracts, per vendor
 *
 *   - `domains`: the vendor's phone-home hosts, taken straight from
 *     `filterVendorDomains` (misc/filters/filterBlockerMiddleware.ts) so the
 *     blocklist and the detector never drift apart. When a filter blocks a
 *     page it redirects to one of these, so a proxied `location.href` landing
 *     on one is the single clearest "flagged" signal.
 *   - `blockMarkers`: distinctive strings from *this vendor's own* block pages
 *     and block-message code (files named like `block*`, and lines matching a
 *     block phrase). Attribution is by folder, which is sound because the
 *     harness installs exactly one filter at a time — a generic "Access
 *     Denied" appearing while only Securly is loaded is Securly. Generic
 *     phrases are kept for that reason; they are still this vendor's rendering
 *     of them.
 *
 * The `.tmp` files (JavaScript despite the extension) are scanned as source.
 * Binaries are not a useful marker source and are skipped — established, not
 * assumed, with three tools:
 *
 *   - ContentKeeper's `ckauth*.nexe` is a Google Native Client ELF (mangled
 *     C++, 1400+ `nacl` symbols), not a Node `nexe` bundle, so `nexedecompiler`
 *     cannot touch it — it checks for a `<nexe~~sentinel>` a NaCl binary does
 *     not have. `strings` over it finds no host. ContentKeeper authenticates
 *     to a per-district appliance and blocks server-side, so there is no
 *     client-side domain or block text to find; its corporate domain stands
 *     in.
 *   - Lightspeed's `filter.wasm`/`client.wasm` and ContentKeeper's `ckenc.wasm`
 *     went through `wasm2js` and `wasm-decompile`; the converted code and the
 *     raw data sections carry no vendor domain and no block phrase. These are
 *     Go/crypto modules whose endpoints are injected at runtime.
 *
 * So every binary was checked and none yields a marker the JS did not.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { filterVendorDomains } from "../filters/filterBlockerMiddleware";
import { FOLDER_TO_VENDOR, VENDOR_DISPLAY_NAMES, VENDORS } from "./vendors";

export interface VendorProbe {
    displayName: string;
    /** Registrable phone-home / block-redirect domains. */
    domains: string[];
    /** Distinctive strings that appear on this vendor's block page. */
    blockMarkers: string[];
}

export type ProbeData = Record<string, VendorProbe>;

const SCANNABLE = /\.(?:js|tmp|mjs|html)$/i;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

/** A file that is (part of) a block/denied/warning page. */
const BLOCK_FILE =
    /(?:^|[/\\])(?:[a-z0-9_-]*(?:block|denied|warning|pause|restrict)[a-z0-9_-]*)\.(?:html|js)$/i;

/** Phrases that mean "we stopped you". Deliberately broad — attribution is by
 *  folder, so breadth costs nothing and catches each vendor's own wording. */
const BLOCK_PHRASE =
    /((?:this )?(?:site|page|url|content|website|request) (?:has been |is |was |currently )?(?:blocked|not available|unavailable|restricted|denied)[^"'`<>]{0,60})|(access (?:has been |is )?(?:denied|blocked|restricted)[^"'`<>]{0,40})|(blocked by [^"'`<>]{0,50})|(blocked (?:for|due to|by) [^"'`<>]{0,50})/gi;

/** Markers this loose would misfire on: strip framework/library boilerplate
 *  and anything that is plainly not a user-facing block message. */
const MARKER_NOISE =
    /error|exception|cors|deprecated|console|undefined|null\b|\$\{|[<>{}]|\\[nrt]/i;

/**
 * Phrases too generic to be a *signal*. A 403 on any ordinary site says
 * "Access Denied"; a proxied third-party page could carry "page not available"
 * for reasons that have nothing to do with a filter. Keeping these would turn
 * the proxy route — which fetches a real third-party site through Civil — into
 * a false-positive machine. The distinctive phrasing a vendor wraps around
 * them ("blocked by school policy", "blocked due to focus lock mode") is kept;
 * the bare stem is dropped.
 */
const GENERIC_MARKERS = new Set(
    [
        "access denied",
        "access blocked",
        "access denied:",
        "access has been denied",
        "blocked by",
        "page blocked",
        "url blocked",
        "page blocked!",
        "page not available",
        "content not available",
        "site not available",
        "this content is unavailable.",
        "this site is not available",
        "this content has been blocked.",
        "this page has been blocked",
        "this site has been blocked",
        "request was denied",
        "request denied",
        "was blocked",
        "is blocked",
        "is blocked.",
    ].map(s => s.toLowerCase()),
);

function isDistinctiveMarker(marker: string): boolean {
    const m = marker.toLowerCase();
    if (GENERIC_MARKERS.has(m)) return false;
    // A distinctive marker either says more than the bare stem (it carries who
    // or why) or is simply longer than a generic 403 line.
    return (
        marker.length >= 18 ||
        /\b(school|teacher|admin|policy|filter|category|district|focus|classroom|organization|administrator)\b/i.test(
            marker,
        )
    );
}

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path, out);
        else out.push(path);
    }
    return out;
}

function markersFromFolder(dir: string): string[] {
    const markers = new Set<string>();
    for (const file of walk(dir)) {
        if (!SCANNABLE.test(file)) continue;
        if (statSync(file).size > MAX_FILE_BYTES) continue;
        const isBlockFile = BLOCK_FILE.test(file);
        // latin1 for the same reason the other scanners use it: third-party
        // bundles of unknown encoding, ASCII patterns.
        const text = readFileSync(file, "latin1");

        for (const match of text.matchAll(BLOCK_PHRASE)) {
            const marker = match[0].replace(/\s+/g, " ").trim();
            if (marker.length < 10 || marker.length > 80) continue;
            if (MARKER_NOISE.test(marker)) continue;
            if (!isDistinctiveMarker(marker)) continue;
            markers.add(marker);
            if (markers.size >= (isBlockFile ? 40 : 24)) break;
        }
    }
    // Shorter markers first: they are the stable core of a phrase, less likely
    // to carry a page-specific tail that changes between releases.
    return [...markers].sort((a, b) => a.length - b.length).slice(0, 24);
}

function main(): void {
    const root =
        process.env.CIVIL_FILTER_BUNDLES ?? join(homedir(), "extensions");
    const domainsByVendor = filterVendorDomains as unknown as Record<
        string,
        readonly string[]
    >;

    // Collect every folder that maps to each vendor, so a vendor's markers are
    // drawn from all of its extensions (GoGuardian + Gopher Buddy, and so on).
    const foldersByVendor = new Map<string, string[]>();
    for (const [folder, vendor] of Object.entries(FOLDER_TO_VENDOR)) {
        const dir = join(root, folder);
        try {
            if (!statSync(dir).isDirectory()) continue;
        } catch {
            continue; // bundle not present on this machine
        }
        (
            foldersByVendor.get(vendor) ??
            foldersByVendor.set(vendor, []).get(vendor)!
        ).push(dir);
    }

    const out: ProbeData = {};
    for (const vendor of VENDORS) {
        const markers = new Set<string>();
        for (const dir of foldersByVendor.get(vendor) ?? [])
            for (const m of markersFromFolder(dir)) markers.add(m);

        out[vendor] = {
            displayName: VENDOR_DISPLAY_NAMES[vendor] ?? vendor,
            domains: [...(domainsByVendor[vendor] ?? [])],
            blockMarkers: [...markers].slice(0, 24),
        };
        process.stdout.write(
            `${vendor}: ${out[vendor]!.domains.length} domains, ${out[vendor]!.blockMarkers.length} block markers\n`,
        );
    }

    const target = join(import.meta.dirname, "probeData.json");
    writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
    process.stdout.write(`\nwrote ${VENDORS.length} vendors to ${target}\n`);
}

main();

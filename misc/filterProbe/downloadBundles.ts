/**
 * Downloads the raw, unpacked filter extensions the sandbox loads.
 *
 * The bundles are never committed to any repo — twenty-eight vendor
 * extensions, ~200MB — and the `Filter-Sources` repo's own cache is no help
 * here: it keeps *deobfuscated `.js`* snapshots for diffing, without the
 * `manifest.json` or the assets the sandbox needs to actually run a filter.
 * So the filter route check acquires its own raw copies, once, and the
 * Blacksmith workflow caches the result — the same "download on the first run,
 * cache thereafter" shape Filter-Sources uses, applied to the runnable bundles
 * this side needs.
 *
 * The source of truth for *what* to download is Filter-Sources'
 * `extensions.json` (folder → id → update URL), fetched from its raw GitHub
 * URL by default so the two never drift, or from a local path via
 * `CIVIL_EXTENSIONS_JSON`. For each entry this speaks Chrome's own Omaha
 * autoupdate protocol to get the CRX URL, downloads it, strips the CRX header,
 * and unzips the ZIP inside to `<dest>/<folder>/`.
 *
 * This repeats, in TypeScript, what Filter-Sources' `tools/src/omaha.zig` and
 * `crx.zig` already do in Zig — including the multi-app response scoping fix
 * (a vendor endpoint answers a query for one id with its whole catalogue, so
 * the `<updatecheck>` must be read from the matching `<app>` block, not the
 * first one). It is duplicated rather than reused because that tool lives in
 * another repo, emits a different artifact, and is not callable from here; the
 * shared contract is `extensions.json`.
 *
 * ```sh
 * bun misc/filterProbe/downloadBundles.ts            # → ./extensions
 * CIVIL_FILTER_BUNDLES=/tmp/ext bun misc/filterProbe/downloadBundles.ts
 * ```
 *
 * Already-present bundles are skipped, so a warm cache costs one HTTP-less
 * pass.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { unzipSync } from "fflate";

const EXTENSIONS_JSON_URL =
    "https://raw.githubusercontent.com/civilnetwork-dev/Filter-Sources/main/extensions.json";

/** The Chrome version the Omaha query claims to be. Stale is fine — nothing in
 *  the response depends on it (see the note in Filter-Sources' omaha.zig); the
 *  request just has to carry a plausible one. */
const PRODVERSION = "151.0.7922.173";

interface ExtensionEntry {
    folder: string;
    id: string;
    updateUrl: string;
}

/** The Omaha request Chrome itself sends, asking with an ancient local version
 *  so the server always returns the full record rather than "noupdate". */
export function buildOmahaUrl(
    updateUrl: string,
    id: string,
    prodversion = PRODVERSION,
): string {
    return (
        `${updateUrl}?os=linux&arch=x64&os_arch=x86_64&nacl_arch=x86-64` +
        `&prod=chromiumcrx&prodchannel=&prodversion=${prodversion}` +
        `&lang=en-US&acceptformat=crx2,crx3` +
        `&x=id%3D${id}%26v%3D0.0.0.0%26installsource%3Dondemand%26uc`
    );
}

/**
 * The `codebase` (CRX URL) for `id`, read from the `<app appid="{id}">` block
 * specifically. Vendor endpoints return their whole multi-app catalogue for
 * any query, so taking the first `<updatecheck>` in the document would grab a
 * different extension's CRX — the same bug Filter-Sources' omaha.zig scopes
 * around.
 */
export function codebaseForApp(xml: string, id: string): string | undefined {
    const appAt = xml.indexOf(`<app appid="${id}"`);
    if (appAt === -1) return undefined;
    const afterApp = xml.slice(appAt);
    const ownEnd = afterApp.indexOf("</app>");
    const nextApp = afterApp.indexOf(
        "<app appid=",
        `<app appid="${id}"`.length,
    );
    const boundary = [ownEnd, nextApp].filter(i => i >= 0);
    const scoped = afterApp.slice(
        0,
        boundary.length ? Math.min(...boundary) : afterApp.length,
    );
    return /codebase="([^"]+)"/.exec(scoped)?.[1];
}

/**
 * The ZIP payload inside a `.crx`. CRX3 is `Cr24` + version + a protobuf
 * header; CRX2 is `Cr24` + version + a public key + a signature. Both are
 * followed by the ZIP. Returns the ZIP slice.
 */
export function zipFromCrx(crx: Uint8Array): Uint8Array {
    const view = new DataView(crx.buffer, crx.byteOffset, crx.byteLength);
    const magic = String.fromCharCode(crx[0]!, crx[1]!, crx[2]!, crx[3]!);
    if (magic !== "Cr24") {
        // Some vendor endpoints hand back a bare ZIP. If it already looks like
        // one, take it as-is.
        if (crx[0] === 0x50 && crx[1] === 0x4b) return crx;
        throw new Error("not a CRX (missing Cr24 magic)");
    }
    const version = view.getUint32(4, true);
    if (version === 3) {
        const headerLen = view.getUint32(8, true);
        return crx.subarray(12 + headerLen);
    }
    // CRX2: version 2, then pubkey length and signature length.
    const pubKeyLen = view.getUint32(8, true);
    const sigLen = view.getUint32(12, true);
    return crx.subarray(16 + pubKeyLen + sigLen);
}

async function loadEntries(): Promise<ExtensionEntry[]> {
    const local = process.env.CIVIL_EXTENSIONS_JSON;
    if (local) {
        const { readFileSync } = await import("node:fs");
        return JSON.parse(readFileSync(local, "utf8"));
    }
    const res = await fetch(EXTENSIONS_JSON_URL);
    if (!res.ok)
        throw new Error(
            `could not fetch extensions.json (${res.status}) — set CIVIL_EXTENSIONS_JSON to a local copy`,
        );
    return res.json() as Promise<ExtensionEntry[]>;
}

async function downloadOne(
    entry: ExtensionEntry,
    dest: string,
): Promise<"downloaded" | "cached" | "failed"> {
    const dir = join(dest, entry.folder);
    if (existsSync(join(dir, "manifest.json"))) return "cached";

    try {
        const omaha = await fetch(buildOmahaUrl(entry.updateUrl, entry.id));
        const codebase = codebaseForApp(await omaha.text(), entry.id);
        if (!codebase) return "failed";

        const crxRes = await fetch(codebase);
        if (!crxRes.ok) return "failed";
        const crx = new Uint8Array(await crxRes.arrayBuffer());

        const files = unzipSync(zipFromCrx(crx));
        for (const [path, data] of Object.entries(files)) {
            if (path.endsWith("/") || data.length === 0) continue;
            const abs = join(dir, path);
            mkdirSync(dirname(abs), { recursive: true });
            writeFileSync(abs, data);
        }
        return existsSync(join(dir, "manifest.json")) ? "downloaded" : "failed";
    } catch {
        return "failed";
    }
}

async function main(): Promise<void> {
    const dest =
        process.env.CIVIL_FILTER_BUNDLES ?? join(homedir(), "extensions");
    mkdirSync(dest, { recursive: true });

    const entries = await loadEntries();
    let downloaded = 0;
    let cached = 0;
    const failed: string[] = [];

    for (const entry of entries) {
        const outcome = await downloadOne(entry, dest);
        if (outcome === "downloaded") downloaded++;
        else if (outcome === "cached") cached++;
        else failed.push(entry.folder);
        process.stdout.write(`${outcome.padEnd(10)} ${entry.folder}\n`);
    }

    process.stdout.write(
        `\n${downloaded} downloaded, ${cached} cached, ${failed.length} failed` +
            `${failed.length ? `: ${failed.join(", ")}` : ""}\n`,
    );
    // A failed download is not fatal to the whole run — the sandbox skips a
    // vendor whose folder is absent — but the exit code lets CI notice.
    if (failed.length) process.exitCode = 1;
}

// Only run when invoked directly, so the pure helpers above can be imported by
// a test without hitting the network. `pathToFileURL` gets the file:// spelling
// right across platforms — a hand-built `file://${path}` drops a slash on
// Windows and never matches.
if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    void main();
}

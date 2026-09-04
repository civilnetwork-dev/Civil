/**
 * Reads and validates an unpacked extension's manifest.json.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { ChromeManifest } from "../browserApiEmulators/extensions/chrome/types";

export class ManifestError extends Error {}

/** Background entry point(s) resolved to a manifest_version-independent shape:
 *  MV3 has one `service_worker`, MV2 can list multiple `scripts` or point at
 *  one `page`. For `page`, `files` holds the HTML document itself — the
 *  scripts it pulls in are extracted by `backgroundScriptsFromPage`, which
 *  needs the file's contents and so belongs to the caller that reads it. */
export interface ResolvedBackground {
    type: "service_worker" | "scripts" | "page" | "none";
    files: string[];
}

export async function loadManifest(dir: string): Promise<ChromeManifest> {
    const path = join(dir, "manifest.json");
    let raw: string;
    try {
        raw = await readFile(path, "utf-8");
    } catch (error) {
        throw new ManifestError(
            `no manifest.json in ${dir}: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    let manifest: ChromeManifest;
    try {
        manifest = JSON.parse(raw);
    } catch (error) {
        throw new ManifestError(
            `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
    }

    if (manifest.manifest_version !== 2 && manifest.manifest_version !== 3) {
        throw new ManifestError(
            `${path}: manifest_version must be 2 or 3, got ${JSON.stringify(manifest.manifest_version)}`,
        );
    }
    if (typeof manifest.name !== "string" || !manifest.name) {
        throw new ManifestError(`${path}: missing required "name"`);
    }
    if (typeof manifest.version !== "string" || !manifest.version) {
        throw new ManifestError(`${path}: missing required "version"`);
    }

    return manifest;
}

export function resolveBackground(
    manifest: ChromeManifest,
): ResolvedBackground {
    const bg = manifest.background;
    // Legacy Chrome Packaged Apps (lanschoolStudent still ships one) nest
    // their background under `app.background.scripts` instead — same
    // `scripts` shape, different home in the manifest.
    if (!bg) {
        const appScripts = manifest.app?.background?.scripts;
        return appScripts?.length
            ? { type: "scripts", files: appScripts }
            : { type: "none", files: [] };
    }
    if (bg.service_worker)
        return { type: "service_worker", files: [bg.service_worker] };
    if (bg.scripts?.length) return { type: "scripts", files: bg.scripts };
    // MV2 event pages (`background.page`) point at an HTML document rather
    // than a script. There is no DOM here to load it into, but that isn't
    // what the document is for: a background page's body is empty and its
    // <script> tags are the extension's actual background code. Two of the
    // tracked filters (goguardian, contentkeeper) ship one, and treating it
    // as "no background" meant neither ever ran a line — every observation
    // about them would have been an observation of an extension doing
    // nothing. The scripts are extracted in `backgroundScriptsFromPage`.
    if (bg.page) return { type: "page", files: [bg.page] };
    return { type: "none", files: [] };
}

/** Every `<script>` in a background page, in document order: `{ src }` for
 *  `<script src="...">` and `{ code }` for an inline block. Deliberately a
 *  regex and not an HTML parser — a background page is a near-empty document
 *  whose whole purpose is its script tags, and the alternative is a DOM
 *  implementation this host has no other use for. */
export function backgroundScriptsFromPage(
    html: string,
): ({ src: string } | { code: string })[] {
    const out: ({ src: string } | { code: string })[] = [];
    const tag = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
    for (const [, attributes = "", body = ""] of html.matchAll(tag)) {
        const src = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1];
        if (src) out.push({ src: src.replace(/^\//, "") });
        else if (body.trim()) out.push({ code: body });
    }
    return out;
}

export function extensionUrl(extensionId: string, path: string): string {
    const clean = path.startsWith("/") ? path.slice(1) : path;
    return `chrome-extension://${extensionId}/${clean}`;
}

/** Chrome extension ids are 32 lowercase letters a-p (base16 over a shifted
 *  alphabet). Real enough to satisfy code that pattern-matches the shape. */
export function randomExtensionId(): string {
    const alphabet = "abcdefghijklmnop";
    let id = "";
    for (let i = 0; i < 32; i++) {
        id += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return id;
}

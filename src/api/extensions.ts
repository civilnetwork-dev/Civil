import { inflateSync } from "fflate";

import {
    createReactiveJSON,
    lsRemove,
    lsSetJSON,
    lsSetRaw,
} from "~/lib/reactiveStorage";
import type { ChromeManifest, CivilExtension, FirefoxManifest } from "~/types";

import { getTFS } from "./fs";

const LS_KEY = "civil-extensions";
const EXTERNAL_LS_KEY = "civil-ext-external-keys";

/** Live, reactive extension index. Updates on install/uninstall/enable/update. */
const extensions = createReactiveJSON<Omit<CivilExtension, "files">[]>(
    LS_KEY,
    [],
);

const CRX4_MAGIC = 0x34327243;
const CRX3_MAGIC = 0x33327243;
const ZIP_MAGIC = 0x04034b50;

export type ExtensionMessages = Record<
    string,
    { message: string; placeholders?: Record<string, { content: string }> }
>;

export function normalizeExtensionPath(filePath: string): string {
    return filePath
        .replace(/^[a-z]+:\/\/[^/]+\//i, "")
        .replace(/^\/+/, "")
        .replace(/\\/g, "/")
        .split("/")
        .filter(part => part && part !== ".")
        .join("/");
}

function loadIndex(): Omit<CivilExtension, "files">[] {
    return extensions();
}

/**
 * Maps known userscript manager extension IDs to the window.external key they
 * inject.  Many managers use __MSG_* in manifest.name so name-matching alone
 * is unreliable.
 */
const USERSCRIPT_MANAGER_IDS: Record<string, string> = {
    dhdgffkkebhmkfjojejmpbldmpobfkfo: "Tampermonkey",
    lcmhijbkigalmkeommnijlpobloojgfn: "Tampermonkey",
    gcalenpjmijncebpfijmoaglllgpjagf: "Tampermonkey",
    iikmkjmpaadaobahmlepeloendndfphd: "Tampermonkey",
    clngdbkpkpeebahjckkjfobafhncgmne: "Tampermonkey",
    // Violentmonkey
    jinjaccalgkeieljmalmmncelknfijep: "Violentmonkey",
    // Firemonkey
    eppiocemhmnlbhjplcgkofciiegomcon: "FireMonkey",
};

/**
 * Writes window.external key stubs for installed userscript managers to
 * localStorage so that CIVIL_EXT_DETECT_STUB (injected at document_start by
 * the SW) can expose them synchronously on every proxied page.
 *
 * Greasyfork detection: window.external?.Tampermonkey / Violentmonkey / FireMonkey
 */
function syncExternalKeys(exts: Omit<CivilExtension, "files">[]): void {
    try {
        const keys: Record<string, { version: string }> = {};
        for (const ext of exts) {
            if (!ext.enabled) continue;
            // Primary: ID-based detection (works even with __MSG_* names)
            let key: string | null = USERSCRIPT_MANAGER_IDS[ext.id] ?? null;
            if (!key) {
                // Fallback: literal name matching (for extensions with plain names)
                const name = (
                    (ext.manifest as ChromeManifest).name ?? ""
                ).toLowerCase();
                if (name.includes("tampermonkey")) key = "Tampermonkey";
                else if (name.includes("violentmonkey")) key = "Violentmonkey";
                else if (name.includes("firemonkey")) key = "FireMonkey";
            }
            if (key) {
                keys[key] = {
                    version:
                        (ext.manifest as ChromeManifest).version ?? "1.0.0",
                };
            }
        }
        console.log(
            "[civil/extensions] syncExternalKeys: wrote",
            JSON.stringify(keys),
            "for",
            exts.length,
            "extensions",
        );
        if (Object.keys(keys).length > 0) {
            lsSetRaw(EXTERNAL_LS_KEY, JSON.stringify(keys));
        } else {
            lsRemove(EXTERNAL_LS_KEY);
        }
    } catch (e) {
        console.error("[civil/extensions] syncExternalKeys() failed:", e);
    }
}

function saveIndex(exts: Omit<CivilExtension, "files">[]): void {
    try {
        lsSetJSON(LS_KEY, exts);
        syncExternalKeys(exts);
    } catch (e) {
        console.error("[civil/extensions] saveIndex() failed:", e);
    }
}

function unzip(data: Uint8Array): Map<string, Uint8Array> {
    console.log(
        "[civil/extensions] unzip(): parsing ZIP, size:",
        data.byteLength,
    );
    const result = new Map<string, Uint8Array>();
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const decoder = new TextDecoder();

    const EOCD_SIG = 0x06054b50;
    let eocdOffset = -1;
    for (let i = data.byteLength - 22; i >= 0; i--) {
        if (view.getUint32(i, true) === EOCD_SIG) {
            eocdOffset = i;
            break;
        }
    }
    if (eocdOffset === -1)
        throw new Error("[civil/extensions] unzip(): no EOCD record found");

    const cdOffset = view.getUint32(eocdOffset + 16, true);
    const cdEntries = view.getUint16(eocdOffset + 10, true);
    console.log(
        "[civil/extensions] unzip(): CD offset",
        cdOffset,
        "entries",
        cdEntries,
    );

    let cdPos = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
        if (view.getUint32(cdPos, true) !== 0x02014b50) {
            console.warn(
                "[civil/extensions] unzip(): unexpected CD sig at",
                cdPos,
            );
            break;
        }
        const flags = view.getUint16(cdPos + 8, true);
        const compression = view.getUint16(cdPos + 10, true);
        const compressedSize = view.getUint32(cdPos + 20, true);
        const fnLen = view.getUint16(cdPos + 28, true);
        const extraLen = view.getUint16(cdPos + 30, true);
        const commentLen = view.getUint16(cdPos + 32, true);
        const lfhOffset = view.getUint32(cdPos + 42, true);
        const fileName = decoder.decode(
            data.subarray(cdPos + 46, cdPos + 46 + fnLen),
        );
        cdPos += 46 + fnLen + extraLen + commentLen;

        if (fileName.endsWith("/")) continue;
        if (flags & 0x1) {
            console.warn("[civil/extensions] skipping encrypted:", fileName);
            continue;
        }

        const lfhFnLen = view.getUint16(lfhOffset + 26, true);
        const lfhExtraLen = view.getUint16(lfhOffset + 28, true);
        const dataOffset = lfhOffset + 30 + lfhFnLen + lfhExtraLen;
        const compressed = data.subarray(
            dataOffset,
            dataOffset + compressedSize,
        );

        if (compression === 0) {
            result.set(fileName, compressed.slice());
        } else if (compression === 8) {
            try {
                result.set(fileName, inflateSync(compressed));
            } catch (e) {
                console.error(
                    `[civil/extensions] inflate failed "${fileName}":`,
                    e,
                );
            }
        } else {
            console.warn(
                `[civil/extensions] unsupported compression ${compression} for "${fileName}"`,
            );
        }
    }

    console.log("[civil/extensions] unzip(): extracted", result.size, "files");
    return result;
}

/**
 * Maps the first 16 bytes of a hash to a Chrome extension ID string.
 * Chrome uses the alphabet "abcdefghijklmnop" (a=0, p=15), two chars per byte
 * (high nibble first).
 */
function nibblesToExtId(hash: Uint8Array): string {
    const alpha = "abcdefghijklmnop";
    let id = "";
    for (let i = 0; i < 16; i++) {
        id += alpha[(hash[i]! >> 4) & 0xf];
        id += alpha[hash[i]! & 0xf];
    }
    return id;
}

/**
 * Read a protobuf varint from data at pos.
 * Returns [value, bytes_consumed].
 */
function pbVarint(data: Uint8Array, pos: number): [number, number] {
    let val = 0;
    let shift = 0;
    let consumed = 0;
    for (; pos + consumed < data.length; consumed++) {
        const b = data[pos + consumed]!;
        val |= (b & 0x7f) << shift;
        shift += 7;
        if (!(b & 0x80)) {
            consumed++;
            break;
        }
    }
    return [val, consumed];
}

/**
 * Find the first length-delimited (wire type 2) field with the given field
 * number in a protobuf message.  Returns the raw bytes of that field, or null.
 */
function pbFindField(data: Uint8Array, targetField: number): Uint8Array | null {
    let pos = 0;
    while (pos < data.length) {
        const [tag, tLen] = pbVarint(data, pos);
        pos += tLen;
        const fieldNum = tag >>> 3;
        const wireType = tag & 7;
        if (wireType === 2) {
            const [len, lLen] = pbVarint(data, pos);
            pos += lLen;
            if (fieldNum === targetField) return data.subarray(pos, pos + len);
            pos += len;
        } else if (wireType === 0) {
            const [, vLen] = pbVarint(data, pos);
            pos += vLen;
        } else if (wireType === 1) {
            pos += 8;
        } else if (wireType === 5) {
            pos += 4;
        } else {
            break;
        }
    }
    return null;
}

/**
 * Derive the canonical Chrome extension ID from raw CRX bytes + parsed manifest.
 *
 * Strategy 1 – manifest.key present (development / self-hosted CRX):
 *   base64-decode the key → SHA-256 → nibble-map first 16 bytes.
 *
 * Strategy 2 – CRX3/CRX4 header protobuf:
 *   CrxFileHeader.signed_header_data (field 10000) → SignedData.crx_id (field 1)
 *   → nibble-map 16 bytes.
 *
 * Returns null if neither strategy succeeds; the caller falls back to
 * crypto.randomUUID().
 */
async function deriveCrxExtId(
    rawCrx: Uint8Array,
    manifest: ChromeManifest,
): Promise<string | null> {
    // Strategy 1: manifest.key
    const manifestKey = (manifest as unknown as Record<string, unknown>).key;
    if (typeof manifestKey === "string" && manifestKey) {
        try {
            const b64 = manifestKey.replace(/\s+/g, "");
            const binary = atob(b64);
            const keyBytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++)
                keyBytes[i] = binary.charCodeAt(i);
            const hash = new Uint8Array(
                await crypto.subtle.digest("SHA-256", keyBytes),
            );
            console.log(
                "[civil/extensions] deriveCrxExtId(): derived from manifest.key",
            );
            return nibblesToExtId(hash);
        } catch (e) {
            console.warn(
                "[civil/extensions] deriveCrxExtId(): manifest.key path failed",
                e,
            );
        }
    }

    // Strategy 2: CRX3/CRX4 header protobuf
    if (rawCrx.length < 12) return null;
    const view = new DataView(
        rawCrx.buffer,
        rawCrx.byteOffset,
        rawCrx.byteLength,
    );
    const magic = view.getUint32(0, true);
    if (magic !== CRX3_MAGIC && magic !== CRX4_MAGIC) return null;
    const headerSize = view.getUint32(8, true);
    if (12 + headerSize > rawCrx.length) return null;
    const headerBytes = rawCrx.subarray(12, 12 + headerSize);

    try {
        // CrxFileHeader.signed_header_data = field 10000
        const signedData = pbFindField(headerBytes, 10000);
        if (!signedData) return null;
        // SignedData.crx_id = field 1 (first 16 bytes of SHA-256 of public key)
        const crxId = pbFindField(signedData, 1);
        if (!crxId || crxId.length < 16) return null;
        console.log(
            "[civil/extensions] deriveCrxExtId(): derived from CRX3 header",
        );
        return nibblesToExtId(crxId);
    } catch (e) {
        console.warn(
            "[civil/extensions] deriveCrxExtId(): CRX3 header parse failed",
            e,
        );
        return null;
    }
}

function parseCrx(data: Uint8Array): Uint8Array {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const magic = view.getUint32(0, true);
    console.log("[civil/extensions] parseCrx() magic:", magic.toString(16));
    if (magic === CRX4_MAGIC || magic === CRX3_MAGIC) {
        const headerSize = view.getUint32(8, true);
        const zipStart = 12 + headerSize;
        console.log(
            "[civil/extensions] parseCrx(): CRX, headerSize:",
            headerSize,
            "zipStart:",
            zipStart,
        );
        return data.slice(zipStart);
    }
    if (magic === ZIP_MAGIC) {
        console.log("[civil/extensions] parseCrx(): raw ZIP");
        return data;
    }
    const header = Array.from(data.slice(0, 16))
        .map(b => b.toString(16).padStart(2, "0"))
        .join(" ");
    throw new Error(
        `[civil/extensions] Unknown format (magic: ${magic.toString(16)}, bytes: ${header})`,
    );
}

function tfsWriteFile(tfs: any, path: string, buf: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
        tfs.fs.writeFile(path, buf, "arraybuffer", (err: Error | null) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

function tfsMkdir(tfs: any, path: string): Promise<void> {
    return new Promise(resolve => {
        tfs.fs.mkdir(path, (err: Error | null) => {
            if (err)
                console.warn(
                    "[civil/extensions] mkdir warn:",
                    path,
                    err?.message,
                );
            resolve();
        });
    });
}

/**
 * Read locale messages from the raw file map (available at install time before
 * OPFS write).  Tries the manifest's default_locale first, then falls back to
 * "en" and "en_US".
 */
function readLocaleMessagesFromFiles(
    files: Map<string, Uint8Array>,
    defaultLocale?: string,
): Record<string, { message: string }> {
    const decoder = new TextDecoder();
    const candidates = [defaultLocale?.replace("-", "_"), "en", "en_US"].filter(
        (v): v is string => Boolean(v),
    );
    const seen = new Set<string>();
    for (const locale of candidates) {
        if (seen.has(locale)) continue;
        seen.add(locale);
        const bytes = files.get(`_locales/${locale}/messages.json`);
        if (bytes) {
            try {
                return JSON.parse(decoder.decode(bytes)) as Record<
                    string,
                    { message: string }
                >;
            } catch {}
        }
    }
    return {};
}

/**
 * Replace all __MSG_keyName__ placeholders in a string using the supplied
 * locale messages object.  Returns the original string if no messages file was
 * found or the key is missing.
 */
function resolveManifestString(
    value: string,
    messages: Record<string, { message: string }>,
): string {
    if (!value.includes("__MSG_")) return value;
    return value.replace(/__MSG_(\w+)__/g, (_m, key: string) => {
        return (
            messages[key]?.message ??
            messages[key.toLowerCase()]?.message ??
            value
        );
    });
}

/**
 * Mutates the manifest in-place, resolving all top-level string fields that
 * use __MSG_* substitution tokens.  Chrome does this automatically; we need to
 * replicate it so stored names / descriptions are human-readable.
 */
function resolveManifestMessages(
    manifest: ChromeManifest | FirefoxManifest,
    files: Map<string, Uint8Array>,
): void {
    const messages = readLocaleMessagesFromFiles(
        files,
        manifest.default_locale,
    );
    if (Object.keys(messages).length === 0) return;
    const m = manifest as unknown as Record<string, unknown>;
    for (const field of ["name", "description", "short_name"] as const) {
        const raw = m[field];
        if (typeof raw === "string" && raw.includes("__MSG_")) {
            m[field] = resolveManifestString(raw, messages);
        }
    }
}

async function installToFS(
    id: string,
    files: Map<string, Uint8Array>,
): Promise<void> {
    console.log(
        "[civil/extensions] installToFS():",
        files.size,
        "files for",
        id,
    );
    try {
        const tfs = await getTFS();
        const basePath = `/extensions/${id}`;
        await tfsMkdir(tfs, "/extensions");
        await tfsMkdir(tfs, basePath);

        const madeDirs = new Set<string>();
        madeDirs.add("/extensions");
        madeDirs.add(basePath);

        for (const [filePath, content] of files.entries()) {
            const fullPath = `${basePath}/${filePath}`;
            const parts = fullPath.split("/").filter(Boolean);

            for (let i = 1; i < parts.length - 1; i++) {
                const dir = "/" + parts.slice(0, i + 1).join("/");
                if (!madeDirs.has(dir)) {
                    await tfsMkdir(tfs, dir);
                    madeDirs.add(dir);
                }
            }

            try {
                await tfsWriteFile(
                    tfs,
                    fullPath,
                    content.buffer as ArrayBuffer,
                );
            } catch (e) {
                console.error(
                    `[civil/extensions] write failed "${fullPath}":`,
                    e,
                );
            }
        }
        console.log("[civil/extensions] installToFS(): done for", id);
    } catch (e) {
        console.error("[civil/extensions] installToFS() failed:", e);
        throw e;
    }
}

/**
 * Install a Chrome extension from raw .crx bytes.
 */
export async function extensionsInstallCrx(
    data: Uint8Array | ArrayBuffer,
): Promise<Omit<CivilExtension, "files">> {
    console.log("[civil/extensions] extensionsInstallCrx(): starting");
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const zipData = parseCrx(bytes);
    const files = unzip(zipData);
    const manifestBytes = files.get("manifest.json");
    if (!manifestBytes) {
        console.error(
            "[civil/extensions] manifest.json missing, found:",
            [...files.keys()].slice(0, 20),
        );
        throw new Error("[civil/extensions] No manifest.json in CRX");
    }
    const manifest: ChromeManifest = JSON.parse(
        new TextDecoder().decode(manifestBytes),
    );
    // Resolve __MSG_* locale placeholders so the stored name/description are
    // human-readable (e.g. "Tampermonkey" not "__MSG_extName__").
    resolveManifestMessages(manifest, files);
    console.log(
        "[civil/extensions] CRX manifest:",
        manifest.name,
        "v" + manifest.version,
    );
    // Derive the real Chrome extension ID from the CRX key material so that
    // sites like Greasyfork can detect the extension by its canonical ID.
    // Falls back to a random UUID if derivation fails.
    const derivedId = await deriveCrxExtId(bytes, manifest);
    const id = derivedId ?? crypto.randomUUID();
    console.log(
        "[civil/extensions] extensionsInstallCrx(): id =",
        id,
        derivedId ? "(derived)" : "(uuid fallback)",
    );
    const ext: Omit<CivilExtension, "files"> = {
        id,
        name: manifest.name,
        version: manifest.version,
        manifest,
        type: "crx",
        enabled: true,
    };
    await installToFS(id, files);
    // Replace any existing entry with the same ID (re-install / update case).
    saveIndex([...loadIndex().filter(e => e.id !== id), ext]);
    return ext;
}

/**
 * Install a Firefox extension from raw .xpi bytes.
 */
export async function extensionsInstallXpi(
    data: Uint8Array | ArrayBuffer,
): Promise<Omit<CivilExtension, "files">> {
    console.log("[civil/extensions] extensionsInstallXpi(): starting");
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const files = unzip(bytes);
    const manifestBytes = files.get("manifest.json");
    if (!manifestBytes) {
        console.error(
            "[civil/extensions] manifest.json missing, found:",
            [...files.keys()].slice(0, 20),
        );
        throw new Error("[civil/extensions] No manifest.json in XPI");
    }
    const manifest: FirefoxManifest = JSON.parse(
        new TextDecoder().decode(manifestBytes),
    );
    // Resolve __MSG_* locale placeholders (same as Chrome/Firefox do at install).
    resolveManifestMessages(manifest, files);
    console.log(
        "[civil/extensions] XPI manifest:",
        manifest.name,
        "v" + manifest.version,
    );
    const id = crypto.randomUUID();
    const ext: Omit<CivilExtension, "files"> = {
        id,
        name: manifest.name,
        version: manifest.version,
        manifest,
        type: "xpi",
        enabled: true,
    };
    await installToFS(id, files);
    saveIndex([...loadIndex(), ext]);
    return ext;
}

/**
 * Compare two dotted version strings (e.g. "5.4.1" vs "5.4.10").
 * Returns 1 if a > b, -1 if a < b, 0 if equal. Non-numeric segments are
 * compared lexicographically as a fallback.
 */
function compareVersions(a: string, b: string): number {
    const pa = a.split(".");
    const pb = b.split(".");
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
        const na = Number(pa[i] ?? "0");
        const nb = Number(pb[i] ?? "0");
        if (!Number.isNaN(na) && !Number.isNaN(nb)) {
            if (na > nb) return 1;
            if (na < nb) return -1;
        } else {
            const sa = pa[i] ?? "";
            const sb = pb[i] ?? "";
            if (sa > sb) return 1;
            if (sa < sb) return -1;
        }
    }
    return 0;
}

/**
 * Fetch a cross-origin URL through the same-origin server proxy. Extension
 * update services (e.g. clients2.google.com) don't send CORS headers, so a
 * direct browser fetch is blocked; the server relays it instead.
 */
function extProxyFetch(target: string): Promise<Response> {
    return fetch(`/api/ext-proxy?url=${encodeURIComponent(target)}`);
}

/**
 * Query a Chrome Omaha update service (manifest `update_url`) for the latest
 * version + CRX download URL of an extension. Returns null if the response is
 * unusable.
 */
async function checkChromeUpdate(
    updateUrl: string,
    extId: string,
    currentVersion: string,
): Promise<{ version: string; downloadUrl: string } | null> {
    const url = new URL(updateUrl);
    // Omaha update check. Google's clients2 service ignores the request and
    // returns no <updatecheck> unless prodversion + acceptformat are supplied;
    // a high prodversion asks for the latest regardless of the running Chrome.
    url.searchParams.set("prodversion", "132.0.0.0");
    url.searchParams.set("prodchannel", "stable");
    url.searchParams.set("acceptformat", "crx2,crx3");
    url.searchParams.set(
        "x",
        `id=${extId}&v=${currentVersion}&installsource=ondemand&uc`,
    );
    const res = await extProxyFetch(url.toString());
    if (!res.ok) throw new Error(`update check HTTP ${res.status}`);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/xml");
    let nodes = doc.getElementsByTagName("updatecheck");
    if (nodes.length === 0)
        nodes = doc.getElementsByTagNameNS("*", "updatecheck");
    for (const node of Array.from(nodes)) {
        // status="noupdate" means already current; "ok" carries codebase+version.
        if (node.getAttribute("status") === "noupdate") return null;
        const version = node.getAttribute("version");
        const codebase = node.getAttribute("codebase");
        if (version && codebase) return { version, downloadUrl: codebase };
    }
    return null;
}

/**
 * Query a Firefox update manifest (JSON, `browser_specific_settings.gecko.
 * update_url`) for the latest version + XPI download URL. Returns null if the
 * response is unusable.
 */
async function checkFirefoxUpdate(
    updateUrl: string,
    geckoId: string,
): Promise<{ version: string; downloadUrl: string } | null> {
    const res = await extProxyFetch(updateUrl);
    if (!res.ok) throw new Error(`update check HTTP ${res.status}`);
    const json = (await res.json()) as {
        addons?: Record<
            string,
            { updates?: { version?: string; update_link?: string }[] }
        >;
    };
    const updates = json.addons?.[geckoId]?.updates ?? [];
    let best: { version: string; downloadUrl: string } | null = null;
    for (const u of updates) {
        if (!u.version || !u.update_link) continue;
        if (!best || compareVersions(u.version, best.version) > 0)
            best = { version: u.version, downloadUrl: u.update_link };
    }
    return best;
}

/**
 * Reinstall an extension in place from freshly downloaded bytes, preserving its
 * ID and enabled state. Used by the update flow (extensionsInstallXpi would
 * otherwise mint a new UUID and duplicate the entry).
 */
async function reinstallInPlace(
    existing: Omit<CivilExtension, "files">,
    data: Uint8Array,
): Promise<Omit<CivilExtension, "files">> {
    const zipData = existing.type === "crx" ? parseCrx(data) : data;
    const files = unzip(zipData);
    const manifestBytes = files.get("manifest.json");
    if (!manifestBytes)
        throw new Error("[civil/extensions] No manifest.json in update");
    const manifest: ChromeManifest | FirefoxManifest = JSON.parse(
        new TextDecoder().decode(manifestBytes),
    );
    resolveManifestMessages(manifest, files);
    await installToFS(existing.id, files);
    const updated: Omit<CivilExtension, "files"> = {
        ...existing,
        name: manifest.name,
        version: manifest.version,
        manifest,
    };
    saveIndex(loadIndex().map(e => (e.id === existing.id ? updated : e)));
    return updated;
}

export interface ExtensionUpdateResult {
    id: string;
    name: string;
    status: "updated" | "up-to-date" | "no-update-url" | "error";
    fromVersion: string;
    toVersion?: string;
    error?: string;
}

/**
 * Check every installed extension against its manifest update URL and, when a
 * newer version is available, download and reinstall it in place. Returns a
 * per-extension result so the UI can report what happened.
 */
export async function extensionsCheckForUpdates(): Promise<
    ExtensionUpdateResult[]
> {
    const results: ExtensionUpdateResult[] = [];
    for (const ext of loadIndex()) {
        const base = {
            id: ext.id,
            name: ext.name,
            fromVersion: ext.version,
        };
        try {
            const m = ext.manifest as unknown as Record<string, unknown>;
            let latest: { version: string; downloadUrl: string } | null = null;
            if (ext.type === "crx") {
                // Fall back to Google's update service for Web Store extensions
                // whose uploaded CRX had update_url stripped (id is the 32-char
                // a–p Web Store id).
                const updateUrl =
                    (m.update_url as string | undefined) ||
                    (/^[a-p]{32}$/.test(ext.id)
                        ? "https://clients2.google.com/service/update2/crx"
                        : undefined);
                if (!updateUrl) {
                    results.push({ ...base, status: "no-update-url" });
                    continue;
                }
                latest = await checkChromeUpdate(
                    updateUrl,
                    ext.id,
                    ext.version,
                );
            } else {
                const gecko = (
                    m.browser_specific_settings as
                        | { gecko?: { id?: string; update_url?: string } }
                        | undefined
                )?.gecko;
                const updateUrl = gecko?.update_url;
                if (!updateUrl) {
                    results.push({ ...base, status: "no-update-url" });
                    continue;
                }
                latest = await checkFirefoxUpdate(
                    updateUrl,
                    gecko?.id ?? ext.id,
                );
            }

            if (!latest) {
                results.push({ ...base, status: "up-to-date" });
                continue;
            }
            if (compareVersions(latest.version, ext.version) <= 0) {
                results.push({ ...base, status: "up-to-date" });
                continue;
            }

            const res = await extProxyFetch(latest.downloadUrl);
            if (!res.ok) throw new Error(`download HTTP ${res.status}`);
            const bytes = new Uint8Array(await res.arrayBuffer());
            await reinstallInPlace(ext, bytes);
            results.push({
                ...base,
                status: "updated",
                toVersion: latest.version,
            });
        } catch (e) {
            results.push({
                ...base,
                status: "error",
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    return results;
}

/**
 * Install an extension from a remote URL (.crx or .xpi).
 */
export async function extensionsInstallFromUrl(
    url: string,
): Promise<Omit<CivilExtension, "files">> {
    console.log("[civil/extensions] extensionsInstallFromUrl():", url);
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`[civil/extensions] Fetch failed: ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (url.toLowerCase().endsWith(".crx")) return extensionsInstallCrx(data);
    if (url.toLowerCase().endsWith(".xpi")) return extensionsInstallXpi(data);
    throw new Error("[civil/extensions] URL must end with .crx or .xpi");
}

/**
 * Re-sync window.external keys to localStorage from the current extension index.
 * Call on app boot so that extensions installed in a previous session that
 * pre-date syncExternalKeys() are still reflected in the stub.
 */
export function extensionsSyncExternalKeys(): void {
    syncExternalKeys(loadIndex());
}

export function extensionsGetAll(): Omit<CivilExtension, "files">[] {
    return loadIndex();
}

export function extensionsGetById(
    id: string,
): Omit<CivilExtension, "files"> | null {
    return loadIndex().find(e => e.id === id) ?? null;
}

/**
 * Enable or disable an installed extension by ID.
 */
export function extensionsSetEnabled(id: string, enabled: boolean): void {
    saveIndex(loadIndex().map(e => (e.id === id ? { ...e, enabled } : e)));
}

/**
 * Uninstall an extension by ID.
 */
export async function extensionsUninstall(id: string): Promise<void> {
    console.log("[civil/extensions] extensionsUninstall():", id);
    saveIndex(loadIndex().filter(e => e.id !== id));
    try {
        const tfs = await getTFS();
        await new Promise<void>(resolve => {
            tfs.shell.rm(
                `/extensions/${id}`,
                { recursive: true },
                (err: Error | null) => {
                    if (err)
                        console.warn(
                            "[civil/extensions] rm warn:",
                            err.message,
                        );
                    resolve();
                },
            );
        });
    } catch (e) {
        console.warn("[civil/extensions] uninstall TFS cleanup failed:", e);
    }
}

/**
 * Read an extension file from TFS as a UTF-8 string.
 */
export function extensionsReadText(
    extId: string,
    filePath: string,
): Promise<string> {
    const normalizedPath = normalizeExtensionPath(filePath);
    return getTFS().then(
        tfs =>
            new Promise<string>((resolve, reject) => {
                tfs.fs.readFile(
                    `/extensions/${extId}/${normalizedPath}`,
                    "utf8",
                    (err: Error | null, data: string) => {
                        if (err) reject(err);
                        else resolve(data);
                    },
                );
            }),
    );
}

export async function extensionsReadLocaleMessages(
    extId: string,
    manifest: ChromeManifest | FirefoxManifest,
): Promise<ExtensionMessages> {
    const locale =
        (typeof navigator !== "undefined" && navigator.language) || "en";
    const candidates = [
        locale.replace("-", "_"),
        locale.split("-")[0],
        manifest.default_locale,
        "en",
    ].filter((value): value is string => Boolean(value));

    const seen = new Set<string>();
    for (const candidate of candidates) {
        const normalized = candidate.replace("-", "_");
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        try {
            return JSON.parse(
                await extensionsReadText(
                    extId,
                    `_locales/${normalized}/messages.json`,
                ),
            ) as ExtensionMessages;
        } catch {}
    }

    return {};
}

/**
 * Resolve the best available icon URL for an extension at a given preferred size.
 * Returns a /civil-ext/<id>/<path> URL served by the service worker.
 */
export function extensionsResolveIcon(
    extId: string,
    manifest: ChromeManifest | FirefoxManifest,
    preferredSize = 48,
): string | null {
    const m = manifest as unknown as Record<string, unknown>;
    const icons =
        (m.icons as Record<string, string> | string | undefined) ??
        (m.browser_action as Record<string, unknown> | undefined)
            ?.default_icon ??
        (m.action as Record<string, unknown> | undefined)?.default_icon;
    if (!icons) return null;
    if (typeof icons === "string") return `/civil-ext/${extId}/${icons}`;
    const iconsMap = icons as Record<string, string>;
    const sizes = Object.keys(iconsMap)
        .map(Number)
        .filter(n => !Number.isNaN(n))
        .toSorted((a, b) => a - b);
    if (sizes.length === 0) return null;
    const best = (
        sizes.find(s => s >= preferredSize) ?? sizes[sizes.length - 1]
    ).toString();
    const path = iconsMap[best];
    return path ? `/civil-ext/${extId}/${path}` : null;
}

/**
 * Resolve the popup HTML URL for an extension.
 * Returns a /civil-ext/<id>/<path> URL served by the service worker.
 */
export function extensionsResolvePopup(
    extId: string,
    manifest: ChromeManifest | FirefoxManifest,
): string | null {
    const m = manifest as unknown as Record<string, unknown>;
    const popup =
        (m.action as Record<string, unknown> | undefined)?.default_popup ??
        (m.browser_action as Record<string, unknown> | undefined)
            ?.default_popup ??
        null;
    return popup ? `/civil-ext/${extId}/${popup as string}` : null;
}

/**
 * Inject all enabled extensions' content scripts into a given iframe.
 */
export async function extensionsApplyToIframe(
    iframe: HTMLIFrameElement,
): Promise<void> {
    const enabled = loadIndex().filter(e => e.enabled);
    console.log(
        "[civil/extensions] extensionsApplyToIframe(): applying",
        enabled.length,
        "extensions",
    );
    for (const ext of enabled) {
        try {
            const manifestText = await extensionsReadText(
                ext.id,
                "manifest.json",
            );
            const manifest: ChromeManifest = JSON.parse(manifestText);
            for (const script of manifest.content_scripts ?? []) {
                const iframeDoc = iframe.contentDocument;
                if (!iframeDoc) continue;
                for (const cssPath of script.css ?? []) {
                    try {
                        const raw = await extensionsReadText(ext.id, cssPath);
                        const el = iframeDoc.createElement("style");
                        el.textContent = raw;
                        iframeDoc.head?.appendChild(el);
                    } catch (e) {
                        console.warn(
                            `[civil/extensions] CSS inject failed "${cssPath}":`,
                            e,
                        );
                    }
                }
                for (const jsPath of script.js ?? []) {
                    try {
                        const raw = await extensionsReadText(ext.id, jsPath);
                        const el = iframeDoc.createElement("script");
                        el.textContent = raw;
                        (iframeDoc.head ?? iframeDoc.body)?.appendChild(el);
                    } catch (e) {
                        console.warn(
                            `[civil/extensions] JS inject failed "${jsPath}":`,
                            e,
                        );
                    }
                }
            }
        } catch (e) {
            console.error(
                `[civil/extensions] Failed to apply ext "${ext.id}":`,
                e,
            );
        }
    }
}

export type { CivilExtension };

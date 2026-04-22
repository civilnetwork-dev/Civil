import { resolveExtIcon, resolveExtPopupUrl } from "@quartinal/extension-shim";
import { inflateSync } from "fflate";
import type { ChromeManifest, CivilExtension, FirefoxManifest } from "~/types";
import { getTFS } from "./fs";

const LS_KEY = "civil-extensions";

const CRX4_MAGIC = 0x34327243;
const CRX3_MAGIC = 0x33327243;
const ZIP_MAGIC = 0x04034b50;

function loadIndex(): Omit<CivilExtension, "files">[] {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (e) {
        console.error("[civil/extensions] loadIndex() parse failed:", e);
        return [];
    }
}

function saveIndex(exts: Omit<CivilExtension, "files">[]): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(exts));
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
    console.log(
        "[civil/extensions] CRX manifest:",
        manifest.name,
        "v" + manifest.version,
    );
    const id = crypto.randomUUID();
    const ext: Omit<CivilExtension, "files"> = {
        id,
        name: manifest.name,
        version: manifest.version,
        manifest,
        type: "crx",
        enabled: true,
    };
    await installToFS(id, files);
    saveIndex([...loadIndex(), ext]);
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
 * Read an extension file from TFS as a Uint8Array.
 */
export function extensionsReadFile(
    extId: string,
    filePath: string,
): Promise<Uint8Array> {
    return getTFS().then(
        tfs =>
            new Promise<Uint8Array>((resolve, reject) => {
                tfs.fs.readFile(
                    `/extensions/${extId}/${filePath}`,
                    "arraybuffer",
                    (err: Error | null, data: ArrayBuffer) => {
                        if (err) reject(err);
                        else resolve(new Uint8Array(data));
                    },
                );
            }),
    );
}

/**
 * Read an extension file from TFS as a UTF-8 string.
 */
export function extensionsReadText(
    extId: string,
    filePath: string,
): Promise<string> {
    return getTFS().then(
        tfs =>
            new Promise<string>((resolve, reject) => {
                tfs.fs.readFile(
                    `/extensions/${extId}/${filePath}`,
                    "utf8",
                    (err: Error | null, data: string) => {
                        if (err) reject(err);
                        else resolve(data);
                    },
                );
            }),
    );
}

/**
 * Resolve the best available icon URL for an extension at a given preferred size.
 * Delegates to @quartinal/extension-shim which returns a /civil-ext/<id>/<path> URL
 * served directly by the service worker.
 */
export function extensionsResolveIcon(
    extId: string,
    manifest: ChromeManifest | FirefoxManifest,
    preferredSize = 48,
): string | null {
    return resolveExtIcon(extId, manifest as any, preferredSize);
}

/**
 * Resolve the popup HTML URL for an extension.
 * Delegates to @quartinal/extension-shim which returns a /civil-ext/<id>/<path> URL.
 */
export function extensionsResolvePopup(
    extId: string,
    manifest: ChromeManifest | FirefoxManifest,
): string | null {
    return resolveExtPopupUrl(extId, manifest as any);
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

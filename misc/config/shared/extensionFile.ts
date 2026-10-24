/**
 * An installed extension's file, read straight from OPFS, where
 * src/api/extensions.ts unpacks each extension under `extensions/<id>/`.
 * Rejects when the file, or any directory on its path, is missing.
 */
export async function getExtensionFile(
    extId: string,
    path: string,
): Promise<File> {
    const parts = `extensions/${extId}/${path}`.split("/").filter(Boolean);
    let dir = await navigator.storage.getDirectory();
    for (const part of parts.slice(0, -1)) {
        dir = await dir.getDirectoryHandle(part);
    }
    const handle = await dir.getFileHandle(parts[parts.length - 1]!);
    return handle.getFile();
}

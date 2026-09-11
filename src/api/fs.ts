import { TFS } from "@terbiumos/tfs/browser";

let _ready: Promise<TFS> | null = null;

const STORE_FILE = ".TFS_STORE";

// Default contents of the .TFS_STORE metadata file, matching what the
// @terbiumos/tfs FS constructor seeds when the file is absent.
const DEFAULT_STORE = {
    "/.TFS_STORE": { perms: ["r"], uid: 0, gid: 0 },
};

/**
 * Seed the .TFS_STORE metadata file before any TFS operation runs.
 *
 * The @terbiumos/tfs FS constructor seeds this file in a promise nothing
 * awaits, so the first reads and writes on the /extensions page can land on the
 * OPFS handle while that seed is still in flight. That surfaces as an unhandled
 * NotReadableError, or a JSON parse error on a zero-byte store. Writing a valid
 * store here first, and closing the writable, means the constructor finds the
 * file already present and only reads it. A store that exists but is empty or
 * corrupt is repaired.
 */
async function seedStore(root: FileSystemDirectoryHandle): Promise<void> {
    const handle = await root.getFileHandle(STORE_FILE, { create: true });
    const file = await handle.getFile();
    if (file.size > 0) {
        try {
            JSON.parse(await file.text());
            return;
        } catch {
            // Rewrite a truncated or corrupt store.
        }
    }
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(DEFAULT_STORE, null, 2));
    await writable.close();
}

async function initTFS(): Promise<TFS> {
    if (typeof TFS !== "function") {
        const mod = await import("@terbiumos/tfs/browser");
        console.error(
            "[civil/fs] FS is not a constructor! Got:",
            typeof TFS,
            TFS,
            "Full module keys:",
            Object.keys(mod),
        );
        throw new Error(
            `[civil/fs] FS is not a constructor. Module keys: ${Object.keys(mod).join(", ")}`,
        );
    }

    let root: FileSystemDirectoryHandle;
    try {
        root = await navigator.storage.getDirectory();
    } catch (e) {
        console.error("[civil/fs] navigator.storage.getDirectory() failed:", e);
        throw e;
    }

    await seedStore(root);

    const tfs = new TFS(root);
    // Hand out the instance only once the store reads back, so no caller races
    // the constructor's own metadata read.
    await tfs.fs.promises.readFile(STORE_FILE, "utf8");
    return tfs;
}

/**
 * Return the shared TFS instance, seeded and ready.
 *
 * Access is gated behind a single init promise: concurrent callers all await
 * the same ready instance, and none proceed before the .TFS_STORE seed
 * settles. A failed init is not cached, so a later call retries.
 */
export function getTFS(): Promise<TFS> {
    if (!_ready) {
        _ready = initTFS().catch(e => {
            _ready = null;
            throw e;
        });
    }
    return _ready;
}

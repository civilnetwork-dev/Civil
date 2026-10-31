import { TFS } from "@terbiumos/tfs/browser";

let _ready: Promise<TFS> | null = null;

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

    // 1.1.0-dev.1 seeded its .TFS_STORE metadata in a promise nothing awaited,
    // so this module wrote the store itself first. 1.1 queues the metadata
    // load (now .TSD, migrating and deleting any .TFS_STORE) behind `ready`.
    const tfs = new TFS(root);
    await tfs.ready;
    return tfs;
}

/**
 * Return the shared TFS instance, ready.
 *
 * Access is gated behind a single init promise: concurrent callers all await
 * the same ready instance, and none proceed before TFS's metadata loads. A
 * failed init is not cached, so a later call retries.
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

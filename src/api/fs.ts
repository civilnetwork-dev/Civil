import { TFS } from "@terbiumos/tfs/browser";

let _ready: Promise<TFS> | null = null;

/**
 * Resolve once the TFS permission store (`.TFS_STORE`) holds valid JSON.
 *
 * The FS constructor seeds that file in a fire-and-forget promise that nothing
 * awaits. On a fresh OPFS profile the first mkdir/writeFile can therefore race
 * the seeding write and read a zero-byte store. Gate the instance behind the
 * seed so the first write never sees an empty store.
 */
async function waitForStore(tfs: TFS): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
        try {
            const raw = await tfs.fs.promises.readFile(".TFS_STORE", "utf8");
            if (raw && raw.trim()) {
                JSON.parse(raw);
                return;
            }
        } catch {
            // Store not created yet, or a write is in flight; retry shortly.
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    console.warn("[civil/fs] .TFS_STORE not ready after wait; continuing");
}

async function initTFS(): Promise<TFS> {
    console.log("[civil/fs] Importing @terbiumos/tfs...", { TFS });

    if (typeof TFS !== "function") {
        const mod = await import("@terbiumos/tfs/browser");
        console.log("[civil/fs] Full module dump:", mod);
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
        console.log("[civil/fs] Got OPFS root handle:", root);
    } catch (e) {
        console.error("[civil/fs] navigator.storage.getDirectory() failed:", e);
        throw e;
    }

    let instance: TFS;
    try {
        instance = new TFS(root);
        console.log("[civil/fs] FS instance created:", instance);
    } catch (e) {
        console.error("[civil/fs] new FS(root) threw:", e);
        throw e;
    }

    // Wait for the permission store to be seeded so the first write can't race it.
    await waitForStore(instance);
    return instance;
}

export function getTFS(): Promise<TFS> {
    if (!_ready) {
        _ready = initTFS().catch(e => {
            // Drop the cached failure so a later call can retry.
            _ready = null;
            throw e;
        });
    }
    return _ready;
}

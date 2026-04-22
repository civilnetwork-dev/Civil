import { TFS } from "@terbiumos/tfs/browser";

let _instance: TFS | null = null;

export async function getTFS(): Promise<TFS> {
    if (_instance) return _instance;

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

    try {
        _instance = new TFS(root);
        console.log("[civil/fs] FS instance created:", _instance);
        return _instance;
    } catch (e) {
        console.error("[civil/fs] new FS(root) threw:", e);
        throw e;
    }
}

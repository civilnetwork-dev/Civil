import { afterEach, describe, expect, it, vi } from "vitest";

const notFound = () =>
    Object.assign(new Error("not found"), { name: "NotFoundError" });

/**
 * Minimal in-memory OPFS root, enough for TFS's metadata load: it reads the
 * .TSD and legacy .TFS_STORE files, writes .TSD as bytes, and removes the
 * legacy store once migrated.
 */
function createFakeOPFS(seed?: Record<string, string>) {
    const encoder = new TextEncoder();
    const files = new Map<string, Uint8Array>(
        Object.entries(seed ?? {}).map(([name, text]) => [
            name,
            encoder.encode(text),
        ]),
    );
    const root = {
        kind: "directory" as const,
        async getFileHandle(name: string, opts?: { create?: boolean }) {
            if (!files.has(name)) {
                if (!opts?.create) throw notFound();
                files.set(name, new Uint8Array());
            }
            return {
                kind: "file" as const,
                name,
                async getFile() {
                    const bytes = files.get(name)!;
                    return new File([bytes.slice()], name);
                },
                async createWritable() {
                    const parts: Uint8Array<ArrayBuffer>[] = [];
                    return {
                        async write(data: string | ArrayBuffer) {
                            parts.push(
                                typeof data === "string"
                                    ? encoder.encode(data)
                                    : new Uint8Array(data),
                            );
                        },
                        async close() {
                            files.set(
                                name,
                                new Uint8Array(
                                    await new Blob(parts).arrayBuffer(),
                                ),
                            );
                        },
                    };
                },
            };
        },
        async removeEntry(name: string) {
            if (!files.delete(name)) throw notFound();
        },
    };
    return { root, files };
}

async function loadGetTFS(getDirectory: () => Promise<unknown>) {
    vi.stubGlobal("navigator", { storage: { getDirectory } });
    vi.resetModules();
    return (await import("~/api/fs")).getTFS;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("getTFS", () => {
    it("opens a fresh root and writes TFS's .TSD metadata", async () => {
        const { root, files } = createFakeOPFS();
        const getTFS = await loadGetTFS(async () => root);

        await getTFS();

        expect(files.get(".TSD")?.byteLength).toBeGreaterThan(0);
    });

    // A store an earlier build seeded: real OPFS removes it on migration, so
    // nothing may read .TFS_STORE after the instance is handed out.
    it("migrates a legacy .TFS_STORE, even an empty one, and removes it", async () => {
        for (const legacy of ['{"/extensions/foo":{"perms":["a"]}}', ""]) {
            const { root, files } = createFakeOPFS({ ".TFS_STORE": legacy });
            const getTFS = await loadGetTFS(async () => root);

            await getTFS();

            expect(files.has(".TFS_STORE")).toBe(false);
            expect(files.has(".TSD")).toBe(true);
        }
    });

    it("returns the same instance for concurrent callers", async () => {
        const { root } = createFakeOPFS();
        const getTFS = await loadGetTFS(async () => root);

        const [a, b] = await Promise.all([getTFS(), getTFS()]);
        expect(a).toBe(b);
    });

    it("retries after a failed init", async () => {
        const { root } = createFakeOPFS();
        const getDirectory = vi
            .fn()
            .mockRejectedValueOnce(new Error("no OPFS"))
            .mockResolvedValue(root);
        vi.spyOn(console, "error").mockImplementation(() => {});
        const getTFS = await loadGetTFS(getDirectory);

        await expect(getTFS()).rejects.toThrow("no OPFS");
        await expect(getTFS()).resolves.toBeDefined();
    });
});

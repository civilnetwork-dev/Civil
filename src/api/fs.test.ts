import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Minimal in-memory OPFS root, enough for the .TFS_STORE seeding path: the
 * @terbiumos/tfs FS constructor and this module both reach for a file handle,
 * read it, and write it through a writable stream.
 */
function createFakeOPFS(seed?: Record<string, string>) {
    const files = new Map<string, { content: string }>(
        Object.entries(seed ?? {}).map(([name, content]) => [
            name,
            { content },
        ]),
    );
    const root = {
        kind: "directory" as const,
        async getFileHandle(name: string, opts?: { create?: boolean }) {
            if (!files.has(name)) {
                if (!opts?.create) {
                    throw Object.assign(new Error("not found"), {
                        name: "NotFoundError",
                    });
                }
                files.set(name, { content: "" });
            }
            const rec = files.get(name)!;
            return {
                kind: "file" as const,
                name,
                async getFile() {
                    return {
                        name,
                        size: rec.content.length,
                        type: "",
                        lastModified: 0,
                        async text() {
                            return rec.content;
                        },
                        async arrayBuffer() {
                            return new TextEncoder().encode(rec.content).buffer;
                        },
                    };
                },
                async createWritable() {
                    let buf = "";
                    return {
                        async write(data: unknown) {
                            buf +=
                                typeof data === "string"
                                    ? data
                                    : new TextDecoder().decode(
                                          data as ArrayBuffer,
                                      );
                        },
                        async close() {
                            rec.content = buf;
                        },
                    };
                },
            };
        },
    };
    return { root, files };
}

async function loadGetTFS(root: unknown) {
    vi.stubGlobal("navigator", { storage: { getDirectory: async () => root } });
    vi.resetModules();
    return (await import("~/api/fs")).getTFS;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("getTFS", () => {
    it("seeds a valid .TFS_STORE before handing out the instance", async () => {
        const { root, files } = createFakeOPFS();
        const getTFS = await loadGetTFS(root);

        const tfs = await getTFS();

        // The gate resolves only after the store is written and readable.
        const store = files.get(".TFS_STORE");
        expect(store).toBeDefined();
        expect(() => JSON.parse(store!.content)).not.toThrow();
        const read = await tfs.fs.promises.readFile(".TFS_STORE", "utf8");
        expect(JSON.parse(read)).toHaveProperty("/.TFS_STORE");
    });

    it("returns the same instance for concurrent callers", async () => {
        const { root } = createFakeOPFS();
        const getTFS = await loadGetTFS(root);

        const [a, b] = await Promise.all([getTFS(), getTFS()]);
        expect(a).toBe(b);
    });

    it("repairs an empty .TFS_STORE", async () => {
        const { root, files } = createFakeOPFS({ ".TFS_STORE": "" });
        const getTFS = await loadGetTFS(root);

        await getTFS();

        expect(() =>
            JSON.parse(files.get(".TFS_STORE")!.content),
        ).not.toThrow();
    });

    it("repairs a corrupt .TFS_STORE", async () => {
        const { root, files } = createFakeOPFS({ ".TFS_STORE": "{ not json" });
        const getTFS = await loadGetTFS(root);

        await getTFS();

        expect(JSON.parse(files.get(".TFS_STORE")!.content)).toHaveProperty(
            "/.TFS_STORE",
        );
    });

    it("preserves an existing valid .TFS_STORE", async () => {
        const existing = JSON.stringify({
            "/extensions/foo": { perms: ["a"] },
        });
        const { root, files } = createFakeOPFS({ ".TFS_STORE": existing });
        const getTFS = await loadGetTFS(root);

        await getTFS();

        expect(files.get(".TFS_STORE")!.content).toBe(existing);
    });
});

import { join } from "node:path";

import { expect, it } from "vitest";

import { loadExtension } from "./host";

it("executes only packaged scripts appended by the MV2 background", async () => {
    const ext = await loadExtension({
        dir: join(import.meta.dirname, "fixtures", "dynamic-script"),
    });
    try {
        expect((await ext.sendMessage("results")).response).toEqual([
            "load",
            "error",
            "error",
            "error",
            "error",
        ]);
        expect(ext.getStorage()).toEqual({ chunkRan: true });
    } finally {
        ext.dispose();
    }
}, 15_000);

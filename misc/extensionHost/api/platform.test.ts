import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { buildFetch } from "./platform";

/**
 * An extension's `fetch` serves its own packaged files from disk and nothing
 * outside its directory. The sibling case is the one a bare prefix check
 * missed: `ext-evil` starts with `ext`.
 */
describe("buildFetch", () => {
    const root = mkdtempSync(join(tmpdir(), "civil-ext-"));
    const extDir = join(root, "ext");
    mkdirSync(extDir);
    mkdirSync(join(root, "ext-evil"));
    writeFileSync(join(extDir, "rules.json"), '{"ok":true}');
    writeFileSync(join(root, "ext-evil", "secret.txt"), "secret");
    writeFileSync(join(root, "outside.txt"), "outside");

    const fetch = buildFetch("abc", extDir, undefined);

    afterAll(() => rmSync(root, { recursive: true, force: true }));

    it("serves a packaged file with its content type", async () => {
        const res = await fetch("chrome-extension://abc/rules.json?v=1");
        expect(res.status).toBe(200);
        expect(res.headers.get("content-type")).toBe("application/json");
        expect(await res.text()).toBe('{"ok":true}');
    });

    it("refuses paths that climb out of the extension directory", async () => {
        for (const path of ["../outside.txt", "../ext-evil/secret.txt"]) {
            const res = await fetch(`chrome-extension://abc/${path}`);
            expect(res.status, path).toBe(503);
            expect(await res.text(), path).not.toContain("secret");
        }
    });

    it("answers a missing packaged file with 404", async () => {
        const res = await fetch("chrome-extension://abc/missing.js");
        expect(res.status).toBe(404);
    });
});

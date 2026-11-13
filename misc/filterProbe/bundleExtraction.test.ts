import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { strToU8, zipSync } from "fflate";
import { afterEach, expect, it } from "vitest";

import { unpackPackage } from "./downloadBundles";

const entry = { folder: "test", id: "test", updateUrl: "https://example.com" };
const directories: string[] = [];
function destination() {
    const path = mkdtempSync(join(tmpdir(), "civil-bundle-"));
    directories.push(path);
    return path;
}

afterEach(() => {
    for (const path of directories.splice(0)) rmSync(path, { recursive: true });
});

it("extracts legacy ZIP files with a valid manifest", () => {
    const path = destination();
    unpackPackage(
        zipSync({
            "manifest.json": strToU8(
                '{"manifest_version":3,"name":"test","version":"1"}',
            ),
            "nested/worker.js": strToU8("test"),
        }),
        entry,
        path,
    );
    expect(readFileSync(join(path, "nested/worker.js"), "utf8")).toBe("test");
    expect(existsSync(join(path, "manifest.json"))).toBe(true);
});

const badManifests = ["", "null", "[]", "{malformed"];
it.each(badManifests)("does not cache invalid manifest %s", manifest => {
    const path = destination();
    expect(() =>
        unpackPackage(
            zipSync({
                "manifest.json": strToU8(manifest),
            }),
            entry,
            path,
        ),
    ).toThrow();
    expect(existsSync(join(path, "manifest.json"))).toBe(false);
});

const escapedPaths = ["../outside.js", "..\\outside.js", "C:/outside.js"];
it.each(escapedPaths)(
    "rejects escaping path %s before writing the cache marker",
    file => {
        const path = destination();
        expect(() =>
            unpackPackage(
                zipSync({
                    "manifest.json": strToU8("{}"),
                    [file]: strToU8("test"),
                }),
                entry,
                path,
            ),
        ).toThrow("escapes");
        expect(existsSync(join(path, "manifest.json"))).toBe(false);
    },
);

it("requires signed bytes for newly catalogued extensions", () => {
    const path = destination();
    expect(() =>
        unpackPackage(
            zipSync({
                "manifest.json": strToU8("{}"),
            }),
            { ...entry, source: "crx" },
            path,
        ),
    ).toThrow("signed CRX");
});

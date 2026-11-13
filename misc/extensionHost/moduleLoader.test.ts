import { join, resolve } from "node:path";
import * as vm from "node:vm";

import { expect, it } from "vitest";

import { compileScript } from "./host";
import { resolveSpecifier } from "./moduleLoader";

const root = join(import.meta.dirname, "fixtures", "root-imports");
const entry = join(root, "nested", "worker.js");
const packaged = [
    ["/value.js", "value.js"],
    ["../value.js", "value.js"],
    ["chrome-extension://test/value.js?query=1", "value.js"],
] as const;

it.each(packaged)("resolves packaged import %s", (specifier, file) => {
    expect(resolveSpecifier(specifier, entry, "test", root)).toBe(
        join(root, file),
    );
});

const rejected = [
    "../../outside.js",
    "../..%2foutside.js",
    "//foreign/value.js",
    "chrome-extension://other/value.js",
    "chrome-extension://test/../root-imports-sibling/secret.js",
    "chrome-extension://test/%2e%2e%2froot-imports-sibling/secret.js",
];

it.each(rejected)("keeps import %s inside the extension", specifier => {
    expect(resolveSpecifier(specifier, entry, "test", root)).toBeUndefined();
});

it("bundles root-relative imports from a nested worker", async () => {
    const context = vm.createContext({});
    const script = await compileScript(
        'import { value } from "/value.js"; globalThis.result = value;',
        entry,
        {
            context,
            extensionId: "test",
            extensionDir: resolve(root),
        },
    );
    script.runInContext(context);
    expect(context.result).toBe(42);
});

it("rejects a static import escaping the extension", async () => {
    await expect(
        compileScript(
            'import "../../outside.js";',
            join(root, "nested", "escape.js"),
            {
                context: vm.createContext({}),
                extensionId: "test",
                extensionDir: resolve(root),
            },
        ),
    ).rejects.toThrow("outside this extension");
});

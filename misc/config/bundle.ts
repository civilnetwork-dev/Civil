import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";

import { createColors } from "picocolors";
import { type OutputOptions, rolldown } from "rolldown";
import { visualizer } from "rollup-plugin-visualizer";

const { green } = createColors();

const useVisualizer = process.argv.includes("--visualize");

// Absolute, because Bun's fs.promises.rm on Windows rejects a relative path
// that climbs out with `..` (EINVAL, Bun 1.4.4).
const outDir = resolve(import.meta.dirname, "../../dist-config");

await rm(outDir, { recursive: true, force: true });

// Rolldown strips TypeScript syntax, resolves node_modules (browser fields and
// conditions) and converts CommonJS on its own; type checking stays `tsc`'s
// job. What the Rollup pipeline needed four plugins for is now just options.
const minified: OutputOptions = {
    minify: {
        compress: { target: "es2020" },
        mangle: { toplevel: true },
    },
    charset: "ascii",
};

// Every bundle is an IIFE except the bare-mux transport, which bare-mux
// imports as an ES module.
async function bundle(input: string, output: OutputOptions) {
    const build = await rolldown({
        input,
        platform: "browser",
        resolve: { alias: { $config: import.meta.dirname } },
        treeshake: {
            propertyReadSideEffects: false,
            unknownGlobalSideEffects: false,
        },
        plugins:
            useVisualizer && output.name
                ? [
                      visualizer({
                          filename: join(outDir, "stats", `${output.name}.html`),
                          open: false,
                      }),
                  ]
                : [],
    });
    const { output: chunks } = await build.write({
        dir: outDir,
        format: "iife",
        // Rollup's default, which Rolldown leaves to the source: the IIFE
        // keeps the strict semantics its ES modules were written for.
        strict: true,
        ...output,
    });
    await build.close();
    for (const chunk of chunks) console.log(green(chunk.fileName));
}

await bundle("./scramjet/scramjetInit.ts", {
    ...minified,
    name: "scramjet_init",
    entryFileNames: "scramjet_init.js",
});

await bundle("./service/sw.ts", {
    ...minified,
    name: "sw",
    entryFileNames: "sw.js",
});

// Left unminified, as it always shipped.
await bundle("./baremux/transport.ts", {
    dir: join(outDir, "baremux-transport"),
    format: "es",
    entryFileNames: "index.mjs",
});

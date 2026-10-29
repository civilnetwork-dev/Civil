import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { createColors } from "picocolors";
import { rimraf } from "rimraf";
import { rollup } from "rollup";
import { transformSync } from "oxc-transform";
import nodePolyfills from "rollup-plugin-polyfill-node";
import { visualizer } from "rollup-plugin-visualizer";

const { green } = createColors();

const useVisualizer = process.argv.includes("--visualize");

await rimraf("../../dist-config");

// Strips TypeScript syntax only; type checking is `tsc`'s job. This replaced
// rollup-plugin-typescript2, which drives TypeScript's JS API - an API
// TypeScript 7 no longer ships.
const stripTypes = {
    name: "strip-types",
    transform(code, id) {
        if (!/\.[cm]?tsx?$/.test(id)) return null;
        const result = transformSync(id, code, { sourcemap: true });
        if (result.errors.length)
            this.error(
                result.errors.map(e => e.codeframe ?? e.message).join("\n"),
            );
        return { code: result.code, map: result.map };
    },
};

// Extensionless imports (`$config/shared/xorCodec`) name .ts files, which
// rollup's resolver only finds when told to look for them.
const extensions = [".mjs", ".js", ".json", ".node", ".ts"];

const basePlugins = [
    alias({
        entries: [{ find: "$config", replacement: import.meta.dirname }],
    }),
    stripTypes,
    nodeResolve({ browser: true, extensions }),
    commonjs(),
    terser({
        compress: {
            ecma: 2020,
            passes: 4,
            unsafe: true,
            unsafe_arrows: true,
            unsafe_comps: true,
            unsafe_proto: true,
            unsafe_regexp: true,
            unsafe_undefined: true,
            pure_getters: true,
            inline: 3,
            evaluate: true,
            dead_code: true,
            drop_debugger: true,
            negate_iife: false,
            sequences: true,
            conditionals: true,
            comparisons: true,
            if_return: true,
            join_vars: true,
            collapse_vars: true,
            reduce_vars: true,
            hoist_funs: true,
            loops: true,
            switches: true,
            typeofs: true,
        },
        mangle: {
            toplevel: true,
            safari10: true,
        },
        format: {
            comments: false,
            ascii_only: true,
        },
    }),
];

// Every bundle is an IIFE except the bare-mux transport, which bare-mux
// imports as an ES module.
async function bundle(input, plugins, output) {
    const build = await rollup({
        input,
        treeshake: {
            propertyReadSideEffects: false,
            unknownGlobalSideEffects: false,
        },
        plugins: [
            ...plugins,
            ...(useVisualizer && output.name
                ? [
                      visualizer({
                          filename: `../../dist-config/stats/${output.name}.html`,
                          open: false,
                      }),
                  ]
                : []),
        ],
    });
    const { output: chunks } = await build.write({
        dir: "../../dist-config",
        format: "iife",
        compact: true,
        generatedCode: { arrowFunctions: true, constBindings: true },
        ...output,
    });
    await build.close();
    for (const chunk of chunks) console.log(green(chunk.fileName));
}

await bundle(
    "./scramjet/scramjetInit.ts",
    [...basePlugins.slice(0, 2), nodePolyfills(), ...basePlugins.slice(2)],
    { name: "scramjet_init", entryFileNames: "scramjet_init.js" },
);

await bundle("./service/sw.ts", basePlugins, {
    name: "sw",
    entryFileNames: "sw.js",
});

// Left unminified, as it always shipped.
await bundle("./baremux/transport.ts", basePlugins.slice(0, 4), {
    dir: "../../dist-config/baremux-transport",
    format: "es",
    entryFileNames: "index.mjs",
});

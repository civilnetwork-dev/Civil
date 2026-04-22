import { copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, resolve } from "node:path";
import alias from "@rollup/plugin-alias";
import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import { createColors } from "picocolors";
import { rimraf } from "rimraf";
import { rollup } from "rollup";
import nodePolyfills from "rollup-plugin-polyfill-node";
import typescript from "rollup-plugin-typescript2";
import { visualizer } from "rollup-plugin-visualizer";

const require = createRequire(import.meta.url);
const { globSync: fastGlobSync } = require("fast-glob");

const configFiles = fastGlobSync(["./**/*.config.ts", "./**/*.config.js"]);

const { green } = createColors();

const useVisualizer = process.argv.includes("--visualize");

await rimraf("../../dist");

const basePlugins = [
    alias({
        entries: [
            {
                find: "$wasm",
                replacement: resolve(
                    import.meta.dirname,
                    "../../config/encoder",
                ),
            },
            { find: "$config", replacement: import.meta.dirname },
        ],
    }),
    typescript({
        tsconfig: "../../tsconfig.json",
        tsconfigOverride: {
            compilerOptions: {
                allowImportingTsExtensions: false,
                rootDir: "../../",
            },
            exclude: [
                "config",
                "tests",
                "server.ts",
                "src",
                "misc/apps",
                "*.config.ts",
            ],
        },
    }),
    nodeResolve({ browser: true }),
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
            reserved: ["__wasmDencode", "document"],
        },
        format: {
            comments: false,
            ascii_only: true,
        },
    }),
];

const externalWasmDencode = {
    name: "external-wasm-dencode",
    resolveId(source) {
        if (source === "$config/shared/wasmDencode") {
            return { id: "__wasmDencode", external: true };
        }
        return null;
    },
};

const swPlugins = [externalWasmDencode, ...basePlugins];

const plugins = [
    externalWasmDencode,
    ...basePlugins.slice(0, 1),
    basePlugins[1],
    nodePolyfills(),
    basePlugins[2],
    basePlugins[3],
    basePlugins[4],
];

const configInput = Object.fromEntries(
    configFiles.map(file => {
        const base = basename(file).replace(/\.(config)\.(ts|js)$/, "");
        return [`${base}_config`, file];
    }),
);

const otherInput = {
    ...configInput,
    scramjet_init: "./scramjet/scramjetInit.ts",
};

const wasmDencodeBundle = await rollup({
    input: "./shared/wasmDencode.ts",
    treeshake: {
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
    },
    plugins: [
        ...basePlugins,
        ...(useVisualizer
            ? [
                  visualizer({
                      filename: "../../dist/stats/wasm_dencode.html",
                      open: false,
                  }),
              ]
            : []),
    ],
});

const { output: wdOutput } = await wasmDencodeBundle.write({
    dir: "../../dist",
    format: "iife",
    entryFileNames: "wasm_dencode.js",
    name: "__wasmDencode",
    compact: true,
    generatedCode: { arrowFunctions: true, constBindings: true },
});

await wasmDencodeBundle.close();

for (const chunk of wdOutput) {
    console.log(green(chunk.fileName));
}

for (const [name, file] of Object.entries(otherInput)) {
    const bundle = await rollup({
        input: file,
        treeshake: {
            propertyReadSideEffects: false,
            unknownGlobalSideEffects: false,
        },
        plugins: [
            ...plugins,
            ...(useVisualizer
                ? [
                      visualizer({
                          filename: `../../dist/stats/${name}.html`,
                          open: false,
                      }),
                  ]
                : []),
        ],
    });

    const { output } = await bundle.write({
        dir: "../../dist",
        format: "iife",
        entryFileNames: `${name}.js`,
        name,
        globals: { __wasmDencode: "__wasmDencode" },
        compact: true,
        generatedCode: { arrowFunctions: true, constBindings: true },
    });

    await bundle.close();

    for (const chunk of output) {
        console.log(green(chunk.fileName));
    }
}

const swBundle = await rollup({
    input: "./service/sw.ts",
    treeshake: {
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
    },
    plugins: [
        ...swPlugins,
        ...(useVisualizer
            ? [
                  visualizer({
                      filename: "../../dist/stats/sw.html",
                      open: false,
                  }),
              ]
            : []),
    ],
});

const { output: swOutput } = await swBundle.write({
    dir: "../../dist",
    format: "iife",
    entryFileNames: "sw.js",
    name: "sw",
    globals: { __wasmDencode: "__wasmDencode" },
    banner: 'var document={baseURI:self.location.origin};importScripts("/wasm_dencode.js");',
    compact: true,
    generatedCode: { arrowFunctions: true, constBindings: true },
});

await swBundle.close();

for (const chunk of swOutput) {
    console.log(green(chunk.fileName));
}

await copyFile(
    "../../config/encoder/xor_encoder.wasm",
    "../../dist/xor_encoder.wasm",
);

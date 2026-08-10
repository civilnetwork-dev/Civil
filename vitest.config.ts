import { resolve } from "node:path";
import solid from "vite-plugin-solid";
import { defineConfig } from "vitest/config";

/**
 * Deliberately does NOT reuse vite.config.ts.
 *
 * That config runs the TanStack Router codegen, SolidStart, Nitro, and Biome
 * with `failOnError`, none of which a unit test run needs — and Nitro would try
 * to build a server bundle. Only vite-plugin-solid is shared, because compiling
 * Solid JSX is the one thing component tests genuinely require.
 */
export default defineConfig({
    plugins: [solid()],
    resolve: {
        conditions: ["solid", "browser"],
        alias: {
            "~": resolve(import.meta.dirname, "src"),
            $config: resolve(import.meta.dirname, "misc/config"),
            $tests: resolve(import.meta.dirname, "tests"),
            $wasm: resolve(import.meta.dirname, "config/encoder"),
            "solid-js/web": "@solidjs/web",
            "solid-js/store": "solid-js",
        },
    },
    test: {
        environment: "node",
        include: [
            "tests/**/*.test.ts",
            "tests/**/*.test.tsx",
            "misc/**/*.test.ts",
            "src/**/*.test.ts",
            "src/**/*.test.tsx",
        ],
        setupFiles: ["./tests/setup.ts"],
    },
});

import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "~": resolve(import.meta.dirname, "src"),
            $config: resolve(import.meta.dirname, "misc/config"),
            $tests: resolve(import.meta.dirname, "tests"),
            $wasm: resolve(import.meta.dirname, "config/encoder"),
        },
    },
    test: {
        environment: "node",
        include: [
            "tests/**/*.test.ts",
            "misc/**/*.test.ts",
            "src/**/*.test.ts",
        ],
        setupFiles: ["./tests/setup.ts"],
    },
});

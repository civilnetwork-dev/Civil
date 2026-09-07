import { defineConfig } from "oxfmt";

/**
 * Ported from biome.json's formatter block, plus the import sorting biome ran
 * as its `organizeImports` assist action.
 */
export default defineConfig({
    printWidth: 80,
    useTabs: false,
    tabWidth: 4,
    endOfLine: "lf",
    arrowParens: "avoid",
    sortImports: {},
    ignorePatterns: [
        // biome only formatted JS/TS/JSON here; markdown prose and the compose
        // file are hand-laid-out and stay that way.
        "**/*.md",
        "**/*.yml",
        "**/*.yaml",
        "dist",
        "dist-config",
        "data",
        "config",
        "misc/apps/anura",
        "misc/obfuscatti",
        "misc/wisp/native/index.*",
        "src/routeTree.gen.ts",
        "public/assets/civil-wordmark.svg",
    ],
});

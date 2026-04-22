import terser from "@rollup/plugin-terser";
import { defineConfig } from "@solidjs/start/config";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { vanillaExtractPlugin as vanillaExtract } from "@vanilla-extract/vite-plugin";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import nodePolyfills from "rollup-plugin-polyfill-node";
import biome from "vite-plugin-biome";
import { BLOCK_AI_ALLOW_REST, robots } from "vite-plugin-robots-ts";
import { sitemapPlugin as sitemap } from "vite-plugin-sitemap-from-routes";
import tsconfigPaths from "vite-tsconfig-paths";

const cssTargets = browserslistToTargets(
    browserslist("last 2 years, > 0.5%, not dead"),
);

const terserOptions: Parameters<typeof terser>[0] = {
    compress: {
        passes: 3,
        unsafe: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_methods: true,
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
};

export default defineConfig({
    vite: {
        build: {
            minify: false,
            cssMinify: "lightningcss",
            rollupOptions: {
                plugins: [terser(terserOptions)],
                output: {
                    manualChunks(id: string) {
                        if (
                            id.includes("/echarts/") ||
                            id.includes("/zrender/")
                        )
                            return "vendor-echarts";
                    },
                },
            },
        },
        css: {
            transformer: "lightningcss",
            lightningcss: {
                targets: cssTargets,
                drafts: { customMedia: true },
                minify: true,
            },
        },
        plugins: [
            tanstackRouter({ target: "solid" }),
            tsconfigPaths(),
            vanillaExtract(),
            biome({
                mode: "check",
                files: ".",
                applyFixes: true,
                failOnError: true,
                unsafe: false,
            }),
            sitemap({
                baseUrl: "https://civil.quartinal.me",
                routesFile: "src/routeTree.gen.ts",
            }),
            robots({
                content: BLOCK_AI_ALLOW_REST.replace(
                    /\n?User-agent:\s*ClaudeBot\s*\nDisallow:\s*\/\s*\n?/g,
                    "\n",
                ),
                sitemap: "https://civil.quartinal.me/sitemap.xml",
            }),
            nodePolyfills(),
        ],
    },
    server: {
        preset: "node",
    },
});

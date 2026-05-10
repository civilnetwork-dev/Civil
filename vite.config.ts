import solidOxc from "@oxc-solid-js/vite";
import devtoolsJson from "@silvenon/vite-plugin-devtools-json";
import { solidStart } from "@solidjs/start/config";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { vanillaExtractPlugin as vanillaExtract } from "@vanilla-extract/vite-plugin";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import biome from "vite-plugin-biome";
import { BLOCK_AI_ALLOW_REST, robots } from "vite-plugin-robots-ts";
import { sitemapPlugin as sitemap } from "vite-plugin-sitemap-from-routes";

const cssTargets = browserslistToTargets(
    browserslist("last 2 years, > 0.5%, not dead"),
);

export default defineConfig(() => {
    return {
        resolve: {
            dedupe: [
                "solid-js",
                "@solidjs/web",
                "@solidjs/router",
                "@solidjs/signals",
                "@solidjs/meta",
            ],
            alias: {
                "solid-js/web": "@solidjs/web",
                "solid-js/web/storage": "@solidjs/web/storage",
            },
            tsconfigPaths: true,
        },
        environments: {
            client: {
                resolve: {
                    externalConditions: ["browser"],
                },
            },
            ssr: {
                resolve: {
                    conditions: ["solid", "node"],
                    externalConditions: ["solid", "node"],
                },
            },
        },
        build: {
            cssMinify: "lightningcss" as const,
            rolldownOptions: {
                output: {
                    minify: {
                        compress: {
                            dropDebugger: true,
                            dropConsole: false,
                            unused: true,
                            sequences: true,
                            joinVars: true,
                        },
                        mangle: {
                            toplevel: true,
                        },
                    },
                },
            },
            sourcemap: "hidden" as const,
        },
        css: {
            transformer: "lightningcss" as const,
            lightningcss: {
                targets: cssTargets,
                drafts: { customMedia: true },
                minify: true,
            },
        },
        plugins: [
            tanstackRouter({ target: "solid" }),
            solidOxc(),
            solidStart({
                middleware: "./src/middleware.ts",
            }),
            nitro({
                preset: "node",
                exportConditions: ["solid"],
                output: {
                    dir: "dist",
                    serverDir: "dist/server",
                    publicDir: "dist/client",
                },
                buildDir: "dist/nitro",
            }),
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
            devtoolsJson(),
        ],
    };
});

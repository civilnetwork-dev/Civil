import { execFileSync } from "node:child_process";
import { globSync as glob, statSync as stat } from "node:fs";
import { basename, resolve } from "node:path";
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
import { sitemap } from "vite-plugin-sitemap-ts";
import { obfuscateAssets } from "./misc/vite/obfuscateAssets";

const cssTargets = browserslistToTargets(
    browserslist("last 2 years, > 0.5%, not dead"),
);

function gitCommitCount(file: string): number {
    try {
        const out = execFileSync("git", ["log", "--oneline", "--", file], {
            encoding: "utf8",
        });
        return out.trim().split("\n").filter(Boolean).length;
    } catch {
        return 0;
    }
}

function toChangefreq(
    commits: number,
): "always" | "daily" | "weekly" | "monthly" | "yearly" | "never" {
    if (commits <= 1) return "yearly";
    if (commits <= 3) return "monthly";
    if (commits <= 8) return "weekly";
    if (commits <= 20) return "daily";
    return "always";
}

const routeFiles = glob("src/routes/*.tsx").filter(
    f => !basename(f).startsWith("_"),
);
const commitCounts = routeFiles.map(f => gitCommitCount(f));
const maxCommits = Math.max(...commitCounts, 1);

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
                "@terbiumos/tfs/browser": resolve(
                    "node_modules/@terbiumos/tfs/src/index.ts",
                ),
            },
            tsconfigPaths: true,
        },
        environments: {
            client: {
                resolve: {
                    conditions: ["solid", "browser"],
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
            sourcemap: true,
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
            tanstackRouter({ target: "solid", autoCodeSplitting: true }),
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
                rolldownConfig: {
                    external: ["@better-auth/kysely-adapter", "kysely"],
                },
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
                hostname: "https://civil.quartinal.me",
                routes: routeFiles.map((file, i) => {
                    const name = basename(file, ".tsx");
                    const commits = commitCounts[i];
                    return {
                        loc: name === "index" ? "/" : `/${name}`,
                        lastmod: stat(file).mtime.toISOString().split("T")[0],
                        changefreq: toChangefreq(commits),
                        priority:
                            Math.round(
                                (0.1 + (commits / maxCommits) * 0.9) * 10,
                            ) / 10,
                    };
                }),
                outDir: "dist/client",
            }),
            robots({
                content: BLOCK_AI_ALLOW_REST.replace(
                    /\n?User-agent:\s*ClaudeBot\s*\nDisallow:\s*\/\s*\n?/g,
                    "\n",
                ),
                sitemap: "https://civil.quartinal.me/sitemap.xml",
            }),
            devtoolsJson(),
            obfuscateAssets(),
        ],
    };
});

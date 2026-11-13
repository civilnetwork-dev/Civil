import { execFileSync } from "node:child_process";
import { globSync as glob, statSync as stat } from "node:fs";
import { basename, resolve } from "node:path";

import devtoolsJson from "@silvenon/vite-plugin-devtools-json";
import solid from "@solidjs/vite-plugin";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { vanillaExtractPlugin as vanillaExtract } from "@vanilla-extract/vite-plugin";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";
import { rolldown } from "rolldown";
import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { BLOCK_AI_ALLOW_REST, robots } from "vite-plugin-robots-ts";
import { sitemap } from "vite-plugin-sitemap-ts";

import { obfuscateAssets } from "./misc/vite/obfuscateAssets.ts";

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

function civilExtShimPlugin(): Plugin {
    const VIRTUAL_ID = "virtual:civil-ext-shim-source";
    const RESOLVED_ID = "\0virtual:civil-ext-shim-source";
    let _cached: string | undefined;
    return {
        name: "civil-ext-shim-source",
        resolveId(id) {
            if (id === VIRTUAL_ID) return RESOLVED_ID;
        },
        async load(id) {
            if (id !== RESOLVED_ID) return;
            if (_cached !== undefined)
                return `export default ${JSON.stringify(_cached)};`;
            try {
                const bundle = await rolldown({
                    input: resolve(
                        process.cwd(),
                        "misc/browserApiEmulators/extensions/chrome/shim/index.ts",
                    ),
                    platform: "browser",
                });
                const result = await bundle.generate({
                    format: "iife",
                    name: "__civilShim__",
                    minify: false,
                });
                _cached = result.output[0]?.code ?? "";
            } catch (err) {
                console.warn(
                    "[civil-ext-shim] bundle failed, using script-tag fallback:",
                    err,
                );
                _cached = "";
            }
            return `export default ${JSON.stringify(_cached)};`;
        },
    };
}

/**
 * Answer a request for a missing file with a 404 under `vite dev`, as Nitro's
 * dev server did. @solidjs/vite-plugin renders the app for any GET whose
 * Accept header allows any type, so /sw.js and the proxy runtime scripts (only
 * run.ts serves them) came back as the HTML page and threw "Unexpected token
 * '<'".
 *
 * A post middleware, so Vite serves modules and public/ first; "pre" and ahead
 * of solid() in the plugin list, so it runs before the plugin's page renderer.
 */
function devMissingFile404(): Plugin {
    return {
        name: "civil-dev-missing-file-404",
        apply: "serve",
        enforce: "pre",
        configureServer(server) {
            return () => {
                server.middlewares.use((req, res, next) => {
                    const { pathname } = new URL(
                        req.url ?? "/",
                        "http://localhost",
                    );
                    if (!/\.\w+$/.test(pathname)) return next();
                    res.statusCode = 404;
                    res.end();
                });
            };
        },
    };
}

const routeFiles = glob("src/routes/*.tsx").filter(
    f => !basename(f).startsWith("_"),
);
const commitCounts = routeFiles.map(f => gitCommitCount(f));
const maxCommits = Math.max(...commitCounts, 1);

const resolveConfig = {
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
        "solid-js/store": "solid-js",
        "@terbiumos/tfs/browser": resolve(
            "node_modules/@terbiumos/tfs/src/index.ts",
        ),
        tslib: resolve("node_modules/tslib/tslib.es6.mjs"),
    },
    tsconfigPaths: true,
};

const environments = {
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
};

const buildConfig = {
    // run.ts serves dist/client/_build and 404s a bare /_build, and
    // misc/vite/obfuscateAssets walks dist/client/_build/assets - the
    // three have to agree on this path.
    assetsDir: "_build/assets",
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
};

const cssConfig = {
    transformer: "lightningcss" as const,
    lightningcss: {
        targets: cssTargets,
        drafts: { customMedia: true },
        minify: true,
    },
};

function sitemapRoutes() {
    return routeFiles.map((file, i) => {
        const name = basename(file, ".tsx");
        const commits = commitCounts[i];
        return {
            loc: name === "index" ? "/" : `/${name}`,
            lastmod: stat(file).mtime.toISOString().split("T")[0],
            changefreq: toChangefreq(commits),
            priority:
                Math.round((0.1 + (commits / maxCommits) * 0.9) * 10) / 10,
        };
    });
}

function plugins() {
    return [
        civilExtShimPlugin(),
        tanstackRouter({ target: "solid", autoCodeSplitting: true }),
        devMissingFile404(),
        // `vite build` writes the client to dist/client and the SSR handler
        // run.ts serves to dist/server/server.js.
        solid({ ssr: true, start: true }),
        vanillaExtract(),
        sitemap({
            hostname: "https://civil.quartinal.me",
            routes: sitemapRoutes(),
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
    ];
}

export default defineConfig(() => {
    return {
        resolve: resolveConfig,
        environments,
        // Nitro used to set this: one resolved config, so one instance of each
        // plugin, serves the client and the SSR build. Vite's default
        // evaluates this file again per environment, and obfuscateAssets'
        // run-once guard would then obfuscate dist/client twice.
        builder: { sharedConfigBuild: true },
        build: buildConfig,
        css: cssConfig,
        plugins: plugins(),
    };
});

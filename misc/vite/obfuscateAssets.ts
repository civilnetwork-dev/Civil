import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin } from "vite";

const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

type ObscuraResult =
    | string
    | { code: string }
    | { getObfuscatedCode(): string };

export type ObfuscateEngine = "obscura" | "obfuscatti";

export type ObfuscateAssetsOptions = {
    assetsDir?: string;
    maxFileBytes?: number;
    /**
     * `obscura-rs` (default) is battle-tested; `obfuscatti` is this repo's
     * own in-progress Zig port of js-confuser (see misc/obfuscatti/README.md),
     * verified against real code but far newer and not yet proven at
     * obscura-rs's level of real-world use. Opt in explicitly here, or set
     * `OBFUSCATE_ENGINE=obfuscatti` for a one-off build without touching
     * config. Needs `misc/obfuscatti` built first (`cd misc/obfuscatti &&
     * zig build`, with Zig 0.16.0 specifically -- see that README's "Known
     * blocker") -- this throws a clear, actionable error if it isn't,
     * rather than silently falling back, since a silent fallback would
     * mean "I asked for obfuscatti" quietly became "I got obscura-rs".
     */
    engine?: ObfuscateEngine;
    /** Only used by the `obfuscatti` engine. */
    minify?: boolean;
};

function normalizeObscuraResult(result: ObscuraResult): string {
    if (typeof result === "string") return result;
    if ("code" in result) return result.code;
    return result.getObfuscatedCode();
}

type ObfuscattiBinding = {
    obfuscate(source: string, options: { minify?: boolean }): string;
};

const OBFUSCATTI_NODE_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "obfuscatti",
    "zig-out",
    "lib",
    "obfuscatti.node",
);

let obfuscattiBinding: ObfuscattiBinding | undefined;

function loadObfuscatti(): ObfuscattiBinding {
    if (obfuscattiBinding) return obfuscattiBinding;

    if (!existsSync(OBFUSCATTI_NODE_PATH)) {
        throw new Error(
            `[obfuscate-assets] engine "obfuscatti" selected, but its native binding isn't built: ${OBFUSCATTI_NODE_PATH} not found. ` +
                `Build it first: cd misc/obfuscatti && zig build (needs Zig 0.16.0 specifically -- see misc/obfuscatti/README.md's "Known blocker"). ` +
                `Or drop engine: "obfuscatti" / OBFUSCATE_ENGINE to use obscura-rs instead.`,
        );
    }

    const require = createRequire(import.meta.url);
    obfuscattiBinding = require(OBFUSCATTI_NODE_PATH) as ObfuscattiBinding;
    return obfuscattiBinding;
}

async function obfuscateCode(
    source: string,
    engine: ObfuscateEngine,
    minify: boolean | undefined,
): Promise<string> {
    if (engine === "obfuscatti") {
        return loadObfuscatti().obfuscate(source, { minify });
    }

    // Imported lazily, not at module scope: obscura-rs loads its own
    // native binding as an import-time side effect, so a static import
    // here would mean *every* consumer of this file needs obscura-rs's
    // binding available even when they've selected engine: "obfuscatti"
    // and never touch obscura-rs at all.
    const { obfuscate: obfuscateJsWithObscura } = await import("obscura-rs");
    const result = obfuscateJsWithObscura(source) as ObscuraResult;
    return normalizeObscuraResult(result);
}

async function walkJs(dir: string): Promise<string[]> {
    const results: string[] = [];

    try {
        const entries = await readdir(dir, {
            withFileTypes: true,
            encoding: "utf-8",
        });

        await Promise.all(
            entries.map(async entry => {
                const fullPath = join(dir, entry.name);

                if (entry.isDirectory()) {
                    results.push(...(await walkJs(fullPath)));
                    return;
                }

                if (entry.isFile() && extname(entry.name) === ".js") {
                    results.push(fullPath);
                }
            }),
        );
    } catch {
        return results;
    }

    return results;
}

export function obfuscateAssets(options: ObfuscateAssetsOptions = {}): Plugin {
    let didRun = false;

    return {
        name: "solidstart-obfuscate-assets",
        apply: "build",
        enforce: "post",

        async closeBundle() {
            if (didRun) return;
            didRun = true;

            const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
            const engine: ObfuscateEngine =
                options.engine ??
                (process.env.OBFUSCATE_ENGINE as ObfuscateEngine | undefined) ??
                "obscura";

            // Resolved once, outside the per-file try/catch below: a missing
            // binding means every file would fail identically, and an
            // explicitly-requested engine silently skipping obfuscation
            // (shipping code the caller believes was obfuscated) is worse
            // than failing the build loudly.
            if (engine === "obfuscatti") {
                loadObfuscatti();
            }

            const assetsDir =
                options.assetsDir ??
                join(process.cwd(), "dist", "client", "_build", "assets");

            const files = await walkJs(assetsDir);

            if (files.length === 0) {
                console.log("[obfuscate-assets] no JS assets found");
                return;
            }

            let passed = 0;
            let failed = 0;
            let skipped = 0;

            for (const file of files) {
                try {
                    const { size } = await stat(file);

                    if (size > maxFileBytes) {
                        skipped++;
                        continue;
                    }

                    const source = await readFile(file, "utf-8");
                    const obfuscated = await obfuscateCode(
                        source,
                        engine,
                        options.minify,
                    );

                    await writeFile(file, obfuscated, "utf-8");
                    passed++;
                } catch (error) {
                    failed++;
                    console.warn("[obfuscate-assets] failed:", file, error);
                }
            }

            console.log(
                `[obfuscate-assets] obfuscated ${passed}/${files.length} JS asset files (engine: ${engine})` +
                    (skipped
                        ? ` (${skipped} skipped: >${Math.round(maxFileBytes / 1024)} kB)`
                        : "") +
                    (failed ? ` (${failed} errors)` : ""),
            );
        },
    };
}

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { obfuscate as obfuscateJsWithObscura } from "obscura-rs";
import type { Plugin } from "vite";

const DEFAULT_MAX_FILE_BYTES = 1024 * 1024;

type ObscuraResult =
    | string
    | { code: string }
    | { getObfuscatedCode(): string };

export type ObfuscateAssetsOptions = {
    assetsDir?: string;
    maxFileBytes?: number;
};

function normalizeObscuraResult(result: ObscuraResult): string {
    if (typeof result === "string") return result;
    if ("code" in result) return result.code;
    return result.getObfuscatedCode();
}

function obfuscateCode(source: string): string {
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
                    const obfuscated = obfuscateCode(source);

                    await writeFile(file, obfuscated, "utf-8");
                    passed++;
                } catch (error) {
                    failed++;
                    console.warn("[obfuscate-assets] failed:", file, error);
                }
            }

            console.log(
                `[obfuscate-assets] obfuscated ${passed}/${files.length} JS asset files` +
                    (skipped
                        ? ` (${skipped} skipped: >${Math.round(maxFileBytes / 1024)} kB)`
                        : "") +
                    (failed ? ` (${failed} errors)` : ""),
            );
        },
    };
}

import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Every file under `dir`, depth first, in directory-listing order. The fixture
 * generators cap how much they take from each bundle, so this order decides
 * what lands in their committed output; keep it.
 */
export function walkFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walkFiles(path, out);
        else out.push(path);
    }
    return out;
}

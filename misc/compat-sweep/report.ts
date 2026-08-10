/**
 * Prints a readable breakdown of a sweep run.
 *
 *   bun misc/compat-sweep/report.ts [results.json]
 */

import { readFileSync } from "node:fs";

interface Row {
    domain: string;
    compat: number | null;
    proxy: string | null;
    bodyLength: number;
    hasTitleTag: boolean;
    challenged: boolean;
    rewriterErrors: number;
    failedRequests: number;
    title: string;
    note?: string;
}

const path = process.argv[2] ?? "misc/compat-sweep/results.json";
const rows: Row[] = JSON.parse(readFileSync(path, "utf8"));
const sampled = rows.filter(r => r.compat !== null);

const pad = (s: string | number, n: number) => String(s).padEnd(n);
const lpad = (s: string | number, n: number) => String(s).padStart(n);

console.log(`rows ${rows.length} | sampled ${sampled.length}`);
if (sampled.length) {
    const avg =
        sampled.reduce((a, r) => a + (r.compat ?? 0), 0) / sampled.length;
    console.log(`avg compat ${avg.toFixed(1)}%`);
}

console.log("\n=== by rendered content (ascending) ===");
console.log("  a score >=60 on a near-blank page means the score lied\n");
for (const r of [...sampled].sort((a, b) => a.bodyLength - b.bodyLength)) {
    const lied =
        r.bodyLength < 500 && (r.compat ?? 0) >= 60 ? "  <-- LIED" : "";
    console.log(
        `  ${pad(r.domain, 24)} ${lpad(r.bodyLength, 6)} ch  ${lpad(r.compat ?? "-", 4)}%  ` +
            `${pad(r.proxy ?? "?", 9)}${r.challenged ? " CHALLENGED" : ""}` +
            `${r.hasTitleTag ? "" : " NO<title>"}${lied}`,
    );
}

const buckets: [string, number, number][] = [
    ["blank <200", 0, 200],
    ["200-500", 200, 500],
    ["500-2k", 500, 2000],
    ["2k-10k", 2000, 10000],
    ["10k+", 10000, Number.POSITIVE_INFINITY],
];
console.log("\n=== body length distribution ===");
for (const [label, lo, hi] of buckets) {
    const n = sampled.filter(r => r.bodyLength >= lo && r.bodyLength < hi);
    console.log(`  ${pad(label, 12)} ${lpad(n.length, 3)}`);
}

const unsampled = rows.filter(r => r.compat === null);
if (unsampled.length) {
    console.log(`\n=== unsampled (${unsampled.length}) ===`);
    for (const r of unsampled) {
        console.log(`  ${pad(r.domain, 24)} ${r.note ?? ""}`);
    }
}

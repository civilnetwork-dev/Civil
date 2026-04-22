import { Database } from "bun:sqlite";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import XOREncoder from "../config/encoder/xor_encoder";

const args = Object.fromEntries(
    process.argv.slice(2).map(arg => {
        const [key, value] = arg.replace(/^--/, "").split("=");
        return [key, value ?? true];
    }),
);

const ITERATIONS = parseInt(args.iterations ?? "100000", 10);
const DB_PATH = args.db ?? resolve(import.meta.dirname, "results.db");

const SAMPLES = [
    "https://youareanidiot.cc",
    `https://example.com/#${"A".repeat(512)}`,
    "https://www.securly.com",
    "https://discord.com/channels/@me",
    "https://github.com/Quartinal",
];

const uvXor = {
    encode(str) {
        if (!str) return str;
        let result = "";
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const char = str[i];
            result +=
                i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char;
        }
        return encodeURIComponent(result);
    },
    decode(str) {
        if (!str) return str;
        str = decodeURIComponent(str);
        let result = "";
        const len = str.length;
        for (let i = 0; i < len; i++) {
            const char = str[i];
            result +=
                i % 2 ? String.fromCharCode(char.charCodeAt(0) ^ 2) : char;
        }
        return result;
    },
};

const uvXorOld = {
    encode(str) {
        if (!str) return str;
        let result = "";
        for (let i = 0; i < str.length; i++) {
            result +=
                i % 2 ? String.fromCharCode(str.charCodeAt(i) ^ 2) : str[i];
        }
        return encodeURIComponent(result);
    },
    decode(str) {
        if (!str) return str;
        const [input, ...search] = str.split("?");
        let result = "";
        const decoded = decodeURIComponent(input);
        for (let i = 0; i < decoded.length; i++) {
            result +=
                i % 2
                    ? String.fromCharCode(decoded.charCodeAt(i) ^ 2)
                    : decoded[i];
        }
        return result + (search.length ? "?" + search.join("?") : "");
    },
};

const XorModule = await XOREncoder({
    locateFile: file => resolve(import.meta.dirname, file),
    wasmBinary: readFileSync(
        resolve(import.meta.dirname, "..", "config/encoder/xor_encoder.wasm"),
    ),
});

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let scratch = new Uint8Array(4096);

let cachedHeap = XorModule.HEAPU8;
const heap = () => {
    if (cachedHeap.buffer.byteLength === 0) cachedHeap = XorModule.HEAPU8;
    return cachedHeap;
};

function writeToWasm(str) {
    const maxBytes = str.length * 3;
    if (scratch.length < maxBytes) scratch = new Uint8Array(maxBytes * 2);
    const { written } = textEncoder.encodeInto(str, scratch);
    const ptr = XorModule.getInBuf(written);
    heap().set(scratch.subarray(0, written), ptr);
    return written;
}

function readFromWasm() {
    const ptr = XorModule.getOutBuf();
    const len = XorModule.outLen();
    return textDecoder.decode(heap().subarray(ptr, ptr + len));
}

const wasmImpl = {
    encode(str) {
        const len = writeToWasm(str);
        XorModule.encodeBuf(len);
        return readFromWasm();
    },
    decode(str) {
        const len = writeToWasm(str);
        XorModule.decodeBuf(len);
        return readFromWasm();
    },
};

function bench(impl, label) {
    const ops = ITERATIONS * SAMPLES.length * 2;

    const warmup = Math.max(500, Math.floor(ITERATIONS * 0.05));
    for (let i = 0; i < warmup; i++) {
        for (const sample of SAMPLES) {
            impl.decode(impl.encode(sample));
        }
    }

    process.stdout.write(`\nbenchmarking ${label}... `);
    const t0 = performance.now();

    for (let i = 0; i < ITERATIONS; i++) {
        for (const sample of SAMPLES) {
            const enc = impl.encode(sample);
            impl.decode(enc);
        }
    }

    const totalMs = performance.now() - t0;
    const opsPerSec = (ops / totalMs) * 1000;
    const avgNsPerOp = (totalMs / ops) * 1e6;

    console.log("done.");
    console.log(
        `${totalMs.toFixed(1)} ms | ${(opsPerSec / 1e6).toFixed(2)} Mops/s`,
    );

    return { totalMs, opsPerSec, avgNsPerOp };
}

function initDb(path) {
    const db = new Database(path);
    db.run(`CREATE TABLE IF NOT EXISTS runs (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        run_ts        TEXT    NOT NULL DEFAULT (datetime('now')),
        iterations    INTEGER NOT NULL,
        impl          TEXT    NOT NULL,
        total_ms      REAL    NOT NULL,
        ops_per_sec   REAL    NOT NULL,
        avg_ns_per_op REAL    NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS comparisons (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        run_ts               TEXT    NOT NULL DEFAULT (datetime('now')),
        iterations           INTEGER NOT NULL,
        baseline_impl        TEXT    NOT NULL,
        wasm_ops_per_sec     REAL,
        baseline_ops_per_sec REAL,
        speedup_factor       REAL
    )`);
    return db;
}

function saveResult(
    db,
    runTs,
    impl,
    iterations,
    { totalMs, opsPerSec, avgNsPerOp },
) {
    return db
        .prepare(`
        INSERT INTO runs (run_ts, iterations, impl, total_ms, ops_per_sec, avg_ns_per_op)
        VALUES (?, ?, ?, ?, ?, ?)
    `)
        .run(runTs, iterations, impl, totalMs, opsPerSec, avgNsPerOp);
}

function saveComparison(
    db,
    runTs,
    iterations,
    baselineImpl,
    wasmOps,
    baselineOps,
) {
    const speedup = wasmOps != null ? wasmOps / baselineOps : null;
    db.prepare(`
        INSERT INTO comparisons
            (run_ts, iterations, baseline_impl, wasm_ops_per_sec, baseline_ops_per_sec, speedup_factor)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(runTs, iterations, baselineImpl, wasmOps, baselineOps, speedup);
    return speedup;
}

function exportJson(db) {
    const latestTs = db.prepare(`SELECT MAX(run_ts) as ts FROM runs`).get().ts;

    const runs = db
        .prepare(`
        SELECT impl, total_ms, ops_per_sec, avg_ns_per_op
        FROM runs WHERE run_ts = ?
    `)
        .all(latestTs);

    const comps = db
        .prepare(`
        SELECT baseline_impl, wasm_ops_per_sec, baseline_ops_per_sec, speedup_factor
        FROM comparisons WHERE run_ts = ?
    `)
        .all(latestTs);

    const out = { iterations: ITERATIONS, runs, comparisons: comps };
    const outPath = resolve(import.meta.dirname, "bench_results.json");
    writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log(`\nresults exported to ${outPath}`);
    return out;
}

(async () => {
    console.log(
        "\nxor encoding benchmark\n",
        `iterations: ${ITERATIONS.toLocaleString()}\n`,
        `samples: ${SAMPLES.length} strings\n`,
        `db: ${DB_PATH}\n`,
    );

    const db = initDb(DB_PATH);
    const runTs = new Date().toISOString().replace("T", " ").slice(0, 19);

    const impls = [
        { key: "ultraviolet new encoding method", impl: uvXor },
        { key: "ultraviolet old encoding method", impl: uvXorOld },
        {
            key: "civil's custom c++/wasm optimized encoding method",
            impl: wasmImpl,
        },
    ];

    const results = {};
    for (const { key, impl } of impls) {
        const r = bench(impl, key);
        results[key] = r;
        saveResult(db, runTs, key, ITERATIONS, r);
    }

    const wasmOps =
        results["civil's custom c++/wasm optimized encoding method"].opsPerSec;
    console.log("\nspeedup factors (c++/wasm vs js):");
    for (const { key } of impls.filter(i => !i.key.includes("wasm"))) {
        const speedup = saveComparison(
            db,
            runTs,
            ITERATIONS,
            key,
            wasmOps,
            results[key].opsPerSec,
        );
        console.log(`wasm / ${key}: ${speedup?.toFixed(2)}x`);
    }

    const out = exportJson(db);
    db.close();

    console.log("\nimplementation                   ops/sec       avg ns/op");
    for (const row of out.runs) {
        const name = row.impl.padEnd(40);
        const ops = (row.ops_per_sec / 1e6).toFixed(3).padStart(8) + " mops/s";
        const ns = row.avg_ns_per_op.toFixed(1).padStart(10) + " ns";
        console.log(`${name} ${ops}  ${ns}`);
    }
})();

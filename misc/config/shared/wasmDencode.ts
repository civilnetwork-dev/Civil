import type { MainModule } from "$wasm/xor_encoder.js";
import xorDencode from "$wasm/xor_encoder.js";

let module: MainModule;
let initPromise: Promise<void> | null = null;
let _loggedEncode = false;
let _loggedDecode = false;

export function init() {
    if (initPromise) return initPromise;
    const t0 = performance.now();
    console.debug("[xorWasm] init start");
    initPromise = xorDencode().then(mod => {
        module = mod;
        (globalThis as any)["__civil_xorWasm__"] = {
            mod: module,
            scratch: new Uint8Array(4096),
        };
        console.debug(
            `[xorWasm] ready in ${(performance.now() - t0).toFixed(1)}ms`,
        );
    });
    return initPromise;
}

init();

export const setSearchEngine = (engine: string) =>
    module.setSearchEngine(engine);
export const setSearchTemplate = (template: string) =>
    module.setSearchTemplate(template);

const _unreserved = (c: number) =>
    (c >= 65 && c <= 90) ||
    (c >= 97 && c <= 122) ||
    (c >= 48 && c <= 57) ||
    c === 45 ||
    c === 95 ||
    c === 46 ||
    c === 126;

function _jsDecode(str: string) {
    const b: number[] = [];
    for (let i = 0; i < str.length; i++) {
        if (str[i] === "%" && i + 2 < str.length) {
            b.push(parseInt(str.slice(i + 1, i + 3), 16));
            i += 2;
        } else b.push(str.charCodeAt(i));
    }
    for (let i = 1; i < b.length; i += 2) b[i] ^= 0x02;
    try {
        return decodeURIComponent(String.fromCharCode(...b));
    } catch {
        return str;
    }
}

function _jsEncode(str: string) {
    const HEX = "0123456789ABCDEF";
    let s1 = "";
    for (const b of new TextEncoder().encode(str))
        s1 += _unreserved(b)
            ? String.fromCharCode(b)
            : "%" + HEX[b >> 4] + HEX[b & 0x0f];
    const b = Array.from(s1, c => c.charCodeAt(0));
    for (let i = 1; i < b.length; i += 2) b[i] ^= 0x02;
    let out = "";
    for (const c of b)
        out += _unreserved(c)
            ? String.fromCharCode(c)
            : "%" + HEX[c >> 4] + HEX[c & 0x0f];
    return out;
}

function wasmEncode(str: string) {
    const state = (globalThis as any)["__civil_xorWasm__"];
    if (!state) {
        console.debug(
            "[xorWasm] encode fallback (wasm not ready):",
            str.slice(0, 40),
        );
        return _jsEncode(str);
    }
    if (!_loggedEncode) {
        console.debug("[xorWasm] encode via wasm:", str.slice(0, 40));
        _loggedEncode = true;
    }
    const { mod } = state;
    const maxBytes = str.length * 3;
    if (state.scratch.length < maxBytes)
        state.scratch = new Uint8Array(maxBytes * 2);
    const { written } = new TextEncoder().encodeInto(str, state.scratch);
    const ptr = mod.getInBuf(written);
    if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
        mod.cachedHeap = mod.HEAPU8;
    mod.cachedHeap.set(state.scratch.subarray(0, written), ptr);
    mod.encodeBuf(written);
    const outPtr = mod.getOutBuf();
    const outLen = mod.outLen();
    if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
        mod.cachedHeap = mod.HEAPU8;
    return new TextDecoder().decode(
        mod.cachedHeap.subarray(outPtr, outPtr + outLen),
    );
}

function wasmDecode(str: string) {
    const state = (globalThis as any)["__civil_xorWasm__"];
    if (!state) {
        console.debug(
            "[xorWasm] decode fallback (wasm not ready):",
            str.slice(0, 40),
        );
        return _jsDecode(str);
    }
    if (!_loggedDecode) {
        console.debug("[xorWasm] decode via wasm:", str.slice(0, 40));
        _loggedDecode = true;
    }
    const { mod } = state;
    const maxBytes = str.length * 3;
    if (state.scratch.length < maxBytes)
        state.scratch = new Uint8Array(maxBytes * 2);
    const { written } = new TextEncoder().encodeInto(str, state.scratch);
    const ptr = mod.getInBuf(written);
    if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
        mod.cachedHeap = mod.HEAPU8;
    mod.cachedHeap.set(state.scratch.subarray(0, written), ptr);
    mod.decodeBuf(written);
    const outPtr = mod.getOutBuf();
    const outLen = mod.outLen();
    if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
        mod.cachedHeap = mod.HEAPU8;
    return new TextDecoder().decode(
        mod.cachedHeap.subarray(outPtr, outPtr + outLen),
    );
}

export const encode = wasmEncode;
export const decode = wasmDecode;

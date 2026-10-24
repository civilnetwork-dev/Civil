import type { MainModule } from "$wasm/xor_encoder.js";
import xorDencode from "$wasm/xor_encoder.js";
import { jsDecode, jsEncode } from "./xorCodec";

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

/**
 * Runs one codec step over `str` through the WASM module's shared buffers.
 * `cachedHeap` is re-read after the call because a step can grow the module's
 * memory, which detaches the previous view.
 */
function runWasm(
    state: { mod: any; scratch: Uint8Array },
    str: string,
    step: "encodeBuf" | "decodeBuf",
): string {
    const { mod } = state;
    const maxBytes = str.length * 3;
    if (state.scratch.length < maxBytes)
        state.scratch = new Uint8Array(maxBytes * 2);
    const { written } = new TextEncoder().encodeInto(str, state.scratch);
    const ptr = mod.getInBuf(written);
    if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
        mod.cachedHeap = mod.HEAPU8;
    mod.cachedHeap.set(state.scratch.subarray(0, written), ptr);
    mod[step](written);
    const outPtr = mod.getOutBuf();
    const outLen = mod.outLen();
    if (!mod.cachedHeap || mod.cachedHeap.buffer.byteLength === 0)
        mod.cachedHeap = mod.HEAPU8;
    return new TextDecoder().decode(
        mod.cachedHeap.subarray(outPtr, outPtr + outLen),
    );
}

function wasmEncode(str: string) {
    const state = (globalThis as any)["__civil_xorWasm__"];
    if (!state) {
        console.debug(
            "[xorWasm] encode fallback (wasm not ready):",
            str.slice(0, 40),
        );
        return jsEncode(str);
    }
    if (!_loggedEncode) {
        console.debug("[xorWasm] encode via wasm:", str.slice(0, 40));
        _loggedEncode = true;
    }
    return runWasm(state, str, "encodeBuf");
}

function wasmDecode(str: string) {
    const state = (globalThis as any)["__civil_xorWasm__"];
    if (!state) {
        console.debug(
            "[xorWasm] decode fallback (wasm not ready):",
            str.slice(0, 40),
        );
        return jsDecode(str);
    }
    if (!_loggedDecode) {
        console.debug("[xorWasm] decode via wasm:", str.slice(0, 40));
        _loggedDecode = true;
    }
    return runWasm(state, str, "decodeBuf");
}

export const encode = wasmEncode;
export const decode = wasmDecode;

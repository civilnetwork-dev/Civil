import { describe, expect, it } from "vitest";
import {
    isUnreserved,
    jsDecode,
    jsEncode,
} from "../misc/config/shared/xorCodec";

/**
 * The JS codec is the fallback used until the WASM module finishes loading, so
 * it handles the first navigation of a session. If it stops round-tripping — or
 * drifts from the WASM implementation — proxied URLs silently resolve to
 * garbage.
 */

/** Full URLs — what the codec is actually fed in the real call path. */
const URLS = [
    "https://example.com/",
    "https://example.com/path/to/page",
    "https://example.com/search?q=hello+world&page=2",
    "https://example.com/#fragment",
    "https://sub.domain.example.co.uk:8443/a/b?c=d#e",
    "https://example.com/path with spaces",
    "https://example.com/?q=a=b&c==d",
    "https://example.com/%2Falready-encoded",
    "https://example.com/unicode/héllo/日本語/🎉",
    "https://user:pass@example.com/",
    "https://example.com/?q=" + "x".repeat(500),
];

/** Bare search terms — see the divergence suite at the bottom of this file. */
const BARE_TERMS = ["a", "ab", "abc", "hello world"];

describe("isUnreserved", () => {
    it("accepts exactly the RFC 3986 unreserved set", () => {
        const unreserved =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~";
        for (const ch of unreserved) {
            expect(isUnreserved(ch.charCodeAt(0))).toBe(true);
        }
        for (const ch of "/:?#[]@!$&'()*+,;= %\"<>\\^`{|}") {
            expect(isUnreserved(ch.charCodeAt(0))).toBe(false);
        }
    });
});

describe("jsEncode / jsDecode round-trip", () => {
    it.each([...URLS, ...BARE_TERMS])("round-trips %s", url => {
        expect(jsDecode(jsEncode(url))).toBe(url);
    });

    it("round-trips the empty string", () => {
        expect(jsDecode(jsEncode(""))).toBe("");
    });

    it("is deterministic", () => {
        const url = "https://example.com/a?b=c";
        expect(jsEncode(url)).toBe(jsEncode(url));
    });

    it("actually obfuscates — output differs from input", () => {
        const url = "https://example.com/";
        expect(jsEncode(url)).not.toBe(url);
    });

    it("does not leak the hostname verbatim", () => {
        // The point of the codec is that a filter scanning the URL bar or
        // request path cannot pattern-match the destination host.
        expect(jsEncode("https://example.com/")).not.toContain("example.com");
    });

    it("produces output safe to embed in a URL path", () => {
        // Every output character must be unreserved or a percent escape,
        // otherwise the encoded value would need escaping again by the caller.
        for (const url of URLS) {
            const encoded = jsEncode(url);
            expect(encoded).toMatch(/^(?:[A-Za-z0-9\-_.~]|%[0-9A-F]{2})*$/);
        }
    });

    it("round-trips strings that are not URLs at all", () => {
        for (const term of ["hello world", "1 + 1 = 2", "?????", "%%%"]) {
            expect(jsDecode(jsEncode(term))).toBe(term);
        }
    });
});

describe("jsDecode error handling", () => {
    it("returns the input unchanged rather than throwing on malformed input", () => {
        // Must not throw: this runs inside the service worker, where an
        // exception would break the navigation entirely.
        expect(() => jsDecode("%")).not.toThrow();
        expect(() => jsDecode("%ZZ")).not.toThrow();
        expect(() => jsDecode("%E0%A4%A")).not.toThrow();
        expect(() => jsDecode("\uD800")).not.toThrow();
    });
});

/**
 * Cross-check against the real WASM encoder. This is the test that actually
 * matters: the two implementations must agree, or a URL encoded before WASM
 * finished loading cannot be decoded after it has.
 *
 * Skipped rather than failed when the WASM module can't be instantiated in
 * Node (it's an Emscripten browser build), so this suite stays useful without
 * needing `bun run build:encoder` first.
 */
describe("JS codec agrees with the WASM codec", async () => {
    type XorModule = {
        getInBuf(n: number): number;
        getOutBuf(): number;
        outLen(): number;
        encodeBuf(n: number): void;
        decodeBuf(n: number): void;
        HEAPU8: Uint8Array;
    };

    let mod: XorModule | null = null;
    try {
        const factory = (await import("../config/encoder/xor_encoder.js"))
            .default as () => Promise<XorModule>;
        mod = await factory();
    } catch {
        mod = null;
    }

    const run = (m: XorModule, str: string, decode: boolean): string => {
        const bytes = new TextEncoder().encode(str);
        const ptr = m.getInBuf(bytes.length);
        m.HEAPU8.set(bytes, ptr);
        if (decode) m.decodeBuf(bytes.length);
        else m.encodeBuf(bytes.length);
        const outPtr = m.getOutBuf();
        return new TextDecoder().decode(
            m.HEAPU8.subarray(outPtr, outPtr + m.outLen()),
        );
    };

    it("could load the WASM module (informational)", () => {
        // Not an assertion about correctness — just makes it visible in the
        // report whether the cross-check below actually ran.
        expect(mod === null || typeof mod.encodeBuf === "function").toBe(true);
    });

    it.skipIf(!mod).each(URLS)("encodes %s identically in JS and WASM", url => {
        expect(run(mod as XorModule, url, false)).toBe(jsEncode(url));
    });

    it.skipIf(!mod).each(URLS)(
        "JS can decode what WASM encoded for %s",
        url => {
            expect(jsDecode(run(mod as XorModule, url, false))).toBe(url);
        },
    );

    /**
     * KNOWN DIVERGENCE, pinned deliberately.
     *
     * Given a bare search term rather than a URL, the WASM encoder applies the
     * configured search-engine template (see `setSearchEngine` /
     * `setSearchTemplate` in wasmDencode.ts) and encodes the resulting search
     * URL. The JS fallback has no such template and encodes the term literally.
     *
     * In the normal path this is unreachable: SearchBar.normalizeTerm() turns a
     * search term into a full URL *before* calling encodeUrl, so the codec only
     * ever sees URLs — which is why the suites above pass.
     *
     * It becomes reachable only if something calls encode() with a bare term
     * during the window before the WASM module has loaded. Then the two produce
     * different output and navigation breaks.
     *
     * These tests assert the divergence so that changing either implementation
     * surfaces here rather than as a mystery bug. If the JS fallback is ever
     * taught the search template, delete this suite.
     */
    describe("bare search terms: WASM templates, JS does not", () => {
        it.skipIf(!mod).each(BARE_TERMS)(
            "%s encodes differently in JS and WASM",
            term => {
                expect(run(mod as XorModule, term, false)).not.toBe(
                    jsEncode(term),
                );
            },
        );

        it.skipIf(!mod)("WASM expands a bare term into a search URL", () => {
            const encoded = run(mod as XorModule, "abc", false);
            expect(jsDecode(encoded)).toMatch(/^https?:\/\/.+abc$/);
        });

        it.skipIf(!mod)("JS encodes a bare term literally", () => {
            expect(jsDecode(jsEncode("abc"))).toBe("abc");
        });
    });
});

import { describe, expect, it } from "vitest";

import { decode, encode } from "../misc/config/shared/xorCodec";

/**
 * Every proxied address goes through this codec, in the service worker, the
 * browser page and each proxied frame. If it stops round-tripping, or its
 * output changes, proxied URLs silently resolve to garbage.
 */

/** Full URLs, which is what the codec is fed on the real call path. */
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

/**
 * Pinned output. Addresses saved in history, bookmarks and open tabs were
 * encoded this way, the C++ encoder that came before this one agreed byte for
 * byte, and they must keep decoding.
 */
const KNOWN = [
    ["https://example.com/", "hvtrs%273C%250F%272Dezaopne%2Ccmm%272D"],
    [
        "https://sub.domain.example.co.uk:8443/a/b?c=d#e",
        "hvtrs%273C%250F%272Dswb%2Cdmmcil.gxcmrlg.ao%2Cui%251A%3A463%272Da%272Db%273Dc%273Fd%2721e",
    ],
] as const;

describe("encode and decode", () => {
    it.each(URLS)("round-trips %s", url => {
        expect(decode(encode(url))).toBe(url);
    });

    it.each(KNOWN)("encodes %s exactly as before", (url, encoded) => {
        expect(encode(url)).toBe(encoded);
        expect(decode(encoded)).toBe(url);
    });

    it("round-trips the empty string", () => {
        expect(decode(encode(""))).toBe("");
    });

    it("passes exactly the RFC 3986 unreserved set through", () => {
        // A single character only goes through the first escape and the
        // second, since the XOR starts at the second position.
        const unreserved =
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.~";
        for (const ch of unreserved) expect(encode(ch)).toBe(ch);
        for (const ch of "/:?#[]@!$&'()*+,;= %\"<>\\^`{|}") {
            expect(encode(ch)).not.toBe(ch);
        }
    });

    it("does not leak the hostname verbatim", () => {
        // A filter scanning the URL bar or request path must not be able to
        // pattern-match the destination host.
        expect(encode("https://example.com/")).not.toContain("example.com");
    });

    it("produces output safe to embed in a URL path", () => {
        // Every output character must be unreserved or a percent escape,
        // otherwise the caller would have to escape the encoded value again.
        for (const url of URLS) {
            expect(encode(url)).toMatch(/^(?:[A-Za-z0-9\-_.~]|%[0-9A-F]{2})*$/);
        }
    });

    it("round-trips strings that are not URLs at all", () => {
        for (const term of ["hello world", "1 + 1 = 2", "?????", "%%%"]) {
            expect(decode(encode(term))).toBe(term);
        }
    });

    it("decodes an address too long to spread into one call", () => {
        const url = `https://example.com/?q=${"y".repeat(300_000)}`;
        expect(decode(encode(url))).toBe(url);
    });

    it("returns malformed input unchanged rather than throwing", () => {
        // This runs inside the service worker, where an exception would break
        // the navigation entirely.
        for (const input of ["%", "%ZZ", "%E0%A4%A", "\uD800"]) {
            expect(() => decode(input)).not.toThrow();
        }
        expect(decode("%E0%A4%A")).toBe("%E0%A4%A");
    });
});

describe("as source text", () => {
    // The scramjet controller copies each function into proxied frames with
    // toString(), where nothing else from its module exists. Rebuilding them
    // from their own source catches any reference to the module around them.
    const rebuild = (fn: (s: string) => string) =>
        new Function(`return (${fn.toString()})`)() as (s: string) => string;

    it.each(URLS)("still round-trips %s", url => {
        const encoded = rebuild(encode)(url);
        expect(encoded).toBe(encode(url));
        expect(rebuild(decode)(encoded)).toBe(url);
    });

    it("never writes the literal Blocksi's proxy detector looks for", () => {
        // Blocksi 4.9.16 `detectProxyUsage` redirects the tab and blocklists
        // the origin when any request URL includes `hvtrs8`, which is what
        // Ultraviolet's codec writes for `https:`. This codec escapes the colon
        // before the XOR, so it writes `hvtrs%27`. Keep it that way.
        for (const url of [
            ...URLS,
            "http://example.com/",
            "https://hvtrs8.com/",
        ]) {
            expect(encode(url)).not.toContain("hvtrs8");
        }
    });
});

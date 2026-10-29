/**
 * The XOR URL codec: how a proxied address is written into Civil's paths.
 *
 * Encoding percent-encodes the address's UTF-8 bytes, XORs 0x02 into every
 * odd position of that text, then percent-encodes the result again. Decoding
 * runs the same steps backwards. A filter scanning the request path or the
 * address bar never sees the destination host.
 *
 * The service worker, the browser page and every proxied frame all run these
 * same two functions. The scramjet controller copies them into frames and
 * workers as source text (`codec.encode.toString()`), so each one has to
 * stand alone: no imports, and no references to anything else in this file.
 * tests/xorCodec.test.ts rebuilds them from their source to keep it that way.
 *
 * The output format is fixed. History, bookmarks and open tabs hold addresses
 * encoded by older builds, so a change here breaks every one of them.
 */

export function encode(url: string): string {
    const hex = "0123456789ABCDEF";
    // RFC 3986 unreserved characters pass through; every other byte becomes
    // a %XX escape.
    const escape = (bytes: Iterable<number>) => {
        let out = "";
        for (const b of bytes) {
            const ch = String.fromCharCode(b);
            out += /[\w.~-]/.test(ch) ? ch : `%${hex[b >> 4]}${hex[b & 15]}`;
        }
        return out;
    };
    const codes = Array.from(escape(new TextEncoder().encode(url)), c =>
        c.charCodeAt(0),
    );
    for (let i = 1; i < codes.length; i += 2) codes[i] ^= 2;
    return escape(codes);
}

export function decode(encoded: string): string {
    const codes: number[] = [];
    for (let i = 0; i < encoded.length; i++) {
        if (encoded[i] === "%" && i + 2 < encoded.length) {
            codes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
            i += 2;
        } else {
            codes.push(encoded.charCodeAt(i));
        }
    }
    // Built a character at a time: spreading a long address into
    // String.fromCharCode overflows the call stack.
    let escaped = "";
    for (let i = 0; i < codes.length; i++) {
        escaped += String.fromCharCode(i % 2 ? codes[i] ^ 2 : codes[i]);
    }
    try {
        return decodeURIComponent(escaped);
    } catch {
        // Not valid percent-encoded UTF-8. Handing back the input turns a
        // malformed address into a failed navigation instead of an exception
        // in the service worker.
        return encoded;
    }
}

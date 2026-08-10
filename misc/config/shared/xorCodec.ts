/**
 * Pure-JS implementation of the XOR URL codec.
 *
 * This is the fallback used by wasmDencode.ts before the WASM module finishes
 * loading, which in practice means it handles the first navigation of a session.
 * The WASM implementation in config/encoder/ must produce byte-identical output:
 * if the two ever diverge, a URL encoded by one and decoded by the other
 * silently resolves to garbage, and the failure looks like "the proxy broke on
 * this site" rather than "the encoder changed".
 *
 * Kept in its own module (rather than inline in wasmDencode.ts) so it can be
 * unit-tested without instantiating the WASM module. See tests/xorCodec.test.ts.
 *
 * Scheme: percent-encode → XOR 0x02 over odd character positions →
 * percent-encode again. Decoding reverses it.
 */

const HEX = "0123456789ABCDEF";

/** RFC 3986 unreserved characters: A-Z a-z 0-9 - _ . ~ */
export function isUnreserved(c: number): boolean {
    return (
        (c >= 65 && c <= 90) ||
        (c >= 97 && c <= 122) ||
        (c >= 48 && c <= 57) ||
        c === 45 ||
        c === 95 ||
        c === 46 ||
        c === 126
    );
}

function percentEncodeBytes(bytes: Iterable<number>): string {
    let out = "";
    for (const b of bytes) {
        out += isUnreserved(b)
            ? String.fromCharCode(b)
            : `%${HEX[b >> 4]}${HEX[b & 0x0f]}`;
    }
    return out;
}

/** XOR 0x02 into every odd-indexed byte. Its own inverse. */
function xorOddPositions(bytes: number[]): number[] {
    for (let i = 1; i < bytes.length; i += 2) bytes[i] ^= 0x02;
    return bytes;
}

export function jsEncode(str: string): string {
    const percentEncoded = percentEncodeBytes(new TextEncoder().encode(str));
    const xored = xorOddPositions(
        Array.from(percentEncoded, c => c.charCodeAt(0)),
    );
    return percentEncodeBytes(xored);
}

export function jsDecode(str: string): string {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
        if (str[i] === "%" && i + 2 < str.length) {
            bytes.push(parseInt(str.slice(i + 1, i + 3), 16));
            i += 2;
        } else {
            bytes.push(str.charCodeAt(i));
        }
    }
    xorOddPositions(bytes);
    try {
        return decodeURIComponent(String.fromCharCode(...bytes));
    } catch {
        // Not valid percent-encoded UTF-8: hand back the input rather than
        // throwing, so a malformed URL degrades to a failed navigation instead
        // of an unhandled exception in the service worker.
        return str;
    }
}

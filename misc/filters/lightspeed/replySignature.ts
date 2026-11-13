import { createPublicKey, verify } from "node:crypto";

function canonicalJson(value: unknown): string {
    if (typeof value === "string" && !value.isWellFormed())
        throw new Error("Invalid Unicode in relay reply.");
    if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("Invalid number in relay reply.");
    if (value === null || typeof value !== "object")
        return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

    const object = value as Record<string, unknown>;
    // Native PubKeyVerify uses recursive UTF-16 key order and ECMAScript
    // primitives. An intermediate object would reorder integer-like keys.
    return `{${Object.keys(object)
        .toSorted()
        .map(key => `${canonicalJson(key)}:${canonicalJson(object[key])}`)
        .join(",")}}`;
}

function decodeBase64(value: string, length: number): Buffer {
    const encoded = value.replace(/[\r\n]/g, "");
    if (
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            encoded,
        )
    )
        throw new Error("Invalid relay signature encoding.");
    const bytes = Buffer.from(encoded, "base64");
    if (bytes.length !== length)
        throw new Error("Invalid relay signature length.");
    return bytes;
}

export function verifyRelayReply(
    reply: Record<string, unknown>,
    publicKey: string,
): boolean {
    try {
        const { signature, ...unsigned } = reply;
        if (typeof signature !== "string") return false;
        const key = createPublicKey({
            key: Buffer.concat([
                Buffer.from("302a300506032b6570032100", "hex"),
                decodeBase64(publicKey, 32),
            ]),
            format: "der",
            type: "spki",
        });
        return verify(
            null,
            Buffer.from(canonicalJson(unsigned)),
            key,
            decodeBase64(signature, 64),
        );
    } catch {
        return false;
    }
}

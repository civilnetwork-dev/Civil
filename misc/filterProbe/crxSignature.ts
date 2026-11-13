import { createHash, verify } from "node:crypto";

interface Field {
    id: number;
    bytes: Buffer;
}

function idOf(bytes: Buffer): string {
    return bytes
        .toString("hex")
        .replace(/[0-9a-f]/g, digit =>
            String.fromCharCode(97 + parseInt(digit, 16)),
        );
}

function keyId(key: Buffer): string {
    return idOf(createHash("sha256").update(key).digest().subarray(0, 16));
}

function varint(bytes: Buffer, cursor: { offset: number }): number {
    let value = 0;
    for (
        let shift = 0;
        shift < 49 && cursor.offset < bytes.length;
        shift += 7
    ) {
        const byte = bytes[cursor.offset++]!;
        value += (byte & 127) * 2 ** shift;
        if (!(byte & 128)) return value;
    }
    throw new Error("Invalid CRX protobuf integer");
}

function fields(bytes: Buffer): Field[] {
    const cursor = { offset: 0 };
    const out: Field[] = [];
    while (cursor.offset < bytes.length) {
        const tag = varint(bytes, cursor);
        if ((tag & 7) !== 2 || tag < 8)
            throw new Error("Unsupported CRX protobuf field");
        const size = varint(bytes, cursor);
        const end = cursor.offset + size;
        if (end > bytes.length) throw new Error("Truncated CRX protobuf field");
        out.push({
            id: Math.floor(tag / 8),
            bytes: bytes.subarray(cursor.offset, end),
        });
        cursor.offset = end;
    }
    return out;
}

function field(values: Field[], id: number): Buffer {
    const matches = values.filter(value => value.id === id);
    if (matches.length !== 1) throw new Error("Missing or duplicate CRX field");
    return matches[0]!.bytes;
}

function proofMatches(
    proof: Buffer,
    payload: Buffer,
    expectedId: string,
): boolean {
    const values = fields(proof);
    const key = field(values, 1);
    return (
        keyId(key) === expectedId &&
        verify(
            "sha256",
            payload,
            { key, format: "der", type: "spki" },
            field(values, 2),
        )
    );
}

function crx3Zip(bytes: Buffer, expectedId: string): Buffer {
    const offset = 12 + bytes.readUInt32LE(8);
    if (offset >= bytes.length) throw new Error("Truncated CRX3 header");
    const header = fields(bytes.subarray(12, offset));
    const signed = field(header, 10000);
    const signedId = field(fields(signed), 1);
    if (signedId.length !== 16 || idOf(signedId) !== expectedId)
        throw new Error("CRX extension ID mismatch");
    const size = Buffer.alloc(4);
    size.writeUInt32LE(signed.length);
    const zip = bytes.subarray(offset);
    const payload = Buffer.concat([
        Buffer.from("CRX3 SignedData\0"),
        size,
        signed,
        zip,
    ]);
    if (
        !header.some(
            value =>
                (value.id === 2 || value.id === 3) &&
                proofMatches(value.bytes, payload, expectedId),
        )
    )
        throw new Error("CRX publisher signature did not verify");
    return zip;
}

function crx2Zip(bytes: Buffer, expectedId: string): Buffer {
    if (bytes.length < 16) throw new Error("Truncated CRX2 header");
    const keyEnd = 16 + bytes.readUInt32LE(8);
    const signatureEnd = keyEnd + bytes.readUInt32LE(12);
    if (signatureEnd >= bytes.length) throw new Error("Truncated CRX2 payload");
    const key = bytes.subarray(16, keyEnd);
    const zip = bytes.subarray(signatureEnd);
    if (
        keyId(key) !== expectedId ||
        !verify(
            "RSA-SHA1",
            zip,
            { key, format: "der", type: "spki" },
            bytes.subarray(keyEnd, signatureEnd),
        )
    )
        throw new Error("CRX publisher signature did not verify");
    return zip;
}

/** Authenticate the publisher and exact extension ID before unpacking. */
export function verifiedCrxZip(
    input: Uint8Array,
    expectedId: string,
): Uint8Array {
    const bytes = Buffer.from(input);
    if (
        !/^[a-p]{32}$/.test(expectedId) ||
        bytes.length < 12 ||
        bytes.subarray(0, 4).toString() !== "Cr24"
    )
        throw new Error("Expected a signed CRX package");
    const version = bytes.readUInt32LE(4);
    if (version === 3) return crx3Zip(bytes, expectedId);
    if (version === 2) return crx2Zip(bytes, expectedId);
    throw new Error("Unsupported CRX version");
}

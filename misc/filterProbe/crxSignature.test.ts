import {
    createHash,
    generateKeyPairSync,
    sign,
    type KeyObject,
} from "node:crypto";

import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { verifiedCrxZip } from "./crxSignature";

const ZIP = Buffer.from(
    zipSync({ "manifest.json": Buffer.from('{"version":"1"}') }),
);
const RSA = generateKeyPairSync("rsa", { modulusLength: 2048 });
const EC = generateKeyPairSync("ec", { namedCurve: "prime256v1" });

function integer(value: number): Buffer {
    const bytes: number[] = [];
    while (value >= 128) {
        bytes.push((value % 128) | 128);
        value = Math.floor(value / 128);
    }
    return Buffer.from([...bytes, value]);
}

function field(id: number, bytes: Buffer): Buffer {
    return Buffer.concat([integer(id * 8 + 2), integer(bytes.length), bytes]);
}

function identity(key: Buffer) {
    const digest = createHash("sha256").update(key).digest().subarray(0, 16);
    const id = digest
        .toString("hex")
        .replace(/[0-9a-f]/g, digit =>
            String.fromCharCode(97 + parseInt(digit, 16)),
        );
    return { digest, id };
}

function crx3(
    pair: { publicKey: KeyObject; privateKey: KeyObject },
    algorithm: number,
) {
    const key = pair.publicKey.export({ type: "spki", format: "der" });
    const { digest, id } = identity(key);
    const signed = field(1, digest);
    const size = Buffer.alloc(4);
    size.writeUInt32LE(signed.length);
    const payload = Buffer.concat([
        Buffer.from("CRX3 SignedData\0"),
        size,
        signed,
        ZIP,
    ]);
    const proof = Buffer.concat([
        field(1, key),
        field(2, sign("sha256", payload, pair.privateKey)),
    ]);
    const metadata = Buffer.concat([
        field(algorithm, proof),
        field(10000, signed),
    ]);
    const header = Buffer.alloc(12);
    header.write("Cr24");
    header.writeUInt32LE(3, 4);
    header.writeUInt32LE(metadata.length, 8);
    return { id, bytes: Buffer.concat([header, metadata, ZIP]) };
}

function crx2() {
    const key = RSA.publicKey.export({ type: "spki", format: "der" });
    const signature = sign("RSA-SHA1", ZIP, RSA.privateKey);
    const header = Buffer.alloc(16);
    header.write("Cr24");
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(key.length, 8);
    header.writeUInt32LE(signature.length, 12);
    return {
        id: identity(key).id,
        bytes: Buffer.concat([header, key, signature, ZIP]),
    };
}

const PACKAGES = [crx2(), crx3(RSA, 2), crx3(EC, 3)];
const INVALID_PACKAGES = [
    Buffer.alloc(0),
    ZIP,
    Buffer.from("Cr24\x03\x00\x00\x00"),
];

describe("CRX publisher verification", () => {
    it.each(PACKAGES)(
        "authenticates CRX2, RSA CRX3 and ECDSA CRX3",
        ({ bytes, id }) => {
            expect(Buffer.from(verifiedCrxZip(bytes, id))).toEqual(ZIP);
        },
    );

    it.each(PACKAGES)("rejects payload tampering", ({ bytes, id }) => {
        const tampered = Buffer.from(bytes);
        tampered[tampered.length - 1] ^= 1;
        expect(() => verifiedCrxZip(tampered, id)).toThrow(/signature/);
    });

    it.each(PACKAGES)(
        "rejects a package belonging to a different ID",
        ({ bytes }) => {
            expect(() => verifiedCrxZip(bytes, "a".repeat(32))).toThrow();
        },
    );

    it.each(INVALID_PACKAGES)("rejects unsigned or truncated data", bytes => {
        expect(() => verifiedCrxZip(bytes, "a".repeat(32))).toThrow();
    });
});

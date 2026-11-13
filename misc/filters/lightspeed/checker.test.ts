import { generateKeyPairSync, sign } from "node:crypto";

import { beforeEach, expect, it, vi } from "vitest";

import { checkLightspeedFilter } from "./checker";

type Reply = Record<string, unknown>;
const state = vi.hoisted(() => ({
    lookup: {} as Reply,
    replies: (_lookup: Reply): Reply[] => [],
}));
const keys = generateKeyPairSync("ed25519");
const publicKey = keys.publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("base64");
const options = { relay: { publicKey }, timeoutMs: 50 };

vi.mock("xior", () => ({
    default: {
        create: () => ({
            get: async () => ({
                data: { 1: "education", 28: "security.proxy" },
            }),
        }),
    },
}));

vi.mock("ws", async () => {
    const { EventEmitter } = await import("node:events");
    return {
        WebSocket: class extends EventEmitter {
            constructor() {
                super();
                queueMicrotask(() => this.emit("open"));
            }
            send(data: string) {
                state.lookup = JSON.parse(data);
                this.emit("message", Buffer.from("invalid json"));
                for (const reply of state.replies(state.lookup)) {
                    this.emit("message", Buffer.from(JSON.stringify(reply)));
                }
                this.emit("close");
            }
            close() {
                this.emit("close");
            }
        },
    };
});

function signedReply(lookup: Reply, extra: Reply = {}): Reply {
    const reply = {
        action: "host_lookup",
        request: { host: lookup.host },
        nonce: lookup.nonce,
        cat: 1,
        ...extra,
    };
    // Independent explicit canonical order for this protocol fixture.
    const canonical = JSON.stringify({
        action: reply.action,
        cat: reply.cat,
        nonce: reply.nonce,
        request: reply.request,
    });
    const signature = sign(null, Buffer.from(canonical), keys.privateKey);
    return { ...reply, signature: signature.toString("base64") };
}

beforeEach(() => {
    state.lookup = {};
    state.replies = () => [];
});

it("correlates signed host replies with the request nonce", async () => {
    state.replies = lookup => [
        signedReply(lookup, { action: "other" }),
        signedReply(lookup, { request: { host: "other" } }),
        signedReply(lookup, { nonce: "stale" }),
        signedReply(lookup, { nonce: undefined }),
        signedReply(lookup),
    ];
    const result = await checkLightspeedFilter(
        { url: "https://example.com" },
        options,
    );
    expect(state.lookup).toMatchObject({
        action: "dy_lookup",
        host: "example.com",
    });
    expect(state.lookup.nonce).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(result._unsafeUnwrap().status).toBe("allowed");
});

it("keeps unsigned replies inconclusive", async () => {
    state.replies = lookup => {
        const { signature: _signature, ...unsigned } = signedReply(lookup);
        return [unsigned];
    };
    const result = await checkLightspeedFilter(
        { url: "https://example.com" },
        options,
    );
    expect(result._unsafeUnwrap().status).toBe("unknown");
});

it("ignores invalid signatures before a verified blocked reply", async () => {
    state.replies = lookup => [
        { ...signedReply(lookup), signature: "%" },
        { ...signedReply(lookup, { cat: 28 }), cat: 1 },
        signedReply(lookup, { cat: 28 }),
    ];
    const result = await checkLightspeedFilter(
        { url: "https://example.com" },
        options,
    );
    expect(result._unsafeUnwrap().status).toBe("blocked");
});

it("keeps a tampered category inconclusive", async () => {
    state.replies = lookup => [{ ...signedReply(lookup, { cat: 28 }), cat: 1 }];
    const result = await checkLightspeedFilter(
        { url: "https://example.com" },
        options,
    );
    expect(result._unsafeUnwrap().status).toBe("unknown");
});

it("rejects a reply signed by a key other than the configured production key", async () => {
    state.replies = lookup => [signedReply(lookup)];
    const result = await checkLightspeedFilter({ url: "https://example.com" });
    expect(result._unsafeUnwrap().status).toBe("unknown");
});

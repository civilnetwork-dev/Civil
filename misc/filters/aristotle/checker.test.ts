import { decode } from "@msgpack/msgpack";
import { beforeEach, expect, it, vi } from "vitest";

import { checkAristotleFilter } from "./checker";

const captured = vi.hoisted(() => ({
    url: "",
    packets: [] as Uint8Array[],
}));

vi.mock("ws", async () => {
    const { EventEmitter } = await import("node:events");
    return {
        WebSocket: class extends EventEmitter {
            constructor(url: string) {
                super();
                captured.url = url;
                queueMicrotask(() => this.emit("open"));
            }

            send(data: Uint8Array) {
                if (!(data instanceof Uint8Array)) {
                    this.emit("error", new Error("Expected MessagePack frame"));
                    return;
                }
                captured.packets.push(data);
                const request = decode(data) as Record<string, unknown>;
                const response =
                    request.cmd === 0
                        ? { cmd: 0, authenticated: true }
                        : { cmd: 2, _msgId: request._msgId, block: false };
                queueMicrotask(() => {
                    if (request.cmd === 2) {
                        this.emit(
                            "message",
                            Buffer.from(
                                JSON.stringify({
                                    cmd: 2,
                                    _msgId: "another-request",
                                    block: true,
                                }),
                            ),
                        );
                    }
                    this.emit("message", Buffer.from(JSON.stringify(response)));
                });
            }

            close() {
                this.emit("close");
            }
        },
    };
});

beforeEach(() => {
    captured.packets.length = 0;
});

it("uses the extension's binary framing and correlated RPC replies", async () => {
    const result = await checkAristotleFilter("https://example.org/path");

    expect(result.isOk()).toBe(true);
    if (result.isOk()) expect(result.value.status).toBe("allowed");
    expect(captured.packets).toHaveLength(2);
    const sessionId = new URL(captured.url).searchParams.get("ssId");
    expect(decode(captured.packets[0]!)).toEqual(
        expect.objectContaining({ cmd: 0, auth: true, guid: sessionId }),
    );
    expect(decode(captured.packets[1]!)).toEqual({
        cmd: 2,
        url: "https://example.org",
        type: "main_frame",
        _msgId: expect.any(String),
    });
});

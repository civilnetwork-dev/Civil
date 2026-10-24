import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
    vi.unstubAllGlobals();
});

/**
 * When the Wisp socket fails its handshake, epoxy-tls frees the socket's
 * wasm handlers but leaves them attached. A browser fires `error`, runs
 * microtasks (where the failed connect is dropped), then fires `close`, which
 * used to throw "closure invoked recursively or after being dropped" once per
 * failed connect. This fake socket fires its events in that same order.
 */
describe("epoxy transport after a failed Wisp handshake", () => {
    it("ignores the close event on the dropped socket", async () => {
        const thrown: unknown[] = [];
        const fire = (handler: (() => void) | null) => {
            try {
                handler?.();
            } catch (error) {
                thrown.push(error);
            }
        };

        vi.stubGlobal(
            "WebSocket",
            class {
                readyState = 0;
                onerror: (() => void) | null = null;
                onclose: (() => void) | null = null;

                constructor() {
                    setTimeout(async () => {
                        this.readyState = 3;
                        fire(this.onerror);
                        await new Promise(resolve => setTimeout(resolve, 0));
                        fire(this.onclose);
                    }, 0);
                }

                send() {}
                close() {}
            },
        );

        // The same dist/index.mjs that run.ts serves at /epoxy.
        const { default: EpoxyTransport } =
            await import("@mercuryworkshop/epoxy-transport");
        const transport = new EpoxyTransport({ wisp: "ws://127.0.0.1:1/" });
        await transport.init();

        await expect(
            transport.request(
                new URL("http://example.com/"),
                "GET",
                null,
                [],
                undefined,
            ),
        ).rejects.toThrow();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(thrown).toEqual([]);
    });
});

/** A Wisp version 1 frame: type, little-endian stream id, payload. */
function wispPacket(type: number, stream: number, payload: Uint8Array) {
    const frame = new Uint8Array(5 + payload.length);
    new DataView(frame.buffer).setUint8(0, type);
    new DataView(frame.buffer).setUint32(1, stream, true);
    frame.set(payload, 5);
    return frame.buffer;
}

/**
 * A proxied page's WebSocket goes out over a Wisp stream, and the remote
 * site answers the upgrade itself. Sites that refuse it (400, 404) used to
 * leave a rejected promise nobody handled, which PostHog recorded as
 * "Invalid websocket response status code: 400 != 101" on every refusal.
 */
describe("epoxy transport when a site refuses a WebSocket", () => {
    it("reports the refusal through onerror and leaves nothing unhandled", async () => {
        const unhandled: unknown[] = [];
        const onUnhandled = (reason: unknown) => unhandled.push(reason);
        process.on("unhandledRejection", onUnhandled);

        vi.stubGlobal(
            "WebSocket",
            class {
                readyState = 0;
                binaryType = "blob";
                onopen: ((event: Event) => void) | null = null;
                onmessage: ((event: { data: ArrayBuffer }) => void) | null =
                    null;
                onerror: (() => void) | null = null;
                onclose: (() => void) | null = null;

                constructor() {
                    setTimeout(() => {
                        this.readyState = 1;
                        this.onopen?.(new Event("open"));
                        // Version 1 servers open with the stream buffer size.
                        const size = new Uint8Array(4);
                        new DataView(size.buffer).setUint32(0, 128, true);
                        this.onmessage?.({ data: wispPacket(3, 0, size) });
                    }, 0);
                }

                send(data: Uint8Array) {
                    // epoxy sends a view into wasm memory, so copy it first.
                    const frame = new Uint8Array(data);
                    const stream = new DataView(frame.buffer).getUint32(
                        1,
                        true,
                    );
                    // The first DATA frame on a stream is the upgrade request.
                    if (frame[0] !== 2) return;
                    const refusal = new TextEncoder().encode(
                        "HTTP/1.1 400 Bad Request\r\ncontent-length: 0\r\n\r\n",
                    );
                    setTimeout(() =>
                        this.onmessage?.({
                            data: wispPacket(2, stream, refusal),
                        }),
                    );
                }

                close() {}
            },
        );

        const { default: EpoxyTransport } =
            await import("@mercuryworkshop/epoxy-transport");
        const transport = new EpoxyTransport({ wisp: "ws://127.0.0.1:1/" });
        await transport.init();

        const onopen = vi.fn();
        const onerror = vi.fn();
        transport.connect(
            new URL("ws://example.com/"),
            [],
            [],
            onopen,
            () => {},
            () => {},
            onerror,
        );

        try {
            await vi.waitFor(() => expect(onerror).toHaveBeenCalled());
            await new Promise(resolve => setTimeout(resolve, 50));
            expect(String(onerror.mock.calls[0]![0])).toContain("400 != 101");
            expect(onopen).not.toHaveBeenCalled();
            expect(unhandled).toEqual([]);
        } finally {
            process.off("unhandledRejection", onUnhandled);
        }
    });
});

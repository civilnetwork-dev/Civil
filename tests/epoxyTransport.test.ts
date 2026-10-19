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

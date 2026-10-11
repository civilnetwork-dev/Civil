import { afterEach, describe, expect, it, vi } from "vitest";

const { BareMuxConnection } = vi.hoisted(() => ({
    BareMuxConnection: vi.fn(),
}));
vi.mock("@mercuryworkshop/bare-mux", () => ({ BareMuxConnection }));
vi.mock("$config/service/filterDetect", () => ({ getFilters: vi.fn() }));

import { hasServiceWorker, setupBareMux } from "../src/lib/swUtils";

afterEach(() => {
    vi.unstubAllGlobals();
    BareMuxConnection.mockClear();
});

/**
 * bare-mux adds listeners to navigator.serviceWorker. On a browser with no
 * service worker (seen on iOS Safari) that threw an unhandled TypeError on
 * the new tab page.
 */
describe("setupBareMux without a service worker", () => {
    it("skips bare-mux even when SharedWorker exists", async () => {
        vi.stubGlobal("navigator", {});
        vi.stubGlobal("SharedWorker", class {});

        expect(hasServiceWorker()).toBe(false);
        await expect(setupBareMux()).resolves.toBeUndefined();
        expect(BareMuxConnection).not.toHaveBeenCalled();
    });
});

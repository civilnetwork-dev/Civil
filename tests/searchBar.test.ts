// @vitest-environment happy-dom
//
// A DOM is required: SearchBar reads localStorage and window/self globals, and
// its constructor wires a "submit" handler. happy-dom gives it all of those.
import { beforeEach, describe, expect, it, vi } from "vitest";

// SearchBar's constructor awaits these during setup, and submitFrame calls
// fetchBestProxy/measureAndReportCompat. Stub them so the test drives only the
// proxy-selection logic, with no service worker, bare-mux, or network.
vi.mock("../src/lib/swUtils", () => ({
    registerSw: vi.fn(async () => {}),
    setupBareMux: vi.fn(async () => {}),
}));
vi.mock("../src/lib/bestProxy", () => ({
    fetchBestProxy: vi.fn(async () => null),
    measureAndReportCompat: vi.fn(),
}));

import searchBar from "../src/lib/SearchBar";

beforeEach(() => {
    localStorage.clear();
    delete (window as any).scramjet;
    delete (window as any).scramjetReady;
    delete (self as any).__uv$config;
});

/**
 * submitFrame picks a proxy and navigates the frame. When it dereferences a
 * proxy controller that is not set up yet the whole search bar dies with an
 * uncaught TypeError, so the failure mode these tests guard is "typed a term,
 * got nothing".
 */
describe("SearchBar.submitFrame proxy readiness", () => {
    it("falls back to uv when the scramjet controller is not set yet", async () => {
        // Safari case: the scramjet bootstrap lands late, so window.scramjet and
        // window.scramjetReady are both unset when the user submits. uv is ready.
        (self as any).__uv$config = {
            encodeUrl: (s: string) => `enc:${s}`,
            decodeUrl: (s: string) => s,
        };

        const replace = vi.fn();
        const frame = { contentWindow: { location: { replace } } } as any;

        const bar = searchBar();
        await expect(bar.submitFrame(frame, "example.com")).resolves.toBe(
            undefined,
        );
        expect(replace).toHaveBeenCalledWith("/~/uv/enc:example.com");
    });

    it("uses the scramjet controller once it is ready", async () => {
        const sframe = { go: vi.fn() };
        (window as any).scramjet = {
            frames: [],
            createFrame: vi.fn(() => sframe),
        };
        localStorage.setItem("proxy", "scramjet");

        const bar = searchBar();
        await bar.submitFrame({} as any, "example.com");

        expect((window as any).scramjet.createFrame).toHaveBeenCalledTimes(1);
        expect(sframe.go).toHaveBeenCalledWith("https://example.com");
    });
});

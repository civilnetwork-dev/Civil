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
});

/**
 * submitFrame dereferences window.scramjet to navigate the frame. If it does
 * that before scramjet's bootstrap has actually assigned the global, the
 * whole search bar dies with an uncaught TypeError, so the failure mode these
 * tests guard is "typed a term, got nothing".
 */
describe("SearchBar.submitFrame proxy readiness", () => {
    it("waits for the real scramjetReady promise if window.scramjet is not set yet", async () => {
        // window.scramjetReady can still be unset when SearchBar's own
        // runSetup() reads it (the scramjet bootstrap script hasn't run yet),
        // so that await resolves immediately and `ready` resolving is no
        // guarantee scramjet is up. submitFrame must re-check and wait on the
        // real promise once it exists, instead of dereferencing an undefined
        // controller.
        const sframe = { go: vi.fn() };
        const bar = searchBar();
        await bar.ready; // resolves immediately: scramjetReady was still unset

        let resolveReady!: () => void;
        (window as any).scramjetReady = new Promise<void>(resolve => {
            resolveReady = resolve;
        });

        const submitted = bar.submitFrame({} as any, "example.com");
        // Flush microtasks so submitFrame reaches its readiness re-check and
        // starts awaiting the (now real) promise before we resolve it.
        await new Promise(resolve => setTimeout(resolve, 0));
        (window as any).scramjet = {
            frames: [],
            createFrame: vi.fn(() => sframe),
        };
        resolveReady();

        await submitted;
        expect((window as any).scramjet.createFrame).toHaveBeenCalledTimes(1);
        expect(sframe.go).toHaveBeenCalledWith("https://example.com");
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

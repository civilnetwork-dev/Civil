// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

// Fresh modules per test: the failover pick is session state by design.
let t: typeof import("./transport");
let settings: typeof import("./settings");

beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    t = await import("./transport");
    settings = await import("./settings");
});

const frame = () => ({});

describe("resolveTransport", () => {
    it("uses the default when nothing else applies", () => {
        expect(t.resolveTransport(frame(), "https://a.com")).toBe("epoxy");
        settings.setSetting("transport", "libcurl");
        expect(t.resolveTransport(frame(), "https://a.com")).toBe("libcurl");
        expect(t.lastTransportChoice()).toMatchObject({
            host: "a.com",
            transport: "libcurl",
            source: "default",
        });
    });

    it("lets a site rule beat the default", () => {
        settings.setSetting("transportSites", { "a.com": "bare" });
        expect(t.resolveTransport(frame(), "https://www.a.com/x")).toBe("bare");
        expect(t.lastTransportChoice()).toMatchObject({
            host: "a.com",
            transport: "bare",
            source: "site",
        });
    });

    it("lets an error-page choice beat everything, once", () => {
        settings.setSetting("transportSites", { "a.com": "bare" });
        const f = frame();
        t.retryWith(f, "libcurl");
        expect(t.resolveTransport(f, "https://a.com")).toBe("libcurl");
        expect(t.resolveTransport(f, "https://a.com")).toBe("bare");
    });

    it("records nothing for a search", () => {
        t.resolveTransport(frame(), "cats and dogs");
        expect(t.lastTransportChoice()).toBeNull();
    });

    it("forgets a stored choice from the automatic picker older builds had", () => {
        localStorage.setItem(
            "civil:transport-last",
            JSON.stringify({
                host: "a.com",
                transport: "libcurl",
                source: "auto",
                at: Date.now(),
            }),
        );
        expect(t.lastTransportChoice()).toBeNull();
    });
});

describe("transportKey", () => {
    it("builds Epoxy on Wisp version 2 unless told otherwise", () => {
        expect(t.transportKey("epoxy")).toBe("epoxy@2");
        settings.setSetting("wispVersion", "1");
        expect(t.transportKey("epoxy")).toBe("epoxy");
    });

    it("leaves libcurl and Bare alone", () => {
        settings.setSetting("wispVersion", "2");
        expect(t.transportKey("libcurl")).toBe("libcurl");
        expect(t.transportKey("bare")).toBe("bare");
    });
});

describe("rotateFrom", () => {
    it("fails over from the method the load actually used", () => {
        settings.setSetting("transport", "libcurl");
        const f = frame();
        t.resolveTransport(f, "https://a.com");
        expect(t.rotateFrom(f)).toBe("bare");
        // The rest of the session follows the failover.
        settings.setSetting("transport", "epoxy");
        expect(t.resolveTransport(frame(), "https://b.com")).toBe("bare");
    });

    it("remembers the method it switched to", () => {
        const f = frame();
        t.resolveTransport(f, "https://a.com");
        expect(t.rotateFrom(f)).toBe("libcurl");
        expect(settings.getSetting("transport")).toBe("libcurl");
    });

    it("keeps the default when remembering is off", () => {
        settings.setSetting("transportRemember", false);
        const f = frame();
        t.resolveTransport(f, "https://a.com");
        expect(t.rotateFrom(f)).toBe("libcurl");
        expect(localStorage.getItem("transport")).toBeNull();
    });

    it("does not rotate when failover is off, pinned, or out of methods", () => {
        const pinned = frame();
        settings.setSetting("transportSites", { "a.com": "epoxy" });
        t.resolveTransport(pinned, "https://a.com");
        expect(t.rotateFrom(pinned)).toBeNull();

        settings.setSetting("transport", "bare");
        const last = frame();
        t.resolveTransport(last, "https://b.com");
        expect(t.rotateFrom(last)).toBeNull();

        settings.setSetting("transportFailover", false);
        const off = frame();
        t.resolveTransport(off, "https://c.com");
        expect(t.rotateFrom(off)).toBeNull();
    });
});

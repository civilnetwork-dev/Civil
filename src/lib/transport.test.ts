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
        expect(t.resolveTransport(frame(), "https://a.com", undefined)).toBe(
            "epoxy",
        );
    });

    it("takes the best-proxy pick only while automatic picking is on", () => {
        expect(t.resolveTransport(frame(), "https://a.com", "libcurl")).toBe(
            "libcurl",
        );
        settings.setSetting("transportAuto", false);
        expect(t.resolveTransport(frame(), "https://a.com", "libcurl")).toBe(
            "epoxy",
        );
        expect(t.wantsBestProxy("https://a.com")).toBe(false);
    });

    it("ignores a pick this build does not know", () => {
        expect(t.resolveTransport(frame(), "https://a.com", "uv")).toBe(
            "epoxy",
        );
    });

    it("lets a site rule beat the automatic pick, and skips the probe", () => {
        settings.setSetting("transportSites", { "a.com": "bare" });
        expect(t.wantsBestProxy("https://www.a.com/x")).toBe(false);
        expect(
            t.resolveTransport(frame(), "https://www.a.com/x", "libcurl"),
        ).toBe("bare");
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
        expect(t.resolveTransport(f, "https://a.com", "epoxy")).toBe("libcurl");
        expect(t.resolveTransport(f, "https://a.com", "epoxy")).toBe("bare");
    });

    it("records nothing for a search", () => {
        t.resolveTransport(frame(), "cats and dogs", undefined);
        expect(t.lastTransportChoice()).toBeNull();
    });
});

describe("transportKey", () => {
    it("builds Epoxy on Wisp version 2 unless told otherwise", () => {
        expect(t.transportKey("epoxy")).toBe("epoxy@2");
        settings.setSetting("wispVersion", "1");
        expect(t.transportKey("epoxy")).toBe("epoxy");
    });

    it("follows the probe's pick when automatic, 2 without one", () => {
        settings.setSetting("wispVersion", "auto");
        expect(t.transportKey("epoxy", 1)).toBe("epoxy");
        expect(t.transportKey("epoxy", 2)).toBe("epoxy@2");
        expect(t.transportKey("epoxy")).toBe("epoxy@2");
        // With automatic Wisp the probe matters even for a pinned site.
        settings.setSetting("transportSites", { "a.com": "epoxy" });
        expect(t.wantsBestProxy("https://a.com")).toBe(true);
    });

    it("leaves libcurl and Bare alone", () => {
        expect(t.transportKey("libcurl", 2)).toBe("libcurl");
        expect(t.transportKey("bare", 2)).toBe("bare");
    });
});

describe("rotateFrom", () => {
    it("fails over from the method the load actually used", () => {
        const f = frame();
        t.resolveTransport(f, "https://a.com", "libcurl");
        expect(t.rotateFrom(f)).toBe("bare");
        // The rest of the session follows the failover, over later picks.
        expect(t.resolveTransport(frame(), "https://b.com", "epoxy")).toBe(
            "bare",
        );
        expect(settings.getSetting("transport")).toBe("bare");
    });

    it("keeps the default when remembering is off", () => {
        settings.setSetting("transportRemember", false);
        const f = frame();
        t.resolveTransport(f, "https://a.com", undefined);
        expect(t.rotateFrom(f)).toBe("libcurl");
        expect(localStorage.getItem("transport")).toBeNull();
    });

    it("does not rotate when failover is off, pinned, or out of methods", () => {
        const pinned = frame();
        settings.setSetting("transportSites", { "a.com": "epoxy" });
        t.resolveTransport(pinned, "https://a.com", undefined);
        expect(t.rotateFrom(pinned)).toBeNull();

        const last = frame();
        t.resolveTransport(last, "https://b.com", "bare");
        expect(t.rotateFrom(last)).toBeNull();

        settings.setSetting("transportFailover", false);
        const off = frame();
        t.resolveTransport(off, "https://c.com", undefined);
        expect(t.rotateFrom(off)).toBeNull();
    });
});

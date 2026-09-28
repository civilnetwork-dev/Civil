// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

import { onLsChange } from "~/lib/reactiveStorage";

import {
    getSetting,
    isSearchTemplate,
    needsSetup,
    normalizeHost,
    resetSettings,
    searchUrl,
    setSetting,
} from "./settings";

beforeEach(() => localStorage.clear());

describe("settings", () => {
    it("answers today's behaviour when nothing is stored", () => {
        expect(getSetting("transport")).toBe("epoxy");
        expect(getSetting("transportAuto")).toBe(true);
        expect(getSetting("navTimeout")).toBe(15);
        expect(getSetting("historyDays")).toBe(0);
        expect(getSetting("transportSites")).toEqual({});
    });

    it("reads the legacy raw keys as they were written", () => {
        localStorage.setItem("transport", "libcurl");
        localStorage.setItem("search", "ddg");
        expect(getSetting("transport")).toBe("libcurl");
        expect(getSetting("search")).toBe("ddg");
    });

    it("falls back on values this build does not know", () => {
        localStorage.setItem("transport", "uv");
        localStorage.setItem("civil:nav-timeout", "7");
        localStorage.setItem("civil:history-days", "-3");
        localStorage.setItem("civil:history-enabled", "yes");
        localStorage.setItem("civil:transport-sites", "{not json");
        expect(getSetting("transport")).toBe("epoxy");
        expect(getSetting("navTimeout")).toBe(15);
        expect(getSetting("historyDays")).toBe(0);
        expect(getSetting("historyEnabled")).toBe(true);
        expect(getSetting("transportSites")).toEqual({});
    });

    it("drops site rules with a bad host or method, keeps the rest", () => {
        localStorage.setItem(
            "civil:transport-sites",
            JSON.stringify({
                "discord.com": "libcurl",
                "www.x.com": "bare",
                "y.com": "uv",
            }),
        );
        expect(getSetting("transportSites")).toEqual({
            "discord.com": "libcurl",
        });
    });

    it("round-trips every kind of value and announces the write", () => {
        const heard = vi.fn();
        const stop = onLsChange("civil:history-enabled", heard);
        expect(setSetting("historyEnabled", false)).toBe(true);
        expect(getSetting("historyEnabled")).toBe(false);
        expect(heard).toHaveBeenCalledOnce();
        stop();

        setSetting("historyDays", 45);
        setSetting("transportSites", { "discord.com": "bare" });
        expect(getSetting("historyDays")).toBe(45);
        expect(getSetting("transportSites")).toEqual({ "discord.com": "bare" });
    });

    it("refuses a value outside the setting's options", () => {
        expect(setSetting("navTimeout", 7)).toBe(false);
        expect(localStorage.getItem("civil:nav-timeout")).toBeNull();
    });

    it("reports a write the browser refused", () => {
        const spy = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
            throw new DOMException("full", "QuotaExceededError");
        });
        expect(setSetting("search", "bing")).toBe(false);
        spy.mockRestore();
    });

    it("resets settings and leaves data alone", () => {
        setSetting("transport", "bare");
        localStorage.setItem("civil-history", "[]");
        localStorage.setItem("browser-session", "{}");
        resetSettings();
        expect(localStorage.getItem("transport")).toBeNull();
        expect(localStorage.getItem("civil-history")).toBe("[]");
        expect(localStorage.getItem("browser-session")).toBe("{}");
    });
});

describe("needsSetup", () => {
    it("is true for a first visit", () => {
        expect(needsSetup()).toBe(true);
    });

    it("marks someone who used Civil before as done", () => {
        localStorage.setItem("browser-session", "{}");
        expect(needsSetup()).toBe(false);
        expect(localStorage.getItem("civil:setup-complete")).toBe("existing");
    });
});

describe("search", () => {
    it("builds the engine's address", () => {
        setSetting("search", "ddg");
        expect(searchUrl("a b")).toBe("https://duckduckgo.com/?q=a%20b");
    });

    it("uses a valid custom template and falls back from a broken one", () => {
        setSetting("search", "custom");
        setSetting("searchTemplate", "https://kagi.com/search?q=%s");
        expect(searchUrl("x")).toBe("https://kagi.com/search?q=x");
        expect(setSetting("searchTemplate", "javascript:alert(%s)")).toBe(
            false,
        );
        localStorage.setItem("civil:search-template", "javascript:alert(%s)");
        expect(searchUrl("x")).toBe("https://www.google.com/search?q=x");
    });

    it("refuses a start page that isn't a web page", () => {
        expect(setSetting("startupUrl", "javascript:alert(1)")).toBe(false);
        expect(setSetting("startupUrl", "data:text/html,hi")).toBe(false);
        expect(setSetting("startupUrl", "example.com/news")).toBe(true);
        expect(setSetting("startupUrl", "browser:history")).toBe(true);
    });

    it("accepts only web addresses with %s", () => {
        expect(isSearchTemplate("https://e.com/?q=%s")).toBe(true);
        expect(isSearchTemplate("https://e.com/?q=")).toBe(false);
        expect(isSearchTemplate("ftp://e.com/%s")).toBe(false);
    });
});

describe("normalizeHost", () => {
    it("keys a site the way the rules store it", () => {
        expect(normalizeHost("https://www.Discord.com/app")).toBe(
            "discord.com",
        );
        expect(normalizeHost("discord.com")).toBe("discord.com");
        expect(normalizeHost("not a host")).toBeNull();
        expect(normalizeHost("localhost")).toBeNull();
    });
});

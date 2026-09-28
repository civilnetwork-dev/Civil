// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import { getSetting, setSetting } from "./settings";
import { exportSettings, importSettings } from "./settingsTransfer";

beforeEach(() => localStorage.clear());

describe("settings transfer", () => {
    it("round-trips every setting through a file", () => {
        setSetting("search", "ddg");
        setSetting("transportSites", { "discord.com": "libcurl" });
        setSetting("historyExclude", ["youtube.com"]);
        setSetting("analytics", false);
        const file = exportSettings();

        localStorage.clear();
        const result = importSettings(file);

        expect(result).toMatchObject({ ok: true, skipped: [] });
        expect(getSetting("search")).toBe("ddg");
        expect(getSetting("transportSites")).toEqual({
            "discord.com": "libcurl",
        });
        expect(getSetting("historyExclude")).toEqual(["youtube.com"]);
        expect(getSetting("analytics")).toBe(false);
    });

    it("skips what this build doesn't know or wouldn't accept", () => {
        const result = importSettings(
            JSON.stringify({
                format: "civil-settings",
                version: 1,
                settings: {
                    search: "bing",
                    navTimeout: "soon",
                    startupUrl: "javascript:alert(1)",
                    searchTemplate: { evil: true },
                    somethingNew: 1,
                },
            }),
        );
        expect(result).toEqual({
            ok: true,
            applied: ["search"],
            skipped: [
                "navTimeout",
                "startupUrl",
                "searchTemplate",
                "somethingNew",
            ],
        });
        expect(localStorage.getItem("civil:startup-url")).toBeNull();
        expect(localStorage.getItem("civil:search-template")).toBeNull();
    });

    it("refuses something that isn't a settings file", () => {
        expect(importSettings("not json").ok).toBe(false);
        expect(importSettings(JSON.stringify({ settings: {} })).ok).toBe(false);
        expect(
            importSettings(
                JSON.stringify({
                    format: "civil-settings",
                    version: 9,
                    settings: {},
                }),
            ),
        ).toMatchObject({ ok: false, reason: expect.stringMatching(/newer/) });
    });
});

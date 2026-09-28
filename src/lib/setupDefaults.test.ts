import { describe, expect, it } from "vitest";

import { pickSetupDefaults, type SetupEnv } from "./setupDefaults";

const CHROME =
    "Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36";

const device = (over: Partial<SetupEnv> = {}): SetupEnv => ({
    userAgent: CHROME,
    brave: false,
    privacySignal: false,
    saveData: false,
    effectiveType: "4g",
    cores: 8,
    memoryGb: 8,
    reducedMotion: false,
    viewportHeight: 900,
    quota: 50 * 1024 ** 3,
    webSocketWorks: async () => true,
    ...over,
});

describe("pickSetupDefaults", () => {
    it("picks today's defaults on an ordinary device", async () => {
        const p = await pickSetupDefaults(device());
        expect(p.search?.value).toBe("google");
        expect(p.transport?.value).toBe("epoxy");
        expect(p.transportAuto?.value).toBe(true);
        expect(p.navTimeout?.value).toBe(15);
        expect(p.suggestLive?.value).toBe(true);
        expect(p.historyFormat?.value).toBe("json");
        expect(p.historyDays?.value).toBe(90);
        expect(p.bookmarksBar?.value).toBe("always");
        expect(p.motion?.value).toBe("system");
    });

    it("matches the browser's own search engine, then privacy wishes", async () => {
        expect(
            (await pickSetupDefaults(device({ brave: true }))).search?.value,
        ).toBe("brave");
        expect(
            (
                await pickSetupDefaults(
                    device({ userAgent: `${CHROME} Edg/139.0.0.0` }),
                )
            ).search?.value,
        ).toBe("bing");
        expect(
            (await pickSetupDefaults(device({ privacySignal: true }))).search
                ?.value,
        ).toBe("ddg");
    });

    it("starts on Bare when WebSockets are blocked", async () => {
        const p = await pickSetupDefaults(
            device({ webSocketWorks: async () => false }),
        );
        expect(p.transport?.value).toBe("bare");
        expect(p.transport?.reason).toMatch(/WebSocket/);
    });

    it("gives a slow or data-saving connection more time and no suggestions", async () => {
        expect(
            (await pickSetupDefaults(device({ effectiveType: "3g" })))
                .navTimeout?.value,
        ).toBe(30);
        const saving = await pickSetupDefaults(device({ saveData: true }));
        expect(saving.navTimeout?.value).toBe(30);
        expect(saving.suggestLive?.value).toBe(false);
    });

    it("reduces motion on a light device or when the device asks", async () => {
        expect(
            (await pickSetupDefaults(device({ cores: 2 }))).motion?.value,
        ).toBe("reduce");
        expect(
            (await pickSetupDefaults(device({ memoryGb: 1 }))).motion?.value,
        ).toBe("reduce");
        expect(
            (await pickSetupDefaults(device({ reducedMotion: true }))).motion
                ?.value,
        ).toBe("reduce");
    });

    it("keeps the bookmarks bar to new tabs on a short screen", async () => {
        expect(
            (await pickSetupDefaults(device({ viewportHeight: 650 })))
                .bookmarksBar?.value,
        ).toBe("newtab");
    });

    it("compresses and shortens history when storage is tight", async () => {
        const p = await pickSetupDefaults(device({ quota: 300 * 1024 ** 2 }));
        expect(p.historyFormat?.value).toBe("compressed");
        expect(p.historyDays?.value).toBe(30);
    });

    it("explains every pick", async () => {
        const p = await pickSetupDefaults(device());
        for (const pick of Object.values(p)) {
            expect(pick?.reason).toMatch(/\.$/);
        }
    });
});

// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initBiB } from "./util";
import { buildWindowsAPI } from "./windows";

/**
 * chrome.windows in the shim: one synthetic window built from the host's
 * config, and window creation turned into a Civil tab.
 */
describe("buildWindowsAPI", () => {
    afterEach(() => initBiB(undefined, ""));

    it("describes one normal, focused window by default", async () => {
        initBiB(undefined, "https://civil.test");
        const win = await buildWindowsAPI().getCurrent();
        expect(win).toMatchObject({
            id: 1,
            focused: true,
            incognito: false,
            state: "normal",
            type: "normal",
            tabs: [],
        });
    });

    it("takes the host's window details and incognito flag", async () => {
        initBiB(
            {
                incognito: true,
                currentWindow: { id: 7, state: "maximized", width: 640 },
            },
            "https://civil.test",
        );
        const win = await buildWindowsAPI().get(7);
        expect(win).toMatchObject({
            id: 7,
            incognito: true,
            state: "maximized",
            width: 640,
        });
    });

    it("hands the result to a callback passed in place of the query", async () => {
        const cb = vi.fn();
        await buildWindowsAPI().getAll(cb);
        expect(cb).toHaveBeenCalledWith([expect.objectContaining({ id: 1 })]);
    });

    it("opens a window's first URL as a new Civil tab", async () => {
        initBiB(undefined, "https://civil.test");
        const onNewTab = vi.fn();
        document.addEventListener("browser:newtab", onNewTab);
        await buildWindowsAPI().create({
            url: ["https://a.test/", "https://b.test/"],
        });
        document.removeEventListener("browser:newtab", onNewTab);
        expect(onNewTab).toHaveBeenCalledTimes(1);
        expect((onNewTab.mock.calls[0]![0] as CustomEvent).detail).toEqual({
            url: "https://a.test/",
        });
    });
});

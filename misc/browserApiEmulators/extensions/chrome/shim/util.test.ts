/**
 * The shim's browser-in-browser config: whatever the host passes wins, and
 * anything it leaves out, or sets to null, keeps its default.
 */

import { describe, expect, it } from "vitest";

import type { BiBConfig } from "../types";
import { getBiB, initBiB } from "./util";

describe("initBiB", () => {
    it("fills every setting the host leaves out from the defaults", () => {
        initBiB(undefined, "https://civil.test");
        const bib = getBiB();
        expect(bib.origin).toBe("https://civil.test");
        expect(bib.extPrefix).toBe("/civil-ext/");
        expect(bib.storagePersistence).toBe("localStorage");
        expect(bib.platformInfo).toEqual({
            os: "win",
            arch: "x86-64",
            nacl_arch: "x86-64",
        });
        expect(bib.incognito).toBe(false);
    });

    it("keeps the host's values and treats null like a missing one", () => {
        initBiB(
            {
                origin: "https://other.test",
                storagePersistence: "sessionStorage",
                incognito: true,
                newTabEvent: null,
                platformInfo: { os: "cros" },
                currentTab: { url: "https://example.com/" },
            } as unknown as BiBConfig,
            "https://civil.test",
        );
        const bib = getBiB();
        expect(bib.origin).toBe("https://other.test");
        expect(bib.storagePersistence).toBe("sessionStorage");
        expect(bib.incognito).toBe(true);
        expect(bib.newTabEvent).toBe("browser:newtab");
        expect(bib.platformInfo).toEqual({
            os: "cros",
            arch: "x86-64",
            nacl_arch: "x86-64",
        });
        expect(bib.currentTab).toEqual({ url: "https://example.com/" });
    });
});

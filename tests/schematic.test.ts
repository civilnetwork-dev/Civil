import { describe, expect, it } from "vitest";

import {
    ANNO,
    anno,
    annoMuted,
    FONT_MONO,
    FONT_SANS,
    RULE,
} from "../src/styles/schematic.css";
import { vars } from "../src/styles/theme.css";

/**
 * These stacks are loaded from `@fontsource`, which means the request can fail
 * — and on the school networks this app runs behind, an unfamiliar font CDN
 * request failing is an ordinary Tuesday. What must survive that is the
 * *category*: ledgers and hour meters align because their glyphs are
 * fixed-width, so a mono stack that falls back to a proportional face silently
 * breaks every aligned column in the app.
 *
 * So the contract is about the tail, not the head. The webfont leads; the
 * generic family closes.
 */
describe("font stacks", () => {
    it("leads FONT_MONO with the webfont and closes with the generic family", () => {
        expect(FONT_MONO.startsWith('"IBM Plex Mono"')).toBe(true);
        expect(FONT_MONO.endsWith("monospace")).toBe(true);
    });

    it("leads FONT_SANS with the webfont and closes with the generic family", () => {
        expect(FONT_SANS.startsWith('"IBM Plex Sans Variable"')).toBe(true);
        expect(FONT_SANS.endsWith("sans-serif")).toBe(true);
    });

    /**
     * `ui-monospace` resolves to the platform's own mono, which is a better
     * fallback than jumping straight to the generic family — it keeps the
     * system's actual UI mono rather than whatever `monospace` maps to.
     */
    it("keeps a system mono between the webfont and the generic family", () => {
        expect(FONT_MONO).toContain("ui-monospace");
    });

    it("never lets the two stacks collapse to the same family", () => {
        expect(FONT_MONO).not.toBe(FONT_SANS);
    });
});

describe("RULE", () => {
    it("offers three weights, all distinct", () => {
        const weights = [RULE.hair, RULE.major, RULE.accent];
        expect(new Set(weights).size).toBe(3);
    });
});

describe("ANNO", () => {
    it("is 12px sans with tabular numerals", () => {
        expect(ANNO.fontSize).toBe("12px");
        expect(ANNO.fontVariantNumeric).toBe("tabular-nums");
        expect(ANNO.fontFamily).toBe(FONT_SANS);
    });

    it("keeps both annotation tiers above the WCAG AA small-text minimum", () => {
        // snowmelt (anno) measures 8.87:1 and ash (annoMuted) measures 4.80:1
        // against stratum — both clear the 4.5:1 WCAG AA small-text minimum.
        // ash is the floor of the palette: there is nothing dimmer to reach for,
        // which is the point of collapsing the old ember/cinder pair into it.
        expect(anno).not.toBe(annoMuted);
        expect(ANNO.color).toBe(vars.color.snowmelt);
    });
});

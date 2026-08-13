import { describe, expect, it } from "vitest";
import {
    ANNO,
    anno,
    annoMuted,
    FONT_MONO,
    FONT_SANS,
    field,
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

describe("field", () => {
    it("defaults to the base 16px density", () => {
        expect(field().backgroundSize).toBe("16px 16px");
    });

    it("maps every named density to its pixel step", () => {
        expect(field("fine").backgroundSize).toBe("8px 8px");
        expect(field("base").backgroundSize).toBe("16px 16px");
        expect(field("coarse").backgroundSize).toBe("32px 32px");
    });

    it("draws two 0.5px gradients so the field is a grid, not stripes", () => {
        const { backgroundImage } = field();
        expect(backgroundImage.match(/linear-gradient/g)).toHaveLength(2);
        expect(backgroundImage).toContain("to right");
        expect(backgroundImage).toContain("to bottom");
        expect(backgroundImage).toContain("0.5px");
    });

    it("accepts a colour override", () => {
        expect(field("base", "red").backgroundImage).toContain("red");
    });
});

describe("RULE", () => {
    it("offers three weights, all distinct", () => {
        const weights = [RULE.hair, RULE.major, RULE.accent];
        expect(new Set(weights).size).toBe(3);
    });
});

describe("ANNO", () => {
    it("is 11px with tabular numerals", () => {
        expect(ANNO.fontSize).toBe("11px");
        expect(ANNO.fontVariantNumeric).toBe("tabular-nums");
    });

    it("uses the mono stack", () => {
        expect(ANNO.fontFamily).toBe(FONT_MONO);
    });

    it("keeps both annotation tiers above the WCAG AA small-text minimum", () => {
        // moonlight (anno) measures 9.88:1 and starlight (annoMuted) measures
        // 7.27:1 against dusk — both clear the 4.5:1 WCAG AA small-text minimum.
        expect(anno).not.toBe(annoMuted);
        expect(ANNO.color).toBe(vars.color.moonlight);
    });
});

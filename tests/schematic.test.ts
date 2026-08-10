import { describe, expect, it } from "vitest";
import {
    ANNO,
    anno,
    annoMuted,
    FONT_MONO,
    field,
    RULE,
} from "../src/styles/schematic.css";
import { vars } from "../src/styles/theme.css";

describe("FONT_MONO", () => {
    it("starts with ui-monospace and ends with the generic family", () => {
        expect(FONT_MONO.startsWith("ui-monospace")).toBe(true);
        expect(FONT_MONO.endsWith("monospace")).toBe(true);
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
        // overlay1 measures 4.14:1 on base and fails AA; overlay2 is 5.29:1.
        expect(anno).not.toBe(annoMuted);
        expect(ANNO.color).toBe(vars.color.subtext0);
    });
});

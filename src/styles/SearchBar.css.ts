import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { DUR, EASE } from "./material.css";
import { ANNO, FONT_MONO, FONT_SANS, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The New Tab omnibox.
 *
 * This is the single control on the highest-traffic page in the app, and it
 * was the last thing still built from the superseded material language:
 * `machined()` faces, `lit()` top edges, `SHADOW.resting`, a 3px `focusRing`
 * halo and a 14px radius. schematic.css.ts states plainly that those and the
 * ruled-drawing language do not coexist on one page — and the star chart
 * behind this field is as ruled as the app gets.
 *
 * It is now a ruled field: one hairline underline that turns sirius on focus,
 * square corners, mono for the thing being typed, because what goes in here is
 * an address. The suggestions hang off it as a ruled list, not as a menu
 * floating on a shadow.
 */

export const sbHost = style({
    position: "fixed",
    inset: 0,
    zIndex: 9999,
    pointerEvents: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const sbRoot = style({
    pointerEvents: "all",
    position: "relative",
    fontFamily: FONT_SANS,
    width: "min(640px, 90vw)",
});

const dropdownIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const sbDropdown = style({
    position: "absolute",
    top: "100%",
    left: 0,
    width: "100%",
    zIndex: 10000,
    background: vars.color.basalt,
    border: `1px solid ${vars.color.talus}`,
    borderTop: "none",
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    animation: `${dropdownIn} ${DUR.base} ${EASE.enter} both`,
});

/**
 * The variant used when the omnibox floats over a loaded page rather than the
 * New Tab sheet.
 *
 * It carries no `backdrop-filter`. DESIGN.md forbids it outright and names the
 * reason — the target hardware is low-end school Chromebooks, where compositing
 * a blurred backdrop on every frame is one of the most expensive things a page
 * can ask for. The previous rule also applied `saturate(1.5)`, which shifted
 * every hue behind it; on a product whose whole subject is a measured colour
 * field, that is the one effect it must never use.
 *
 * A near-opaque `night` ground separates the menu from the page underneath just
 * as well, costs nothing, and is what the rest of the drawing language does.
 */
export const sbDropdownBlur = style({
    background: `color-mix(in srgb, ${vars.color.basalt} 96%, transparent)`,
    borderColor: vars.color.talus,
    borderTop: "none",
});

export const sbRow = style({
    position: "relative",
    cursor: "pointer",
    padding: "10px 14px",
    color: vars.color.snowmelt,
    fontFamily: FONT_MONO,
    fontSize: "13px",
    transitionProperty: "background, color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        // A plain hairline. The gradient-faded inset rule this replaced was
        // making the menu read as one soft surface; the drawing language rules
        // cells apart instead.
        "& + &::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 0,
            borderTop: RULE.hair,
        },
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 12%, transparent)`,
            color: vars.color.firn,
        },
    },
});

export const sbInputWrapper = style({
    display: "flex",
    alignItems: "stretch",
    height: "48px",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${vars.color.talus}`,
    transitionProperty: "border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.cobalt },
    },
});

/**
 * Docked state. The field keeps its accent underline while the menu is open so
 * the two read as one control; the menu's own border picks up from there.
 */
globalStyle(`.${sbRoot}:has(.${sbDropdown}) .${sbInputWrapper}`, {
    borderBottomColor: vars.color.cobalt,
});

export const sbInputWrapperBlur = style({
    background: "transparent",
});

export const sbInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: vars.color.firn,
    // An address is data. It is also the one string on this page where telling
    // rn from m matters, so it is set in mono like every other address in the
    // app.
    fontFamily: FONT_MONO,
    fontSize: "15px",
    padding: "0 4px",
    outline: "none",
    caretColor: vars.color.cobalt,
    selectors: {
        "&::placeholder": { color: vars.color.ash },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 28%, transparent)`,
        },
    },
});

export const sbHostInline = style({
    display: "flex",
    justifyContent: "center",
    width: "100%",
    pointerEvents: "all",
});

export const sbButton = style({
    ...ANNO,
    flexShrink: 0,
    position: "relative",
    border: "none",
    borderLeft: RULE.hair,
    background: "transparent",
    color: vars.color.snowmelt,
    textTransform: "uppercase",
    padding: "0 20px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transitionProperty: "background, color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 12%, transparent)`,
            color: vars.color.cobalt,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.cobalt} 20%, transparent)`,
            color: vars.color.cobalt,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "-1px",
        },
    },
});

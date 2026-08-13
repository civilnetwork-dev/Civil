import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { DUR, EASE } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
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
    fontFamily: '"Rubik", sans-serif',
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
    background: vars.color.night,
    border: `1px solid ${vars.color.haze}`,
    borderTop: "none",
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    animation: `${dropdownIn} ${DUR.base} ${EASE.enter} both`,
});

/**
 * The translucent variant, kept because the New Tab page can show the star
 * chart through it. The saturate() boost is gone — it shifted the palette's
 * hues wherever it applied, which on a page whose whole subject is a measured
 * colour field is the one thing it must not do.
 */
export const sbDropdownBlur = style({
    background: `color-mix(in srgb, ${vars.color.night} 82%, transparent)`,
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    borderColor: `color-mix(in srgb, ${vars.color.haze} 70%, transparent)`,
    borderTop: "none",
});

export const sbRow = style({
    position: "relative",
    cursor: "pointer",
    padding: "10px 14px",
    color: vars.color.moonlight,
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
            background: `color-mix(in srgb, ${vars.color.sirius} 12%, transparent)`,
            color: vars.color.daylight,
        },
    },
});

export const sbInputWrapper = style({
    display: "flex",
    alignItems: "stretch",
    height: "48px",
    background: "transparent",
    border: "none",
    borderBottom: `1px solid ${vars.color.haze}`,
    transitionProperty: "border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.sirius },
    },
});

/**
 * Docked state. The field keeps its accent underline while the menu is open so
 * the two read as one control; the menu's own border picks up from there.
 */
globalStyle(`.${sbRoot}:has(.${sbDropdown}) .${sbInputWrapper}`, {
    borderBottomColor: vars.color.sirius,
});

export const sbInputWrapperBlur = style({
    background: "transparent",
});

export const sbInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: vars.color.daylight,
    // An address is data. It is also the one string on this page where telling
    // rn from m matters, so it is set in mono like every other address in the
    // app.
    fontFamily: FONT_MONO,
    fontSize: "15px",
    padding: "0 4px",
    outline: "none",
    caretColor: vars.color.sirius,
    selectors: {
        "&::placeholder": { color: vars.color.cinder },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.sirius} 28%, transparent)`,
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
    color: vars.color.moonlight,
    textTransform: "uppercase",
    padding: "0 20px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transitionProperty: "background, color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.sirius} 12%, transparent)`,
            color: vars.color.sirius,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.sirius} 20%, transparent)`,
            color: vars.color.sirius,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.sirius}`,
            outlineOffset: "-1px",
        },
    },
});

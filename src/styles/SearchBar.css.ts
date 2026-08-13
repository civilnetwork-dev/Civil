import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { DUR, EASE, focusRing, lit, machined, SHADOW } from "./material.css";
import { vars } from "./theme.css";

const blurBackground = `color-mix(in srgb, ${vars.color.horizon} 65%, transparent)`;
const blurBorder = `color-mix(in srgb, ${vars.color.haze} 55%, transparent)`;
const blurFilter = "blur(20px) saturate(1.5)";

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

/**
 * The suggestions menu hangs directly off the omnibox, so it has to be built
 * from the same parts: same 14px corner radius, same machined fill, and the
 * accent border the field takes on focus. It also sits over the field's
 * bottom border rather than below it, so the two read as one surface with no
 * hairline seam across the join - the same construction as the Select menu.
 */
export const sbDropdown = style({
    position: "absolute",
    top: "calc(100% - 1px)",
    left: 0,
    width: "100%",
    zIndex: 10000,
    background: machined(
        vars.color.horizon,
        `color-mix(in srgb, ${vars.color.horizon} 78%, ${vars.color.night})`,
    ),
    border: `1px solid color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
    borderTop: "none",
    borderRadius: "0 0 14px 14px",
    overflow: "hidden",
    listStyle: "none",
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
    // Docked, not free-floating: `SHADOW.menu` blurs upward and paints a dark
    // band across the join with the field above.
    boxShadow: SHADOW.attached,
    animation: `${dropdownIn} ${DUR.base} ${EASE.enter} both`,
});

export const sbDropdownBlur = style({
    background: blurBackground,
    backdropFilter: blurFilter,
    borderColor: blurBorder,
    borderTop: "none",
});

export const sbRow = style({
    position: "relative",
    cursor: "pointer",
    padding: "10px 16px",
    color: vars.color.moonlight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "14px",
    fontWeight: 400,
    transitionProperty: "background, color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        // Inset, fading divider rather than an edge-to-edge rule - the menu
        // is a single surface, not a stack of separate cells.
        "& + &::before": {
            content: '""',
            position: "absolute",
            top: 0,
            left: "16px",
            right: "16px",
            height: "1px",
            background: `linear-gradient(90deg, transparent, ${vars.color.haze} 15%, ${vars.color.haze} 85%, transparent)`,
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
    height: "52px",
    // A machined face rather than a flat fill, lit along its top edge. This
    // is the only control on the New Tab page, so it carries the material
    // language by itself.
    background: machined(
        vars.color.horizon,
        `color-mix(in srgb, ${vars.color.horizon} 78%, ${vars.color.night})`,
    ),
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "14px",
    overflow: "hidden",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "border-color, border-radius, background, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": {
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
            boxShadow: lit(focusRing(vars.color.sirius), true),
        },
    },
});

/**
 * Docked state. The focus ring is dropped here on purpose: it is a 3px halo
 * around the *field* only, so once the suggestions are attached it wrapped
 * half the control and was sliced off where the menu overlapped it. The
 * shared lavender border carries the focus signal across both parts instead.
 */
globalStyle(`.${sbRoot}:has(.${sbDropdown}) .${sbInputWrapper}`, {
    borderRadius: "14px 14px 0 0",
    borderBottomColor: "transparent",
    borderColor: `color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
    boxShadow: lit(SHADOW.resting),
});
export const sbInputWrapperBlur = style({
    background: blurBackground,
    backdropFilter: blurFilter,
    borderColor: blurBorder,
});

export const sbInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    color: vars.color.daylight,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "15px",
    fontWeight: 400,
    padding: "0 16px",
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
    flexShrink: 0,
    border: "none",
    // A hairline separator that fades at both ends, so the button reads as
    // part of the same machined face rather than a second component welded
    // on. This is the page's primary action, so it also carries the Label
    // tier's tracking instead of sitting at body weight.
    borderLeft: "none",
    position: "relative",
    background: "transparent",
    color: vars.color.moonlight,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "0 22px",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transitionProperty: "background, color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            top: "22%",
            bottom: "22%",
            width: "1px",
            background: `linear-gradient(to bottom, transparent, ${vars.color.haze} 30%, ${vars.color.haze} 70%, transparent)`,
        },
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.sirius} 12%, transparent)`,
            color: vars.color.sirius,
        },
        "&:active": {
            background: `color-mix(in srgb, ${vars.color.sirius} 20%, transparent)`,
            color: vars.color.sirius,
        },
    },
});

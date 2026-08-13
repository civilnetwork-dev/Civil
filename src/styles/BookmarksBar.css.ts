import { globalStyle, style } from "@vanilla-extract/css";
import { hitArea } from "./material.css";
import { ANNO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * The shelf.
 *
 * A single ruled strip under the identification row, holding square chips.
 * Rounded chips read as buttons floating on a toolbar; square ones ruled apart
 * read as labelled positions on a shelf, which is what the chrome's language
 * asks for.
 */

const T_FAST = "0.1s ease";

export const bar = style({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "28px",
    padding: "0 10px",
    background: vars.color.void,
    borderBottom: RULE.hair,
    overflowX: "auto",
    overflowY: "hidden",
    flexShrink: 0,
    selectors: {
        "&::-webkit-scrollbar": { display: "none" },
    },
});

export const bookmark = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "0 8px",
    height: "22px",
    cursor: "pointer",
    color: vars.color.halo,
    background: "transparent",
    border: "1px solid transparent",
    fontSize: "12px",
    fontFamily: '"Rubik", sans-serif',
    fontWeight: 400,
    whiteSpace: "nowrap",
    flexShrink: 0,
    maxWidth: "170px",
    transition: `background ${T_FAST}, color ${T_FAST}, border-color ${T_FAST}`,
    transitionDuration: "0.1s",
    position: "relative",
    selectors: {
        // 22px tall by design - the whole bar is only 28px - so the pointer
        // target is expanded to 24 without changing how the chip looks.
        "&::after": hitArea(),
        "&:hover": {
            background: vars.color.night,
            color: vars.color.daylight,
            borderColor: vars.color.horizon,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.sirius}`,
            outlineOffset: "-1px",
        },
    },
});

export const bookmarkFavicon = style({
    width: "12px",
    height: "12px",
    objectFit: "contain",
    flexShrink: 0,
});

export const bookmarkFaviconFallback = style({
    width: "12px",
    height: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.color.cinder,
});

export const bookmarkLabel = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
});

/**
 * Hidden until the chip is hovered or holds focus — but with opacity, not
 * `display: none`. Display-none removes an element from the tab order
 * outright, so this control was unreachable by keyboard entirely: there was no
 * sequence of keys that could delete a bookmark from the bar. `pointer-events`
 * is what stops an invisible button from swallowing clicks meant for the chip.
 */
export const bookmarkRemove = style({
    // Sits above the chip's expanded hit-area overlay, which would otherwise
    // paint over it and swallow the click.
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    background: "transparent",
    border: "none",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    opacity: 0,
    pointerEvents: "none",
    transition: `color ${T_FAST}, opacity ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": { color: vars.color.antares },
        "&:focus-visible": {
            opacity: 1,
            pointerEvents: "auto",
            outline: `1px solid ${vars.color.sirius}`,
            outlineOffset: "1px",
        },
    },
});

globalStyle(
    `.${bookmark}:hover .${bookmarkRemove}, .${bookmark}:focus-within .${bookmarkRemove}`,
    { opacity: 1, pointerEvents: "auto" },
);

// Touch has no hover to reveal the control, so it is always available there.
globalStyle(`.${bookmarkRemove}`, {
    "@media": {
        "(hover: none)": { opacity: 1, pointerEvents: "auto" },
    },
});

export const separator = style({
    width: 0,
    height: "14px",
    borderLeft: RULE.hair,
    flexShrink: 0,
    margin: "0 4px",
});

export const addBookmarkBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    border: `0.5px solid ${vars.color.horizon}`,
    background: "transparent",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `background ${T_FAST}, color ${T_FAST}, border-color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            color: vars.color.sirius,
            borderColor: vars.color.sirius,
        },
        "&:focus-visible": {
            outline: `1px solid ${vars.color.sirius}`,
            outlineOffset: "1px",
        },
    },
});

export const emptyHint = style({
    ...ANNO,
    color: vars.color.starlight,
    paddingLeft: "4px",
    userSelect: "none",
});

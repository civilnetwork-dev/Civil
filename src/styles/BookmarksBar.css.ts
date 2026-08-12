import { globalStyle, style } from "@vanilla-extract/css";
import { hitArea } from "./material.css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

export const bar = style({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "30px",
    padding: "0 10px",
    background: vars.color.void,
    borderBottom: `1px solid ${vars.color.horizon}`,
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
    gap: "5px",
    padding: "0 8px",
    height: "22px",
    borderRadius: "6px",
    cursor: "pointer",
    color: vars.color.halo,
    background: "transparent",
    border: "none",
    fontSize: "12px",
    fontFamily: '"Rubik", sans-serif',
    fontWeight: 400,
    whiteSpace: "nowrap",
    flexShrink: 0,
    maxWidth: "160px",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    position: "relative",
    selectors: {
        // 22px tall by design - the whole bar is only 30px - so the pointer
        // target is expanded to 24 without changing how the chip looks.
        "&::after": hitArea(),
        "&:hover": {
            background: vars.color.horizon,
            color: vars.color.daylight,
        },
    },
});

export const bookmarkFavicon = style({
    width: "12px",
    height: "12px",
    borderRadius: "2px",
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

export const bookmarkRemove = style({
    // Sits above the chip's expanded hit-area overlay, which would otherwise
    // paint over it and swallow the click.
    position: "relative",
    zIndex: 1,
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    borderRadius: "3px",
    background: "transparent",
    border: "none",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `color ${T_FAST}, background ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            color: vars.color.antares,
            background: `color-mix(in srgb, ${vars.color.antares} 15%, transparent)`,
        },
    },
});

globalStyle(`.${bookmark}:hover .${bookmarkRemove}`, {
    display: "flex",
});

export const separator = style({
    width: "1px",
    height: "16px",
    background: vars.color.haze,
    flexShrink: 0,
    margin: "0 2px",
});

export const addBookmarkBtn = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "22px",
    height: "22px",
    borderRadius: "6px",
    border: "none",
    background: "transparent",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            background: vars.color.horizon,
            color: vars.color.sirius,
        },
    },
});

export const emptyHint = style({
    fontSize: "11.5px",
    color: vars.color.cinder,
    fontFamily: '"Rubik", sans-serif',
    paddingLeft: "4px",
    userSelect: "none",
});

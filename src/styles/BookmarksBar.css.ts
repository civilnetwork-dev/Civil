import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

export const bar = style({
    display: "flex",
    alignItems: "center",
    gap: "2px",
    height: "30px",
    padding: "0 10px",
    background: vars.color.crust,
    borderBottom: `1px solid ${vars.color.surface0}`,
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
    color: vars.color.subtext1,
    background: "transparent",
    border: "none",
    fontSize: "12px",
    fontFamily: '"Rubik", sans-serif',
    fontWeight: 400,
    whiteSpace: "nowrap",
    flexShrink: 0,
    maxWidth: "160px",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    position: "relative",
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
            color: vars.color.text,
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
    color: vars.color.overlay1,
});

export const bookmarkLabel = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
    minWidth: 0,
});

export const bookmarkRemove = style({
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    width: "14px",
    height: "14px",
    borderRadius: "3px",
    background: "transparent",
    border: "none",
    color: vars.color.overlay1,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `color ${T_FAST}, background ${T_FAST}`,
    selectors: {
        "&:hover": {
            color: vars.color.red,
            background: `color-mix(in srgb, ${vars.color.red} 15%, transparent)`,
        },
    },
});

globalStyle(`.${bookmark}:hover .${bookmarkRemove}`, {
    display: "flex",
});

export const separator = style({
    width: "1px",
    height: "16px",
    background: vars.color.surface1,
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
    color: vars.color.overlay1,
    cursor: "pointer",
    padding: 0,
    flexShrink: 0,
    transition: `background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
            color: vars.color.lavender,
        },
    },
});

export const emptyHint = style({
    fontSize: "11.5px",
    color: vars.color.overlay0,
    fontFamily: '"Rubik", sans-serif',
    paddingLeft: "4px",
    userSelect: "none",
    fontStyle: "italic",
});

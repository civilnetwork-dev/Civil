import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

export const root = style({
    backgroundColor: vars.color.base,
    minHeight: "100vh",
    display: "flex",
    fontFamily: '"Rubik", sans-serif',
    color: vars.color.text,
    boxSizing: "border-box",
});

export const sidebar = style({
    width: "220px",
    flexShrink: 0,
    background: vars.color.mantle,
    borderRight: `1px solid ${vars.color.surface0}`,
    padding: "32px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
});

export const sidebarTitle = style({
    fontSize: "12px",
    fontWeight: 600,
    color: vars.color.overlay1,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    padding: "0 8px",
    marginBottom: "10px",
});

export const sidebarItem = style({
    display: "flex",
    alignItems: "center",
    gap: "9px",
    padding: "7px 10px",
    borderRadius: "8px",
    cursor: "pointer",
    color: vars.color.subtext1,
    background: "transparent",
    border: "none",
    fontSize: "13px",
    fontFamily: "inherit",
    fontWeight: 400,
    textAlign: "left",
    transition: `background ${T_FAST}, color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface0,
            color: vars.color.text,
        },
    },
});

export const sidebarItemActive = style({
    background: `color-mix(in srgb, ${vars.color.lavender} 16%, transparent)`,
    color: vars.color.lavender,
    fontWeight: 500,
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.lavender} 22%, transparent)`,
            color: vars.color.lavender,
        },
    },
});

export const main = style({
    flex: 1,
    padding: "40px 48px",
    minWidth: 0,
    overflowY: "auto",
});

export const mainHeader = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "28px",
    gap: "16px",
});

export const mainTitle = style({
    fontSize: "22px",
    fontWeight: 600,
    color: vars.color.text,
});

export const searchInput = style({
    width: "240px",
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    padding: "7px 14px",
    fontSize: "13px",
    color: vars.color.text,
    outline: "none",
    fontFamily: "inherit",
    transition: `border-color ${T_FAST}`,
    selectors: {
        "&:focus": { borderColor: vars.color.lavender },
        "&::placeholder": { color: vars.color.overlay1 },
    },
});

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const card = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    borderRadius: "12px",
    background: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    cursor: "pointer",
    transition: `background ${T_FAST}, border-color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            borderColor: vars.color.overlay0,
        },
    },
});

export const cardFavicon = style({
    width: "20px",
    height: "20px",
    borderRadius: "5px",
    objectFit: "contain",
    flexShrink: 0,
});

export const cardFaviconFallback = style({
    width: "20px",
    height: "20px",
    borderRadius: "5px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.color.overlay1,
    background: vars.color.surface1,
});

export const cardInfo = style({
    flex: 1,
    minWidth: 0,
});

export const cardTitle = style({
    fontSize: "13px",
    fontWeight: 500,
    color: vars.color.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const cardUrl = style({
    fontSize: "11.5px",
    color: vars.color.subtext0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: "2px",
});

export const removeBtn = style({
    background: "none",
    border: "none",
    color: vars.color.overlay1,
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: `color ${T_FAST}, background ${T_FAST}`,
    selectors: {
        "&:hover": {
            color: vars.color.red,
            background: `color-mix(in srgb, ${vars.color.red} 14%, transparent)`,
        },
    },
});

export const empty = style({
    color: vars.color.overlay1,
    fontSize: "15px",
    textAlign: "center",
    marginTop: "80px",
});

export const clearBtn = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "none",
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "8px",
    color: vars.color.subtext0,
    cursor: "pointer",
    padding: "6px 14px",
    fontSize: "13px",
    fontFamily: "inherit",
    transition: `color ${T_FAST}, border-color ${T_FAST}, background ${T_FAST}`,
    selectors: {
        "&:hover": {
            color: vars.color.red,
            borderColor: vars.color.red,
            background: `color-mix(in srgb, ${vars.color.red} 8%, transparent)`,
        },
    },
});

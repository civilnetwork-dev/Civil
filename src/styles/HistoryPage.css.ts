import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const root = style({
    backgroundColor: vars.color.base,
    minHeight: "100vh",
    padding: "40px 48px",
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
});

export const header = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "32px",
});

export const title = style({
    fontSize: "24px",
    fontWeight: 600,
    color: vars.color.text,
});

export const controls = style({
    display: "flex",
    gap: "12px",
    alignItems: "center",
});

export const methodSelect = style({
    backgroundColor: vars.color.surface0,
    color: vars.color.text,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "14px",
    cursor: "pointer",
    outline: "none",
    transition: "border-color 0.2s",
    selectors: {
        "&:hover": {
            borderColor: vars.color.overlay1,
        },
        "&:focus": {
            borderColor: vars.color.blue,
        },
    },
});

export const clearBtn = style({
    backgroundColor: vars.color.red,
    color: vars.color.base,
    border: "none",
    borderRadius: "8px",
    padding: "6px 16px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "opacity 0.15s",
    selectors: {
        "&:hover": {
            opacity: 0.85,
        },
    },
});

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
});

export const entry = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "10px 16px",
    borderRadius: "10px",
    backgroundColor: vars.color.surface0,
    transition: "background 0.15s",
    selectors: {
        "&:hover": {
            backgroundColor: vars.color.surface1,
        },
    },
});

export const favicon = style({
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    objectFit: "contain",
    flexShrink: 0,
});

export const entryInfo = style({
    flex: 1,
    minWidth: 0,
});

export const entryTitle = style({
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const entryUrl = style({
    fontSize: "12px",
    color: vars.color.subtext0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: "2px",
});

export const entryTime = style({
    fontSize: "12px",
    color: vars.color.overlay1,
    flexShrink: 0,
});

export const deleteBtn = style({
    background: "none",
    border: "none",
    color: vars.color.overlay1,
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: "6px",
    fontSize: "14px",
    transition: "color 0.15s",
    selectors: {
        "&:hover": {
            color: vars.color.red,
        },
    },
});

export const empty = style({
    color: vars.color.overlay1,
    fontSize: "15px",
    textAlign: "center",
    marginTop: "80px",
});

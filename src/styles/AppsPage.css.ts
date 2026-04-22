import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

export const root = style({
    backgroundColor: vars.color.base,
    minHeight: "100vh",
    padding: "40px 48px",
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
    boxSizing: "border-box",
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

export const addBar = style({
    display: "flex",
    gap: "10px",
    marginBottom: "32px",
});

export const addInput = style({
    flex: 1,
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "14px",
    color: vars.color.text,
    outline: "none",
    fontFamily: "inherit",
    transition: `border-color ${T_FAST}`,
    selectors: {
        "&:focus": { borderColor: vars.color.blue },
        "&::placeholder": { color: vars.color.overlay1 },
    },
});

export const addBtn = style({
    backgroundColor: vars.color.blue,
    color: vars.color.base,
    border: "none",
    borderRadius: "10px",
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: `opacity ${T_FAST}`,
    selectors: {
        "&:hover:not(:disabled)": { opacity: 0.85 },
        "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
    },
});

export const grid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
    gap: "18px",
});

export const appCard = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    padding: "18px 10px 14px",
    borderRadius: "14px",
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    cursor: "pointer",
    transition: `background ${T_FAST}, transform 0.12s, border-color ${T_FAST}`,
    position: "relative",
    selectors: {
        "&:hover": {
            backgroundColor: vars.color.surface1,
            transform: "translateY(-2px)",
            borderColor: vars.color.overlay0,
        },
    },
});

export const appIcon = style({
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    objectFit: "contain",
    flexShrink: 0,
});

export const appIconFallback = style({
    width: "48px",
    height: "48px",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: vars.color.surface1,
    color: vars.color.overlay1,
    flexShrink: 0,
});

export const appName = style({
    fontSize: "12px",
    fontWeight: 500,
    color: vars.color.text,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    width: "100%",
});

export const removeBtn = style({
    position: "absolute",
    top: "6px",
    right: "6px",
    background: `color-mix(in srgb, ${vars.color.crust} 80%, transparent)`,
    border: "none",
    color: vars.color.overlay1,
    cursor: "pointer",
    padding: "3px",
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    transition: `color ${T_FAST}, background ${T_FAST}`,
    selectors: {
        "&:hover": {
            color: vars.color.red,
            background: `color-mix(in srgb, ${vars.color.red} 18%, transparent)`,
        },
    },
});

export const empty = style({
    color: vars.color.overlay1,
    fontSize: "15px",
    textAlign: "center",
    marginTop: "80px",
});

export const errorMsg = style({
    color: vars.color.red,
    fontSize: "13px",
    marginBottom: "16px",
    fontFamily: "inherit",
});

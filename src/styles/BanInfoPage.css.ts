import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";
import "./global.css";

export const banInfoRoot = style({
    backgroundColor: vars.color.base,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "100%",
    minHeight: "100vh",
    padding: "40px 20px",
    fontFamily: '"Rubik", sans-serif',
    boxSizing: "border-box",
});

export const header = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    width: "100%",
    maxWidth: "680px",
    marginBottom: "24px",
});

export const title = style({
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "28px",
    fontWeight: 500,
    textAlign: "center",
    cursor: "default",
});

export const inputRow = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    justifyContent: "center",
});

export const label = style({
    color: vars.color.subtext1,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "14px",
    fontWeight: 400,
    whiteSpace: "nowrap",
    cursor: "default",
});

export const input = style({
    width: "120px",
    height: "40px",
    background: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "14px",
    fontWeight: 400,
    padding: "0 14px",
    outline: "none",
    caretColor: vars.color.lavender,
    transition: "border-color 0.15s ease",
    selectors: {
        "&:focus": {
            borderColor: vars.color.lavender,
        },
        "&::placeholder": {
            color: vars.color.overlay0,
        },
        "&::-webkit-outer-spin-button, &::-webkit-inner-spin-button": {
            WebkitAppearance: "none",
            margin: "0",
        },
        '&[type="number"]': {
            MozAppearance: "textfield",
        } as never,
    },
});

export const statsText = style({
    color: vars.color.overlay1,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    cursor: "default",
});

export const scrollContainer = style({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    width: "100%",
    maxWidth: "680px",
});

export const domainItem = style({
    background: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "8px",
    color: vars.color.subtext0,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    padding: "10px 16px",
    transition: "background 0.1s ease, color 0.1s ease",
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
        },
    },
});

export const loadingText = style({
    color: vars.color.overlay1,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "16px",
    fontWeight: 400,
    marginTop: "40px",
    cursor: "default",
});

export const sentinel = style({
    height: "1px",
    width: "100%",
    marginTop: "8px",
});

export const endText = style({
    color: vars.color.overlay0,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    textAlign: "center",
    padding: "16px 0",
    cursor: "default",
});

import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const slideUp = keyframes({
    from: { opacity: 0, transform: "translateY(24px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const toast = style({
    position: "fixed",
    bottom: "24px",
    right: "24px",
    zIndex: 9999,
    width: "360px",
    maxWidth: "calc(100vw - 48px)",
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    animation: `${slideUp} 0.28s cubic-bezier(0.4, 0, 0.2, 1) both`,
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

export const header = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "8px",
});

export const titleGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: "2px",
});

export const title = style({
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: vars.color.mauve,
});

export const districtName = style({
    fontSize: "12px",
    color: vars.color.subtext0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "260px",
});

export const dismissBtn = style({
    background: "none",
    border: "none",
    cursor: "pointer",
    color: vars.color.overlay0,
    padding: "2px",
    fontSize: "16px",
    lineHeight: 1,
    flexShrink: 0,
    ":hover": {
        color: vars.color.text,
    },
});

export const description = style({
    fontSize: "12px",
    color: vars.color.subtext0,
    lineHeight: 1.5,
    margin: 0,
});

export const dropZone = style({
    border: `1.5px dashed ${vars.color.surface1}`,
    borderRadius: "8px",
    padding: "12px",
    textAlign: "center",
    fontSize: "12px",
    color: vars.color.overlay0,
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    selectors: {
        "&[data-active='true']": {
            borderColor: vars.color.mauve,
            backgroundColor: `color-mix(in srgb, ${vars.color.mauve} 8%, transparent)`,
            color: vars.color.mauve,
        },
    },
});

export const orDivider = style({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    color: vars.color.overlay0,
    "::before": {
        content: '""',
        flex: 1,
        height: "1px",
        backgroundColor: vars.color.surface1,
    },
    "::after": {
        content: '""',
        flex: 1,
        height: "1px",
        backgroundColor: vars.color.surface1,
    },
});

export const textarea = style({
    width: "100%",
    minHeight: "72px",
    resize: "vertical",
    backgroundColor: vars.color.base,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "6px",
    color: vars.color.text,
    fontSize: "11px",
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    padding: "8px 10px",
    boxSizing: "border-box",
    outline: "none",
    "::placeholder": {
        color: vars.color.overlay0,
    },
    ":focus": {
        borderColor: vars.color.mauve,
    },
});

export const actions = style({
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
});

export const cancelBtn = style({
    padding: "7px 14px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    background: "none",
    border: `1px solid ${vars.color.surface1}`,
    color: vars.color.subtext0,
    ":hover": {
        borderColor: vars.color.overlay0,
        color: vars.color.text,
    },
});

export const submitBtn = style({
    padding: "7px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    backgroundColor: vars.color.mauve,
    color: vars.color.base,
    ":disabled": {
        opacity: 0.5,
        cursor: "not-allowed",
    },
    ":hover": {
        filter: "brightness(1.1)",
    },
});

export const errorText = style({
    fontSize: "11px",
    color: vars.color.red,
    margin: 0,
});

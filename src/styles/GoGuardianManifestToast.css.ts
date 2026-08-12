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
    backgroundColor: vars.color.horizon,
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "12px",
    padding: "20px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    animation: `${slideUp} 0.28s cubic-bezier(0.4, 0, 0.2, 1) both`,
    animationDuration: "0.28s",
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
    color: vars.color.vega,
});

export const districtName = style({
    fontSize: "12px",
    color: vars.color.moonlight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "260px",
});

export const dismissBtn = style({
    background: "none",
    border: "none",
    cursor: "pointer",
    color: vars.color.ember,
    padding: "2px",
    fontSize: "16px",
    lineHeight: 1,
    flexShrink: 0,
    transitionProperty: "color",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
    ":hover": {
        color: vars.color.daylight,
    },
});

export const description = style({
    fontSize: "12px",
    color: vars.color.moonlight,
    lineHeight: 1.5,
    margin: 0,
});

export const dropZone = style({
    border: `1.5px dashed ${vars.color.haze}`,
    borderRadius: "8px",
    padding: "12px",
    textAlign: "center",
    fontSize: "12px",
    color: vars.color.ember,
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    transitionDuration: "0.15s",
    selectors: {
        "&[data-active='true']": {
            borderColor: vars.color.vega,
            backgroundColor: `color-mix(in srgb, ${vars.color.vega} 8%, transparent)`,
            color: vars.color.vega,
        },
    },
});

export const orDivider = style({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    color: vars.color.ember,
    "::before": {
        content: '""',
        flex: 1,
        height: "1px",
        backgroundColor: vars.color.haze,
    },
    "::after": {
        content: '""',
        flex: 1,
        height: "1px",
        backgroundColor: vars.color.haze,
    },
});

export const textarea = style({
    width: "100%",
    minHeight: "72px",
    resize: "vertical",
    backgroundColor: vars.color.dusk,
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "6px",
    color: vars.color.daylight,
    fontSize: "11px",
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    padding: "8px 10px",
    boxSizing: "border-box",
    outline: "none",
    "::placeholder": {
        color: vars.color.ember,
    },
    ":focus": {
        borderColor: vars.color.vega,
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
    border: `1px solid ${vars.color.haze}`,
    color: vars.color.moonlight,
    transitionProperty: "border-color, color",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
    ":hover": {
        borderColor: vars.color.ember,
        color: vars.color.daylight,
    },
});

export const submitBtn = style({
    padding: "7px 16px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    backgroundColor: vars.color.vega,
    color: vars.color.dusk,
    transitionProperty: "filter",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
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
    color: vars.color.antares,
    margin: 0,
});

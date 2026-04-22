import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

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
    gap: "12px",
    marginBottom: "32px",
});

export const headerIcon = style({
    color: vars.color.mauve,
    flexShrink: 0,
});

export const title = style({
    fontSize: "24px",
    fontWeight: 600,
    color: vars.color.text,
});

export const installBar = style({
    display: "flex",
    gap: "10px",
    marginBottom: "32px",
});

export const installInput = style({
    flex: 1,
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    padding: "8px 14px",
    fontSize: "14px",
    color: vars.color.text,
    outline: "none",
    transition: `border-color ${T_FAST}`,
    selectors: {
        "&:focus": {
            borderColor: vars.color.mauve,
        },
        "&::placeholder": {
            color: vars.color.overlay1,
        },
    },
});

export const installBtn = style({
    backgroundColor: vars.color.mauve,
    color: vars.color.base,
    border: "none",
    borderRadius: "10px",
    padding: "8px 20px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: `opacity ${T_FAST}`,
    selectors: {
        "&:hover": {
            opacity: 0.85,
        },
        "&:disabled": {
            opacity: 0.4,
            cursor: "not-allowed",
        },
    },
});

export const uploadBtnLabel = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: vars.color.surface0,
    color: vars.color.subtext1,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    padding: "8px 16px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: `background ${T_FAST}, color ${T_FAST}, border-color ${T_FAST}`,
    selectors: {
        "&:hover": {
            background: vars.color.surface1,
            color: vars.color.text,
            borderColor: vars.color.overlay0,
        },
    },
});

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
});

export const card = style({
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "14px 18px",
    borderRadius: "12px",
    backgroundColor: vars.color.surface0,
    border: `1px solid ${vars.color.surface1}`,
    transition: `background ${T_FAST}`,
});

export const cardIcon = style({
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    backgroundColor: vars.color.surface1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    color: vars.color.mauve,
    overflow: "hidden",
});

export const cardIconImg = style({
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "8px",
});

export const cardInfo = style({
    flex: 1,
    minWidth: 0,
});

export const cardName = style({
    fontSize: "14px",
    fontWeight: 600,
    color: vars.color.text,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const cardMeta = style({
    fontSize: "12px",
    color: vars.color.subtext0,
    marginTop: "2px",
});

export const cardBadge = style({
    fontSize: "11px",
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: "20px",
    backgroundColor: vars.color.surface1,
    color: vars.color.overlay1,
    flexShrink: 0,
});

export const cardBadgeCrx = style({
    backgroundColor: `color-mix(in srgb, ${vars.color.blue} 18%, transparent)`,
    color: vars.color.blue,
});

export const cardBadgeXpi = style({
    backgroundColor: `color-mix(in srgb, ${vars.color.peach} 18%, transparent)`,
    color: vars.color.peach,
});

export const toggle = style({
    flexShrink: 0,
    position: "relative",
    width: "36px",
    height: "20px",
    cursor: "pointer",
});

export const toggleInput = style({
    opacity: 0,
    width: 0,
    height: 0,
    position: "absolute",
});

export const toggleTrack = style({
    position: "absolute",
    inset: 0,
    borderRadius: "20px",
    backgroundColor: vars.color.surface2,
    transition: `background ${T_FAST}`,
    selectors: {
        [`.${toggleInput}:checked + &`]: {
            backgroundColor: vars.color.mauve,
        },
    },
});

export const toggleThumb = style({
    position: "absolute",
    top: "3px",
    left: "3px",
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    backgroundColor: vars.color.base,
    transition: `transform ${T_FAST}`,
    selectors: {
        [`.${toggleInput}:checked ~ &`]: {
            transform: "translateX(16px)",
        },
    },
});

export const removeBtn = style({
    background: "none",
    border: "none",
    color: vars.color.overlay1,
    cursor: "pointer",
    padding: "4px",
    borderRadius: "6px",
    transition: `color ${T_FAST}`,
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

export const sectionTitle = style({
    fontSize: "12px",
    fontWeight: 600,
    color: vars.color.overlay1,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "10px",
    marginTop: "28px",
});

import { keyframes, style } from "@vanilla-extract/css";
import { PAGE_PADDING } from "./layout.css";
import {
    atmosphere,
    DUR,
    EASE,
    focusRing,
    glow,
    lit,
    machined,
    SHADOW,
} from "./material.css";
import { vars } from "./theme.css";

const T_FAST = "0.1s ease";

const emptyFadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const root = style({
    ...atmosphere(vars.color.mauve),
    minHeight: "100vh",
    padding: PAGE_PADDING,
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
});

export const installBar = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "32px",
});

export const installInput = style({
    // Grow to fill the row, but allow shrinking below the intrinsic input
    // width so the buttons wrap onto a second line instead of being pushed
    // off-screen (the body clips overflow-x, so they became unreachable).
    flex: "1 1 240px",
    minWidth: 0,
    background: machined(
        vars.color.surface0,
        `color-mix(in srgb, ${vars.color.surface0} 80%, ${vars.color.mantle})`,
    ),
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    padding: "9px 14px",
    fontSize: "14px",
    color: vars.color.text,
    outline: "none",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "border-color, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:focus": {
            borderColor: `color-mix(in srgb, ${vars.color.mauve} 70%, transparent)`,
            boxShadow: lit(focusRing(vars.color.mauve)),
        },
        "&::placeholder": {
            color: vars.color.overlay1,
        },
    },
});

export const installBtn = style({
    background: `linear-gradient(135deg, ${vars.color.mauve} 0%, ${vars.color.lavender} 100%)`,
    color: vars.color.crust,
    border: "none",
    borderRadius: "10px",
    padding: "9px 22px",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.03em",
    cursor: "pointer",
    boxShadow: glow(vars.color.mauve, 26),
    transitionProperty: "transform, box-shadow, filter",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover:not(:disabled)": {
            transform: "translateY(-1px)",
            boxShadow: glow(vars.color.mauve, 44),
        },
        "&:active:not(:disabled)": { transform: "translateY(0)" },
        "&:disabled": {
            filter: "saturate(0.25)",
            opacity: 0.45,
            boxShadow: "none",
            cursor: "not-allowed",
        },
    },
});

export const uploadBtnLabel = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: machined(vars.color.surface0, vars.color.mantle),
    color: vars.color.subtext1,
    border: `1px solid ${vars.color.surface1}`,
    borderRadius: "10px",
    padding: "9px 16px",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "background, color, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
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
    padding: "13px 16px",
    borderRadius: "10px",
    background: machined(vars.color.surface0, vars.color.mantle),
    border: `1px solid ${vars.color.surface1}`,
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "background, border-color, transform, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            borderColor: `color-mix(in srgb, ${vars.color.mauve} 40%, ${vars.color.surface1})`,
            transform: "translateX(2px)",
            boxShadow: lit(SHADOW.lifted),
        },
    },
});

// Enabled/disabled at-a-glance indicator for a real settings-panel scan,
// not a colored border strip (the system reserves those for structural cards).
// A seated indicator lamp: recessed bezel at rest, lit from within when the
// extension is enabled. Static - the system forbids anything that pulses.
export const statusDot = style({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    flexShrink: 0,
    backgroundColor: vars.color.overlay0,
    boxShadow: `inset 0 1px 1px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.35)`,
    transitionProperty: "background-color, box-shadow",
    transitionDuration: DUR.base,
    transitionTimingFunction: EASE.standard,
});

export const statusDotOn = style({
    backgroundColor: vars.color.green,
    boxShadow: `inset 0 1px 1px rgba(255,255,255,0.35), 0 0 0 1px rgba(0,0,0,0.35), 0 0 10px color-mix(in srgb, ${vars.color.green} 70%, transparent)`,
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
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.45)",
    transitionProperty: "background-color, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        [`.${toggleInput}:checked + &`]: {
            backgroundColor: vars.color.mauve,
            boxShadow: `inset 0 1px 2px rgba(0,0,0,0.28), 0 0 12px color-mix(in srgb, ${vars.color.mauve} 45%, transparent)`,
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
    background: machined("#f2f4ff", vars.color.subtext1),
    boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
    transitionProperty: "transform",
    transitionTimingFunction: EASE.spring,
    transitionDuration: DUR.base,
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
    transitionDuration: "0.1s",
    selectors: {
        "&:hover": {
            color: vars.color.red,
        },
    },
});

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    marginTop: "60px",
    animationName: emptyFadeIn,
    animationTimingFunction: "ease",
    animationFillMode: "both",
    animationDuration: "0.3s",
});

export const emptyIcon = style({
    color: vars.color.surface2,
});

export const emptyText = style({
    color: vars.color.subtext0,
    fontSize: "14px",
    textAlign: "center",
});

export const sectionTitle = style({
    fontSize: "12px",
    fontWeight: 600,
    color: vars.color.overlay1,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "10px",
    marginTop: "28px",
    paddingBottom: "8px",
    borderBottom: `1px solid ${vars.color.surface0}`,
});

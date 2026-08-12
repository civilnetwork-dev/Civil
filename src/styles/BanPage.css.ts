import { globalStyle, keyframes, style } from "@vanilla-extract/css";
import { microLabel } from "./material.css";
import { vars } from "./theme.css";
import "./global.css";

const fadeUp = keyframes({
    from: { opacity: 0, transform: "translateY(10px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const banRoot = style({
    position: "relative",
    backgroundColor: vars.color.dusk,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
});

// A muted red-tinted stripe field gives the blocked moment real atmosphere
// instead of bare text on a flat background - never full-saturation alert
// red, just enough tint to read as "restricted" without alarm.
export const banBackground = style({
    position: "absolute",
    inset: 0,
    // Stripes plus a vignette: the corners fall away so attention is pulled
    // to the centre of the page, which is the whole job of this screen.
    backgroundImage: [
        `radial-gradient(120% 90% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)`,
        `repeating-linear-gradient(-45deg, transparent 0 14px, color-mix(in srgb, ${vars.color.arcturus} 11%, ${vars.color.night}) 14px 28px)`,
    ].join(", "),
    opacity: 0.62,
});

export const banText = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "0 24px",
    color: vars.color.daylight,
    fontFamily: '"Rubik", sans-serif',
    cursor: "default",
    animationName: fadeUp,
    animationTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
    animationFillMode: "both",
    animationDuration: "0.45s",
});

globalStyle(`.${banText} h1`, {
    textTransform: "none",
    fontSize: "clamp(30px, 5vw, 42px)",
    fontWeight: 600,
    letterSpacing: "-0.02em",
    lineHeight: 1.05,
    marginBottom: "2px",
});

globalStyle(`.${banText} p`, {
    fontSize: "17px",
    fontWeight: 400,
    color: vars.color.moonlight,
    maxWidth: "44ch",
    textAlign: "center",
    lineHeight: 1.5,
});

// The proxy-status link reads as a real ghost button, not a bare underline
// floating below plain text.
globalStyle(`.${banText} a`, {
    marginTop: "10px",
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 20px",
    borderRadius: "8px",
    border: `1px solid ${vars.color.haze}`,
    background: vars.color.horizon,
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.aurora,
    textDecoration: "none",
    transitionProperty: "background, border-color, color, transform",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
});

globalStyle(`.${banText} a:hover`, {
    background: vars.color.haze,
    borderColor: vars.color.ember,
    color: vars.color.nebula,
    transform: "translateY(-1px)",
});

// Eyebrow above the headline: names the system doing the blocking, so the
// message reads as a verdict from a known source rather than a bare error.
export const banEyebrow = style({
    ...microLabel,
    display: "flex",
    alignItems: "center",
    gap: "9px",
    color: vars.color.arcturus,
});

export const banEyebrowMark = style({
    width: "16px",
    height: "2px",
    borderRadius: "1px",
    background: vars.color.arcturus,
    opacity: 0.8,
});

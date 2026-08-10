import { globalStyle, style } from "@vanilla-extract/css";
import { atmosphere, DUR, EASE, hairline, microLabel } from "./material.css";
import { vars } from "./theme.css";

/**
 * New Tab — the aiming moment.
 *
 * DESIGN.md gives this page the "HUD corner brackets" signature. Previously
 * that was four 16px brackets floating near a search box, which read as a
 * stray decoration rather than a viewfinder. Here the reticle is built
 * properly: brackets, tick marks and a centre axis that together frame the
 * one control on the page, and brighten as a unit when it takes focus.
 *
 * Composition runs eyebrow → wordmark → rule → tagline → instrument, so the
 * page has a real hierarchy instead of two lines of text stacked mid-screen.
 */

export const newtabRoot = style({
    ...atmosphere(vars.color.lavender),
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "34px",
    width: "100%",
    minHeight: "100vh",
    padding: "48px 24px",
    boxSizing: "border-box",
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
});

/* ---------------------------------------------------------------- */
/* Identity block                                                    */
/* ---------------------------------------------------------------- */

export const welcomeText = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
    cursor: "default",
    width: "100%",
});

export const eyebrow = style({
    ...microLabel,
    display: "flex",
    alignItems: "center",
    gap: "9px",
});

/**
 * A small filled marker rather than a live "status light" — the system
 * forbids anything that animates at rest, and a blinking indicator is
 * exactly the kind of thing that draws a second glance on a shared screen.
 */
export const eyebrowDot = style({
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    background: vars.color.green,
    boxShadow: `0 0 8px color-mix(in srgb, ${vars.color.green} 60%, transparent)`,
});

/**
 * The wordmark. Wide tracking and a light weight make the six letters read
 * as an engraved plate rather than a heading, which is what lets the page
 * carry a single line of type as its whole identity.
 */
export const wordmark = style({
    margin: 0,
    fontSize: "clamp(38px, 7vw, 64px)",
    fontWeight: 500,
    lineHeight: 1,
    letterSpacing: "0.16em",
    // Trailing tracking pushes the optical centre left; pad it back.
    paddingLeft: "0.16em",
    textTransform: "uppercase",
    color: vars.color.text,
    background: `linear-gradient(174deg, ${vars.color.text} 0%, color-mix(in srgb, ${vars.color.lavender} 62%, ${vars.color.subtext0}) 100%)`,
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    WebkitTextFillColor: "transparent",
    userSelect: "none",
});

/** Etched divider: fades out at both ends instead of stopping dead. */
export const wordmarkRule = style({
    width: "min(420px, 72vw)",
    height: "1px",
    background: hairline(
        `color-mix(in srgb, ${vars.color.lavender} 45%, transparent)`,
    ),
});

export const tagline = style({
    margin: 0,
    fontSize: "15px",
    fontWeight: 400,
    letterSpacing: "0.02em",
    color: vars.color.subtext0,
});

globalStyle(`.${tagline} b`, {
    fontWeight: 600,
    color: vars.color.lavender,
});

/* ---------------------------------------------------------------- */
/* The reticle                                                       */
/* ---------------------------------------------------------------- */

export const searchbarWrap = style({
    position: "relative",
    width: "min(640px, 92vw)",
    padding: "22px",
});

/**
 * Corner brackets. Larger and thinner than before so they read as machined
 * guides rather than chunky right angles, and they inset slightly on focus
 * so the whole reticle "closes in" on the field being aimed.
 */
export const cornerBracket = style({
    position: "absolute",
    width: "26px",
    height: "26px",
    borderStyle: "solid",
    borderWidth: 0,
    borderColor: `color-mix(in srgb, ${vars.color.lavender} 50%, transparent)`,
    pointerEvents: "none",
    opacity: 0.4,
    transitionProperty: "opacity, border-color, inset",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
});

export const cornerTL = style({
    top: 0,
    left: 0,
    borderTopWidth: "1.5px",
    borderLeftWidth: "1.5px",
    borderTopLeftRadius: "5px",
});

export const cornerTR = style({
    top: 0,
    right: 0,
    borderTopWidth: "1.5px",
    borderRightWidth: "1.5px",
    borderTopRightRadius: "5px",
});

export const cornerBL = style({
    bottom: 0,
    left: 0,
    borderBottomWidth: "1.5px",
    borderLeftWidth: "1.5px",
    borderBottomLeftRadius: "5px",
});

export const cornerBR = style({
    bottom: 0,
    right: 0,
    borderBottomWidth: "1.5px",
    borderRightWidth: "1.5px",
    borderBottomRightRadius: "5px",
});

/**
 * Centre-axis ticks on the left and right edges. These are what make the
 * frame read as an instrument rather than a rounded rectangle: they mark
 * the field's centreline, the way a viewfinder marks its axis.
 */
export const axisTick = style({
    position: "absolute",
    top: "50%",
    width: "9px",
    height: "1px",
    marginTop: "-0.5px",
    background: `color-mix(in srgb, ${vars.color.lavender} 55%, transparent)`,
    opacity: 0.35,
    pointerEvents: "none",
    transitionProperty: "opacity, width",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
});

export const axisTickLeft = style({ left: 0 });
export const axisTickRight = style({ right: 0 });

/** The reticle brightens and tightens as one when the field takes focus. */
globalStyle(`.${searchbarWrap}:focus-within .${cornerBracket}`, {
    opacity: 1,
    borderColor: vars.color.lavender,
    inset: "4px auto auto 4px",
});
globalStyle(`.${searchbarWrap}:focus-within .${cornerTR}`, {
    inset: "4px 4px auto auto",
});
globalStyle(`.${searchbarWrap}:focus-within .${cornerBL}`, {
    inset: "auto auto 4px 4px",
});
globalStyle(`.${searchbarWrap}:focus-within .${cornerBR}`, {
    inset: "auto 4px 4px auto",
});
globalStyle(`.${searchbarWrap}:focus-within .${axisTick}`, {
    opacity: 0.9,
    width: "14px",
});

/** A soft pool of light under the field, so it sits *on* the panel. */
globalStyle(`.${searchbarWrap}::before`, {
    content: '""',
    position: "absolute",
    left: "8%",
    right: "8%",
    top: "24%",
    bottom: "10%",
    borderRadius: "50%",
    background: `radial-gradient(ellipse at center, color-mix(in srgb, ${vars.color.lavender} 13%, transparent) 0%, transparent 70%)`,
    filter: "blur(26px)",
    pointerEvents: "none",
    zIndex: -1,
});

/* ---------------------------------------------------------------- */
/* Footnote                                                          */
/* ---------------------------------------------------------------- */

export const adNotice = style({
    position: "absolute",
    bottom: "26px",
    left: "50%",
    transform: "translateX(-50%)",
    margin: 0,
    maxWidth: "min(90vw, 480px)",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 400,
    letterSpacing: "0.03em",
    lineHeight: 1.5,
    color: vars.color.overlay0,
    cursor: "default",
});

import { keyframes, style } from "@vanilla-extract/css";
import { PAGE_PADDING } from "./layout.css";
import {
    atmosphere,
    DUR,
    EASE,
    focusRing,
    glow,
    hitArea,
    lit,
    machined,
    SHADOW,
} from "./material.css";
import { vars } from "./theme.css";

const emptyFadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const root = style({
    ...atmosphere(vars.color.sirius),
    minHeight: "100vh",
    padding: PAGE_PADDING,
    color: vars.color.daylight,
    fontFamily: '"Rubik", sans-serif',
    boxSizing: "border-box",
});

export const addBar = style({
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "32px",
});

export const addInput = style({
    // Shrinkable so the button wraps below instead of overflowing the
    // viewport, which the body's overflow-x clip would hide entirely.
    flex: "1 1 240px",
    minWidth: 0,
    background: machined(
        vars.color.horizon,
        `color-mix(in srgb, ${vars.color.horizon} 80%, ${vars.color.night})`,
    ),
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "10px",
    padding: "9px 14px",
    fontSize: "14px",
    color: vars.color.daylight,
    outline: "none",
    fontFamily: "inherit",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "border-color, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:focus": {
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
            boxShadow: lit(focusRing(vars.color.sirius)),
        },
        "&::placeholder": { color: vars.color.cinder },
    },
});

// Lavender, not Blue: Blue only ever appears as a subtle focus/tint accent
// elsewhere in the system, never a bold solid fill.
export const addBtn = style({
    background: `linear-gradient(135deg, ${vars.color.sirius} 0%, ${vars.color.vega} 100%)`,
    color: vars.color.void,
    border: "none",
    borderRadius: "10px",
    padding: "9px 22px",
    fontSize: "13px",
    fontWeight: 600,
    letterSpacing: "0.03em",
    cursor: "pointer",
    fontFamily: "inherit",
    boxShadow: glow(vars.color.sirius, 26),
    transitionProperty: "transform, box-shadow, filter",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover:not(:disabled)": {
            transform: "translateY(-1px)",
            boxShadow: glow(vars.color.sirius, 44),
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

export const grid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(128px, 1fr))",
    gap: "16px",
});

// Game-cartridge tile: a big icon "plate" over a caption bar, instead of the
// generic stacked icon+label card shared by every other list page.
export const appCard = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    aspectRatio: "1",
    borderRadius: "18px",
    overflow: "hidden",
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    cursor: "pointer",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "transform, box-shadow, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        // A gloss band across the upper face, the way light falls on a
        // moulded plastic shell. Sits under the icon via a low z-index so it
        // never washes out the artwork.
        "&::after": {
            content: '""',
            position: "absolute",
            inset: "0 0 auto 0",
            height: "58%",
            background:
                "linear-gradient(180deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.012) 55%, transparent 100%)",
            pointerEvents: "none",
        },
        "&:hover": {
            transform: "translateY(-4px)",
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 45%, ${vars.color.haze})`,
            boxShadow: lit(glow(vars.color.sirius, 30), true),
        },
        "&:active": { transform: "translateY(-1px) scale(0.975)" },
    },
});

export const appIconStage = style({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "14px",
});

export const appIcon = style({
    width: "54px",
    height: "54px",
    borderRadius: "13px",
    objectFit: "contain",
    flexShrink: 0,
    // The icon reads as a seated plate rather than a floating png.
    boxShadow: `0 4px 12px rgba(0,0,0,0.32), 0 0 0 1px rgba(0,0,0,0.25)`,
    transitionProperty: "transform",
    transitionTimingFunction: EASE.spring,
    transitionDuration: DUR.base,
    selectors: {
        [`${appCard}:hover &`]: { transform: "scale(1.07)" },
    },
});

export const appIconFallback = style({
    width: "54px",
    height: "54px",
    borderRadius: "13px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: machined(vars.color.haze, vars.color.horizon),
    color: vars.color.cinder,
    flexShrink: 0,
    boxShadow: lit("0 4px 12px rgba(0,0,0,0.3)"),
});

export const appNameBar = style({
    position: "relative",
    zIndex: 1,
    flexShrink: 0,
    padding: "9px 10px",
    background: `color-mix(in srgb, ${vars.color.void} 62%, transparent)`,
    borderTop: `1px solid color-mix(in srgb, ${vars.color.dust} 60%, transparent)`,
    fontSize: "11.5px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: vars.color.halo,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const removeBtn = style({
    position: "absolute",
    top: "6px",
    right: "6px",
    zIndex: 1,
    background: `color-mix(in srgb, ${vars.color.void} 80%, transparent)`,
    border: "none",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: "3px",
    width: "20px",
    height: "20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    // Destructive affordance stays out of the way until the tile is the one
    // being pointed at, matching the bookmark bar. Keyboard focus reveals it
    // too, so it never becomes mouse-only.
    opacity: 0,
    // Invisible but still clickable is a trap: with no hover on touch, a tap
    // in the tile's corner would delete instead of open. The control only
    // becomes interactive once it's actually shown.
    pointerEvents: "none",
    transitionProperty: "color, background, opacity",
    transitionTimingFunction: "ease",
    transitionDuration: "0.1s",
    selectors: {
        "&::after": hitArea(28),
        [`${appCard}:hover &, &:focus-visible`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover": {
            color: vars.color.antares,
            background: `color-mix(in srgb, ${vars.color.antares} 18%, transparent)`,
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

// A dashed cartridge-shaped placeholder - the empty state should still read
// as "this is the Apps grid," not a generic centered sentence.
export const emptyGhostTile = style({
    width: "84px",
    height: "84px",
    borderRadius: "18px",
    border: `2px dashed ${vars.color.haze}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: vars.color.ember,
});

export const emptyText = style({
    color: vars.color.moonlight,
    fontSize: "14px",
    textAlign: "center",
});

export const errorMsg = style({
    color: vars.color.antares,
    fontSize: "13px",
    marginBottom: "16px",
    fontFamily: "inherit",
});

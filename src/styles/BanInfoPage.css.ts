import { style } from "@vanilla-extract/css";
import {
    atmosphere,
    DUR,
    EASE,
    hairline,
    lit,
    machined,
    microLabel,
    readout,
    SHADOW,
} from "./material.css";
import { vars } from "./theme.css";
import "./global.css";

// Header, strike card and the domain grid all measure to the same column so
// they stay flush with each other at every width.
const CONTENT_MAX = "1100px";

export const banInfoRoot = style({
    ...atmosphere(vars.color.antares, 0.9),
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
    maxWidth: CONTENT_MAX,
    marginBottom: "26px",
    paddingBottom: "22px",
    borderBottom: "1px solid transparent",
    borderImage: `${hairline(vars.color.haze)} 1`,
});

export const title = style({
    color: vars.color.daylight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    letterSpacing: "-0.015em",
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
    color: vars.color.halo,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "14px",
    fontWeight: 400,
    whiteSpace: "nowrap",
    cursor: "default",
});

export const input = style({
    width: "120px",
    height: "40px",
    background: vars.color.horizon,
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "10px",
    color: vars.color.daylight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "14px",
    fontWeight: 400,
    padding: "0 14px",
    outline: "none",
    caretColor: vars.color.sirius,
    transition: "border-color 0.15s ease",
    transitionDuration: "0.15s",
    selectors: {
        "&:focus": {
            borderColor: vars.color.sirius,
        },
        "&::placeholder": {
            color: vars.color.cinder,
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
    // cinder against dusk is 4.82:1, above the 4.5:1 AA floor at this size,
    // but moonlight (9.88:1) is used here for extra headroom.
    color: vars.color.moonlight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    cursor: "default",
});

// Domains are short strings, so one per full-width row turned a 500-entry
// page into a single column of near-identical bars with most of the width
// unused. A dense auto-fill grid fits several per line and makes the list
// scannable alphabetically down each column.
export const scrollContainer = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: "6px",
    width: "100%",
    maxWidth: CONTENT_MAX,
});

export const domainItem = style({
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "8px",
    boxShadow: lit(SHADOW.resting),
    color: vars.color.moonlight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "12.5px",
    fontWeight: 400,
    padding: "8px 12px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transitionProperty: "background, color, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            background: vars.color.haze,
            borderColor: `color-mix(in srgb, ${vars.color.antares} 35%, ${vars.color.haze})`,
            color: vars.color.daylight,
        },
    },
});

export const loadingText = style({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: vars.color.cinder,
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
    color: vars.color.ember,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    textAlign: "center",
    padding: "16px 0",
    cursor: "default",
});

export const statusSection = style({
    width: "100%",
    maxWidth: CONTENT_MAX,
});

export const strikeCard = style({
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "12px",
    padding: "18px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: lit(SHADOW.resting),
});

export const strikeHeader = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
});

export const strikeLabel = style({
    ...microLabel,
    color: vars.color.moonlight,
    fontFamily: '"Rubik", sans-serif',
    cursor: "default",
});

export const strikeCount = style({
    ...readout,
    color: vars.color.daylight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "15px",
    fontWeight: 600,
    letterSpacing: "0.04em",
    cursor: "default",
});

/**
 * The strike gauge. Five discrete cells, because five is the actual limit —
 * a continuous bar asked the reader to convert a percentage back into
 * "how many do I have left", which is the only question this control answers.
 * Unused cells are recessed; used cells are lit from within.
 */
export const strikeGauge = style({
    display: "grid",
    gridAutoFlow: "column",
    gridAutoColumns: "1fr",
    gap: "5px",
    height: "10px",
});

export const strikeSegment = style({
    borderRadius: "3px",
    background: vars.color.haze,
    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.45)",
    transitionProperty: "background, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
});

export const strikeSegmentUsed = style({
    background: "var(--seg-color)",
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 0 10px color-mix(in srgb, var(--seg-color) 55%, transparent)`,
});

export const policyText = style({
    // cinder on horizon lands at 4.20:1 - below the 4.5:1 AA floor for
    // text this size. moonlight reads at 8.60:1 against the same card.
    color: vars.color.moonlight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "12.5px",
    fontWeight: 400,
    lineHeight: "1.5",
    margin: 0,
    cursor: "default",
});

export const bannedBanner = style({
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    background: `color-mix(in srgb, ${vars.color.antares} 10%, ${vars.color.night})`,
    border: `1px solid color-mix(in srgb, ${vars.color.antares} 40%, transparent)`,
    borderRadius: "12px",
    padding: "18px 20px",
    boxShadow: lit(
        `0 0 26px -6px color-mix(in srgb, ${vars.color.antares} 30%, transparent)`,
    ),
});

export const bannedIcon = style({
    width: "28px",
    height: "28px",
    flexShrink: 0,
    color: vars.color.antares,
});

export const loadingIcon = style({
    width: "16px",
    height: "16px",
    flexShrink: 0,
});

export const bannedInfo = style({
    display: "flex",
    flexDirection: "column",
    gap: "4px",
});

export const bannedTitle = style({
    color: vars.color.antares,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "15px",
    fontWeight: 600,
    cursor: "default",
});

export const bannedReason = style({
    color: vars.color.moonlight,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "13px",
    fontWeight: 400,
    cursor: "default",
});

export const bannedDate = style({
    color: vars.color.cinder,
    fontFamily: '"Rubik", sans-serif',
    fontSize: "12px",
    fontWeight: 400,
    cursor: "default",
});

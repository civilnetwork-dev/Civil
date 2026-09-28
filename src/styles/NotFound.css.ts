import { style } from "@vanilla-extract/css";

import { BAND, blend, GROUND, KEY_COBALT, RISE } from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

export const notFoundRoot = style(
    blend(GROUND, {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        minHeight: "100vh",
        overflow: "hidden",
    }),
);

export const notFoundContent = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
    textAlign: "center",
    fontFamily: FONT_SANS,
    color: vars.color.firn,
    padding: "1rem",
    animation: RISE,
});

// The numeral is cut out of the ground as a block of strata: six bands of
// sediment under the face, then its shadow.
const strata = Array.from(
    { length: 6 },
    (_, i) => `0 ${i + 1}px 0 ${i % 2 ? BAND.dark : BAND.light}`,
);

export const notFoundTitle = style({
    fontSize: "clamp(2.5rem, 10vw, 5.5rem)",
    lineHeight: 1.1,
    letterSpacing: "-0.03em",
    margin: "0 0 0.5rem",
    textShadow: [
        ...strata,
        "0 14px 18px color-mix(in srgb, black 45%, transparent)",
    ].join(", "),
});

export const notFoundSubtitle = style({
    margin: 0,
    color: vars.color.snowmelt,
    fontSize: "1rem",
});

export const notFoundHomeLink = style(
    blend(KEY_COBALT, {
        marginTop: "1rem",
        padding: "11px 20px",
        borderRadius: "10px",
        textDecoration: "none",
    }),
);

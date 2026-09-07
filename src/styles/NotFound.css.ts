import { style } from "@vanilla-extract/css";

import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

export const notFoundRoot = style({
    position: "relative",
    backgroundColor: vars.color.stratum,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "100vh",
    overflow: "hidden",
});

// Same construction as the Ban page's stripe field, in the neutral tier
// rather than maroon: these are the system's two dead-end screens and they
// should share one atmosphere instead of one being visibly flatter.
export const notFoundBackground = style({
    position: "absolute",
    inset: 0,
    backgroundColor: vars.color.basalt,
    backgroundImage: [
        "radial-gradient(120% 90% at 50% 45%, transparent 35%, rgba(0,0,0,0.55) 100%)",
        // Tinted a short step off Mantle rather than raw Surface 1: against
        // Mantle that tier is a big contrast jump, which turned a texture
        // into bold diagonal banding. Ban's field is built the same way.
        `repeating-linear-gradient(-45deg, transparent 0 14px, color-mix(in srgb, ${vars.color.talus} 30%, ${vars.color.basalt}) 14px 28px)`,
    ].join(", "),
    opacity: 0.62,
});

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
});

export const notFoundTitle = style({
    fontSize: "clamp(2rem, 8vw, 4.5rem)",
    lineHeight: 1.1,
    margin: 0,
});

export const notFoundSubtitle = style({
    margin: 0,
    color: vars.color.firn,
    fontSize: "1rem",
});

export const notFoundHomeLink = style({
    marginTop: "0.75rem",
    color: vars.color.cobalt,
    textDecoration: "none",
    fontWeight: 500,
    selectors: {
        "&:hover": {
            textDecoration: "underline",
        },
    },
});

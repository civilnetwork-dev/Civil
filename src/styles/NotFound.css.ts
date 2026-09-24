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
    letterSpacing: "-0.03em",
    margin: 0,
});

export const notFoundSubtitle = style({
    margin: 0,
    color: vars.color.snowmelt,
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

import { style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const notFoundRoot = style({
    position: "relative",
    backgroundColor: vars.color.base,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "100vh",
    overflow: "hidden",
});

export const notFoundBackground = style({
    position: "absolute",
    inset: 0,
    backgroundColor: vars.color.mantle,
    backgroundImage: `repeating-linear-gradient(-45deg, transparent 0 16px, ${vars.color.surface1} 16px 32px)`,
    opacity: 0.6,
});

export const notFoundContent = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
    textAlign: "center",
    fontFamily: '"Rubik", sans-serif',
    color: vars.color.text,
    padding: "1rem",
});

export const notFoundTitle = style({
    fontSize: "clamp(2rem, 8vw, 4.5rem)",
    lineHeight: 1.1,
    margin: 0,
});

export const notFoundSubtitle = style({
    margin: 0,
    color: vars.color.subtext1,
    fontSize: "1rem",
});

export const notFoundHomeLink = style({
    marginTop: "0.75rem",
    color: vars.color.blue,
    textDecoration: "none",
    fontWeight: 500,
    selectors: {
        "&:hover": {
            textDecoration: "underline",
        },
    },
});

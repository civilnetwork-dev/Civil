import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const loadingContainer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.75rem",
    backgroundColor: vars.color.base,
    padding: "1.5rem 2rem",
    position: "fixed",
    inset: 0,
    overflow: "hidden",
    zIndex: 100,
});

export const loadingLottie = style({
    width: "120px",
    height: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

globalStyle(`.${loadingLottie} canvas`, {
    width: "100% !important",
    height: "100% !important",
    background: "transparent !important",
});

export const loadingStatusWrapper = style({
    fontFamily: '"Rubik", sans-serif',
    fontWeight: 500,
    fontSize: "0.9rem",
    letterSpacing: "0.01em",
    color: vars.color.subtext1,
    textAlign: "center",
    minWidth: "260px",
});

export const loadingStatus = style({
    transition: "opacity 400ms cubic-bezier(0.86, 0, 0.07, 1)",
});

export const loadingStatusShown = style({ opacity: 1 });
export const loadingStatusHidden = style({ opacity: 0 });

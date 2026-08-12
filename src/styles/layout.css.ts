import { style } from "@vanilla-extract/css";
import { hairline, microLabel } from "./material.css";
import { vars } from "./theme.css";

/**
 * Shared layout measurements and the page-header pattern.
 *
 * Every full-page surface (Apps, Extensions, History, Bookmarks, Ban info)
 * measures to the same column so moving between them doesn't shift the
 * content edge, and opens with the same three-part masthead so they read as
 * panels in one instrument rather than five separate screens.
 */

/** Max width of a page's content column. */
export const CONTENT_MAX = "1180px";

/**
 * Page gutter. The inline value centres the content column *via padding*
 * rather than `max-width` + `margin: auto`, so the page element itself stays
 * full-bleed and its backdrop (see `atmosphere`) reaches the window edges
 * instead of stopping in a 1180px stripe down the middle.
 */
export const PAGE_PADDING = `44px max(clamp(20px, 5vw, 48px), calc((100% - ${CONTENT_MAX}) / 2)) 64px`;

/* ------------------------------------------------------------------ */
/* Page masthead                                                       */
/* ------------------------------------------------------------------ */

export const masthead = style({
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    marginBottom: "30px",
});

export const mastheadTop = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
});

export const mastheadTitleGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    minWidth: 0,
});

/**
 * The eyebrow names what kind of panel this is. It's the smallest piece of
 * type on the page and the one that does the most work: it's what makes a
 * list of links read as an instrument readout rather than a web page.
 */
export const eyebrow = style({
    ...microLabel,
    display: "flex",
    alignItems: "center",
    gap: "8px",
});

/** A short accent dash before the eyebrow text — the panel's index mark. */
export const eyebrowMark = style({
    width: "16px",
    height: "2px",
    borderRadius: "1px",
    background: vars.color.sirius,
    opacity: 0.75,
});

export const pageTitle = style({
    margin: 0,
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: vars.color.daylight,
});

/** Count / status text sitting beside the title. */
export const pageMeta = style({
    ...microLabel,
    fontVariantNumeric: "tabular-nums",
});

export const mastheadActions = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "10px",
});

/** Etched rule closing the masthead. */
export const mastheadRule = style({
    height: "1px",
    background: hairline(vars.color.haze),
});

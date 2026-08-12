import { style } from "@vanilla-extract/css";
import { DUR, EASE } from "./material.css";
import { ANNO, FONT_MONO, RULE } from "./schematic.css";
import { vars } from "./theme.css";

export const addingNote = style({ display: "block", marginTop: "6px" });

export const gridRule = style({ margin: "26px 0 14px" });

export const grid = style({
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "10px",
});

export const position = style({
    transition: `background ${DUR.fast} ${EASE.standard}`,
    selectors: {
        // horizon (1.19:1 on dusk) is the system's "raised surface" tier — the
        // same step BookmarksPage uses for a hovered row.
        "&:hover, &:focus-within": {
            background: vars.color.horizon,
        },
    },
});

export const summary = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
});

export const iconStage = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
});

export const icon = style({
    width: "26px",
    height: "26px",
    objectFit: "contain",
});

export const iconFallback = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // ember deliberately, not a text tier: this colours a glyph, not text, so
    // WCAG 1.4.11's 3:1 non-text threshold applies rather than 4.5:1. ember
    // measures 3.56:1 on dusk, which clears it.
    color: vars.color.ember,
});

export const name = style({
    fontSize: "12.5px",
    fontWeight: 500,
    // daylight, matching the tier BookmarksPage uses for its own item title
    // (cardTitle) — a filled position's name is the primary label, not a
    // muted annotation.
    color: vars.color.daylight,
    textAlign: "center",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: "100%",
});

export const detail = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    alignItems: "center",
});

export const detailActions = style({
    display: "flex",
    gap: "8px",
});

const detailBtnBase = {
    background: "none",
    border: "none",
    padding: "2px 4px",
    cursor: "pointer",
    fontFamily: FONT_MONO,
    fontSize: "11px",
    letterSpacing: "0.02em",
    borderBottom: RULE.hair,
} as const;

export const detailBtn = style({
    ...detailBtnBase,
    // sirius is the system's chrome/action accent — the same tier used for
    // the title block mark and every other affirmative control.
    color: vars.color.sirius,
});

export const detailBtnDanger = style({
    ...detailBtnBase,
    // antares is the "blocked" status tier, reused here as the destructive
    // accent — the same colour BanInfoPage and BookmarksPage use for remove.
    color: vars.color.antares,
});

export const ghostGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
    gap: "10px",
});

export const ghost = style({
    height: "74px",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "6px",
    // dust is the system's "strongest border" tier and is what Plate's own
    // corner ticks use — an empty position borrows that same boundary
    // vocabulary so filled and unfilled positions read as one language.
    border: `0.5px dashed ${vars.color.dust}`,
});

export const ghostNote = style({
    ...ANNO,
    gridColumn: "1 / -1",
    margin: "10px 0 0",
});

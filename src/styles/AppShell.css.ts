import { style } from "@vanilla-extract/css";

import { alpha, blend, DUR, EASE, GROUND } from "./material.css";
import { FONT_SANS } from "./schematic.css";
import { vars } from "./theme.css";

/**
 * Calm Strata: the sidebar is flat stone with one hairline edge, like the
 * reference apps the owner chose, and keeps its depth for the one signature
 * moment it has, the lit door that marks where you are.
 *
 * Rows sit on a 38px pitch (36px row, 2px gap); the door's travel below is
 * that pitch, so the two must change together.
 */
const ROW = 36;
const PITCH = 38;
const PHONE = "screen and (max-width: 720px)";

export const shell = style(
    blend(GROUND, {
        display: "grid",
        gridTemplateColumns: "236px minmax(0, 1fr)",
        minHeight: "100svh",
        color: vars.color.firn,
        fontFamily: FONT_SANS,
        "@media": { [PHONE]: { gridTemplateColumns: "minmax(0, 1fr)" } },
    }),
);

export const sidebar = style({
    position: "sticky",
    top: 0,
    height: "100svh",
    // A grid item defaults to its min-content width; on the phone the nav row
    // would then widen the one column past the screen instead of scrolling.
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    padding: "18px 12px 14px",
    background: alpha(vars.color.basalt, 70),
    borderRight: `1px solid ${alpha(vars.color.talus, 45)}`,
    zIndex: 2,
    "@media": {
        [PHONE]: {
            position: "static",
            height: "auto",
            flexDirection: "row",
            alignItems: "center",
            gap: "6px",
            padding: "10px 12px",
            overflowX: "auto",
            borderRight: "none",
            borderBottom: `1px solid ${alpha(vars.color.talus, 45)}`,
        },
    },
});

export const brand = style({
    display: "inline-flex",
    alignSelf: "flex-start",
    padding: "6px 10px 12px",
    borderRadius: "8px",
    selectors: {
        "&:focus-visible": {
            outline: `2px solid ${vars.color.cobalt}`,
            outlineOffset: "2px",
        },
    },
    "@media": {
        [PHONE]: { flexShrink: 0, padding: "4px 8px 4px 2px" },
    },
});

export const places = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: `${PITCH - ROW}px`,
    flex: 1,
    "@media": { [PHONE]: { flexDirection: "row", flex: "none", gap: "4px" } },
});

export const row = style({
    position: "relative",
    zIndex: 1,
    display: "flex",
    alignItems: "center",
    gap: "10px",
    height: `${ROW}px`,
    padding: "0 12px 0 16px",
    borderRadius: "10px",
    color: vars.color.snowmelt,
    fontSize: "14px",
    fontWeight: 500,
    textDecoration: "none",
    whiteSpace: "nowrap",
    transition: `background-color 160ms ${EASE.standard}, color 160ms ${EASE.standard}`,
    selectors: {
        "&:hover": {
            backgroundColor: alpha(vars.color.scree, 70),
            color: vars.color.firn,
        },
        '&[aria-current="page"]': {
            backgroundColor: vars.color.scree,
            color: vars.color.firn,
        },
        "&:focus-visible": {
            outline: `2px solid ${vars.color.cobalt}`,
            outlineOffset: "-2px",
        },
    },
    "@media": { [PHONE]: { flexShrink: 0, height: "34px", padding: "0 12px" } },
});

export const rowIcon = style({
    color: vars.color.ash,
    transition: `color 160ms ${EASE.standard}`,
    selectors: {
        [`${row}:hover &`]: { color: vars.color.firn },
        [`${row}[aria-current="page"] &`]: { color: vars.color.cobalt },
    },
});

// The Doorway's door: as wide as its quadrant head, standing in the active
// row's left margin and travelling one pitch per row.
export const door = style({
    position: "absolute",
    zIndex: 2,
    left: "5px",
    top: `${(ROW - 16) / 2}px`,
    width: "6px",
    height: "16px",
    borderTopLeftRadius: "6px",
    background: vars.color.cobalt,
    transform: `translateY(calc(var(--door) * ${PITCH}px))`,
    transition: `transform ${DUR.lift} ${EASE.enter}, opacity ${DUR.base} ${EASE.standard}`,
    selectors: { '&[data-hidden="true"]': { opacity: 0 } },
    "@media": { [PHONE]: { display: "none" } },
});

export const foot = style({
    display: "flex",
    flexDirection: "column",
    paddingTop: "12px",
    borderTop: `1px solid ${alpha(vars.color.talus, 35)}`,
    "@media": { [PHONE]: { paddingTop: 0, borderTop: "none" } },
});

export const main = style({ minWidth: 0 });

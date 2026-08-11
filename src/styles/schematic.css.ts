import { style, styleVariants } from "@vanilla-extract/css";
import { DUR, EASE, hairline } from "./material.css";
import { vars } from "./theme.css";

/**
 * Schematic material language.
 *
 * Interior pages read as technical drawings: a hairline ruled field, corner
 * registration marks, labelled dimension rules, and monospace annotations in
 * the margins. Depth comes from rules and alignment, not from simulated light —
 * which is why nothing here uses `atmosphere()` or `edgeLit` from
 * material.css.ts. Those belong to the previous "backlit" metaphor and the two
 * do not coexist on one page.
 *
 * Motion tokens (EASE, DUR) are reused unchanged; there is no reason to churn
 * values the rest of the system already agrees on.
 */

/**
 * System monospace. Zero packages, zero download. Rubik stays the voice of the
 * product; mono carries data — numerals, hostnames, timings, scores, IDs.
 */
export const FONT_MONO =
    'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/* -------------------------------------------------------------------- */
/* Rules                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Three line weights and nothing else, so a drawing reads as measured rather
 * than arbitrary. `hair` divides, `major` closes a block, `accent` marks the
 * one line that matters on the page.
 */
export const RULE = {
    hair: `0.5px solid ${vars.color.surface0}`,
    major: `1px solid ${vars.color.surface1}`,
    accent: `1px solid ${vars.color.lavender}`,
} as const;

/* -------------------------------------------------------------------- */
/* Ruled field                                                           */
/* -------------------------------------------------------------------- */

const FIELD_DENSITY = { fine: 8, base: 16, coarse: 32 } as const;

export type FieldDensity = keyof typeof FIELD_DENSITY;

/**
 * The ruled grid, as one repeating gradient pair on a single element. Density
 * is a named token rather than a raw number so pages cannot invent off-scale
 * grids.
 */
export function field(
    density: FieldDensity = "base",
    color: string = vars.color.surface0,
) {
    const px = FIELD_DENSITY[density];
    return {
        backgroundImage: `linear-gradient(to right, ${color} 0.5px, transparent 0.5px), linear-gradient(to bottom, ${color} 0.5px, transparent 0.5px)`,
        backgroundSize: `${px}px ${px}px`,
    };
}

/* -------------------------------------------------------------------- */
/* Annotation tier                                                       */
/* -------------------------------------------------------------------- */

/**
 * 11px is the floor of the system, not a target, so it is paired with
 * `subtext0` rather than `overlay1`: overlay1 on base is ~4.0:1 and fails
 * WCAG AA for small text, subtext0 is ~6.6:1.
 */
export const ANNO = {
    fontFamily: FONT_MONO,
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums",
    color: vars.color.subtext0,
} as const;

export const anno = style({ ...ANNO });

/**
 * overlay1 measures 4.14:1 on base and fails WCAG AA for small text (4.5:1 min);
 * overlay2 is 5.29:1 and keeps the muted tier compliant while visibly dimmer than
 * anno's subtext0 (6.62:1), so the two-tier hierarchy survives.
 */
export const annoMuted = style({
    ...ANNO,
    color: vars.color.overlay2,
});

/* -------------------------------------------------------------------- */
/* Sheet + registration marks                                            */
/* -------------------------------------------------------------------- */

export const sheet = style({
    position: "relative",
    minHeight: "100%",
    padding: "44px max(clamp(20px, 5vw, 48px), calc((100% - 1180px) / 2)) 64px",
});

export const sheetField = style({
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    opacity: 0.5,
});

export const sheetFieldDensity = styleVariants({
    fine: field("fine"),
    base: field("base"),
    coarse: field("coarse"),
});

const MARK_SIZE = "11px";

export const mark = style({
    position: "absolute",
    width: MARK_SIZE,
    height: MARK_SIZE,
    pointerEvents: "none",
});

export const markCorner = styleVariants({
    tl: {
        top: "14px",
        left: "14px",
        borderTop: RULE.accent,
        borderLeft: RULE.accent,
    },
    tr: {
        top: "14px",
        right: "14px",
        borderTop: RULE.accent,
        borderRight: RULE.accent,
    },
    bl: {
        bottom: "14px",
        left: "14px",
        borderBottom: RULE.accent,
        borderLeft: RULE.accent,
    },
    br: {
        bottom: "14px",
        right: "14px",
        borderBottom: RULE.accent,
        borderRight: RULE.accent,
    },
});

export const sheetBody = style({
    position: "relative",
});

/* -------------------------------------------------------------------- */
/* Title block                                                           */
/* -------------------------------------------------------------------- */

export const titleBlock = style({
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    paddingTop: "8px",
    borderTop: RULE.major,
    marginBottom: "30px",
});

export const titleBlockTop = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: "16px",
});

export const titleBlockEyebrow = style({
    ...ANNO,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    textTransform: "uppercase",
});

export const titleBlockMark = style({
    width: "16px",
    height: "2px",
    background: vars.color.lavender,
    opacity: 0.75,
});

export const titleBlockTitle = style({
    margin: 0,
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: vars.color.text,
});

export const titleBlockMeta = style({ ...ANNO });

/* -------------------------------------------------------------------- */
/* Labelled rule                                                         */
/* -------------------------------------------------------------------- */

export const ruleRow = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
});

export const ruleLine = style({
    flex: 1,
    height: 0,
    borderTop: RULE.hair,
});

export const ruleLineMajor = style({
    flex: 1,
    height: 0,
    borderTop: RULE.major,
});

export const ruleLabel = style({
    ...ANNO,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
});

export const ruleCap = style({
    width: 0,
    height: "12px",
    borderLeft: RULE.accent,
});

/* -------------------------------------------------------------------- */
/* Plate                                                                 */
/* -------------------------------------------------------------------- */

export const plate = style({
    position: "relative",
    padding: "12px",
});

export const plateTick = style({
    position: "absolute",
    width: "6px",
    height: "6px",
    pointerEvents: "none",
    borderColor: vars.color.surface2,
});

export const plateTickCorner = styleVariants({
    tl: {
        top: 0,
        left: 0,
        borderTopWidth: "1px",
        borderLeftWidth: "1px",
        borderTopStyle: "solid",
        borderLeftStyle: "solid",
    },
    br: {
        bottom: 0,
        right: 0,
        borderBottomWidth: "1px",
        borderRightWidth: "1px",
        borderBottomStyle: "solid",
        borderRightStyle: "solid",
    },
});

/* -------------------------------------------------------------------- */
/* Accessibility utilities                                               */
/* -------------------------------------------------------------------- */

/**
 * Visually hidden but still announced. Uses the clip-rect technique rather than
 * `display: none` or `visibility: hidden`, both of which remove the text from
 * the accessibility tree entirely.
 */
export const srOnly = style({
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: 0,
});

/* -------------------------------------------------------------------- */
/* Unfold                                                                */
/* -------------------------------------------------------------------- */

export const unfold = style({
    position: "relative",
});

export const unfoldTrigger = style({
    display: "block",
    width: "100%",
    padding: 0,
    background: "none",
    border: "none",
    color: "inherit",
    font: "inherit",
    textAlign: "inherit",
    cursor: "pointer",
});

export const unfoldRegion = style({
    display: "grid",
    gridTemplateRows: "0fr",
    overflow: "hidden",
    transition: `grid-template-rows ${DUR.base} ${EASE.enter}`,
});

export const unfoldRegionOpen = style([
    unfoldRegion,
    { gridTemplateRows: "1fr" },
]);

export const unfoldInner = style({
    minHeight: 0,
    paddingTop: "6px",
    borderTop: RULE.hair,
    marginTop: "6px",
});

/* -------------------------------------------------------------------- */
/* Field (input)                                                         */
/* -------------------------------------------------------------------- */

export const inputRow = style({
    display: "flex",
    alignItems: "baseline",
    gap: "10px",
    paddingBottom: "6px",
    borderBottom: RULE.hair,
    selectors: {
        "&:focus-within": { borderBottomColor: vars.color.lavender },
    },
});

export const inputLabel = style({
    ...ANNO,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    minWidth: "92px",
});

export const inputControl = style({
    flex: 1,
    minWidth: 0,
    background: "none",
    border: "none",
    outline: "none",
    fontFamily: FONT_MONO,
    fontSize: "13px",
    color: vars.color.text,
    "::placeholder": { color: vars.color.overlay0 },
});

export const inputHint = style({
    ...ANNO,
    color: vars.color.red,
    display: "block",
    marginTop: "5px",
});

/**
 * Divider used between ledger rows and inside dense annotation blocks.
 *
 * `hairline()` returns a gradient value, not a border shorthand, so it cannot
 * sit directly in `borderTop` (that property expects `width style color`).
 * The rest of the codebase pairs it with `borderImage` instead — see
 * BookmarksPage.css.ts, FilterCheckPage.css.ts, BanInfoPage.css.ts — so this
 * follows the same pattern: a 1px border box painted by the gradient image.
 */
export const divider = style({
    height: 0,
    borderTop: "1px solid transparent",
    borderImage: `${hairline(vars.color.surface0)} 1`,
});

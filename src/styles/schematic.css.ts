import { style, styleVariants } from "@vanilla-extract/css";
import { addFunctionSerializer } from "@vanilla-extract/css/functionSerializer";

import { createField } from "./schematicField";

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
 * The two faces, defined once.
 *
 * IBM Plex Sans carries anything a person reads as a sentence; IBM Plex Mono
 * carries data — numerals, hostnames, timings, scores, IDs. They are one
 * superfamily drawn for technical documentation, so the two share a skeleton
 * and sit on the same rhythm rather than reading as two products.
 *
 * These live here, not as string literals at each call site. The stack was
 * previously written out by hand in twelve files, which is exactly how one of
 * them ends up a font behind the rest.
 *
 * The system fallbacks matter: a school network that blocks the font request
 * still gets a monospace for data and a sans for prose, so the alignment the
 * ledgers depend on survives the font never arriving.
 */
export const FONT_SANS =
    '"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

export const FONT_MONO =
    '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/* -------------------------------------------------------------------- */
/* Rules                                                                 */
/* -------------------------------------------------------------------- */

/**
 * Three line weights and nothing else, so a drawing reads as measured rather
 * than arbitrary. `hair` divides, `major` closes a block, `accent` marks the
 * one line that matters on the page.
 */
export const RULE = {
    hair: `0.5px solid ${vars.color.scree}`,
    major: `1px solid ${vars.color.talus}`,
    accent: `1px solid ${vars.color.cobalt}`,
} as const;

/* -------------------------------------------------------------------- */
/* Ruled field                                                           */
/* -------------------------------------------------------------------- */

export type { FieldDensity } from "./schematicField";

/**
 * The ruled grid, as one repeating gradient pair on a single element. Density
 * is a named token rather than a raw number so pages cannot invent off-scale
 * grids.
 *
 * A `.css.ts` module may only export values vanilla-extract can statically
 * serialize for production, and a bare function isn't one of them (see
 * schematicField.ts for why). `addFunctionSerializer` tags this export so the
 * production compiler reconstructs it by re-importing and re-calling
 * `createField` instead of trying to inline the closure — dev, test and prod
 * all end up with the same working function.
 */
export const field = addFunctionSerializer(createField(), {
    importPath: "./schematicField",
    importName: "createField",
    args: [],
});

/* -------------------------------------------------------------------- */
/* Annotation tier                                                       */
/* -------------------------------------------------------------------- */

/**
 * 11px is the floor of the system, not a target, so it is paired with
 * `moonlight` rather than `cinder`: cinder measures 4.82:1 against dusk,
 * comfortably above the 4.5:1 WCAG AA small-text minimum, but moonlight's
 * 9.88:1 gives more headroom at the size floor.
 */
export const ANNO = {
    fontFamily: FONT_MONO,
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums",
    color: vars.color.snowmelt,
} as const;

export const anno = style({ ...ANNO });

/**
 * The house line: one sentence directly under a title block, in prose rather
 * than the annotation tier.
 *
 * Reserved for the page's brand statement, so it stays rare. A drawing that
 * explains itself in a paragraph on every sheet is not a drawing any more.
 */
export const lede = style({
    maxWidth: "60ch",
    margin: "0 0 24px",
    fontSize: "13.5px",
    lineHeight: 1.55,
    color: vars.color.firn,
});

/**
 * starlight (7.27:1 against dusk) is used here rather than cinder (4.82:1)
 * for visible dimness relative to anno's moonlight (9.88:1), not because
 * cinder fails AA — it clears the 4.5:1 small-text minimum on its own. Both
 * tiers pass comfortably; the gap between them preserves the hierarchy.
 */
export const annoMuted = style({
    ...ANNO,
    color: vars.color.snowmelt,
});

/* -------------------------------------------------------------------- */
/* Sheet + registration marks                                            */
/* -------------------------------------------------------------------- */

/**
 * Total vertical padding a sheet reserves (44px top + 64px bottom), published
 * as a custom property so a page that wants its content to fill exactly one
 * viewport can subtract it instead of hardcoding the number. Duplicating `108px`
 * at a call site is how the two silently drift apart the first time this padding
 * changes.
 */
export const SHEET_VPAD_VAR = "--civil-sheet-vpad";

export const sheet = style({
    position: "relative",
    minHeight: "100%",
    padding: "44px max(clamp(20px, 5vw, 48px), calc((100% - 1180px) / 2)) 64px",
    vars: { [SHEET_VPAD_VAR]: "108px" },
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
    background: vars.color.cobalt,
    opacity: 0.75,
});

export const titleBlockTitle = style({
    margin: 0,
    fontSize: "clamp(24px, 3.4vw, 31px)",
    fontWeight: 600,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
    color: vars.color.firn,
});

/** Eyebrow, title and meta as one stacked identity, kept out of the flex row. */
export const titleBlockIdent = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
});

export const titleBlockMeta = style({ ...ANNO, color: vars.color.snowmelt });

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
    borderColor: vars.color.talus,
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

/**
 * The grid item inside `unfoldRegion`. It must carry NOTHING that contributes
 * height — no padding, no border, no margin.
 *
 * Under `grid-template-rows: 0fr` a track can only collapse to zero if its item
 * contributes zero; padding and borders are part of that contribution regardless
 * of the track size. With them here the collapsed region floored at 13px and
 * leaked a visible hairline at rest on every page using Unfold — measured in a
 * browser, because happy-dom computes no layout and no test can see it.
 *
 * `minHeight: 0` is necessary but was never sufficient: it zeroes the content
 * box, while the 13px floor came from the item's own padding, border and margin,
 * which sit outside it. Moving those to a child leaves the item itself with no
 * box at all.
 *
 * Do NOT add `overflow: hidden` here. Clipping belongs on the track, which
 * already has it; on the item it zeroes the item's contribution, so the open
 * state's `1fr` resolves against nothing and the region stays collapsed at 0px
 * while still reporting `aria-expanded="true"` — a reveal that is dead but looks
 * correct to every test we have.
 */
export const unfoldInner = style({
    minHeight: 0,
});

/** Carries the spacing and separator that `unfoldInner` cannot. */
export const unfoldContent = style({
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
        "&:focus-within": { borderBottomColor: vars.color.cobalt },
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
    color: vars.color.firn,
    "::placeholder": { color: vars.color.ash },
});

export const inputHint = style({
    ...ANNO,
    color: vars.color.wine,
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
    borderImage: `${hairline(vars.color.scree)} 1`,
});

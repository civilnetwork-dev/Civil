import { style } from "@vanilla-extract/css";

import { DUR, EASE, hairline } from "./material.css";
import { vars } from "./theme.css";

/**
 * The shared interior-page kit: two type faces, three rule weights, the
 * annotation tier, and the primitives every interior page is built from
 * (Sheet, TitleBlock, Rule, Unfold, Field).
 *
 * Labels are sentence case at their natural size. Nothing here uppercases,
 * tracks out, or decorates; hierarchy comes from size, weight and colour.
 */

export const FONT_SANS =
    '"IBM Plex Sans Variable", "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif';

export const FONT_MONO =
    '"IBM Plex Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/* Rules                                                                 */

export const RULE = {
    hair: `0.5px solid ${vars.color.scree}`,
    major: `1px solid ${vars.color.talus}`,
    accent: `1px solid ${vars.color.cobalt}`,
} as const;

/* Annotation tier                                                       */

export const ANNO = {
    fontFamily: FONT_SANS,
    fontSize: "12px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    fontVariantNumeric: "tabular-nums",
    color: vars.color.snowmelt,
} as const;

export const anno = style({ ...ANNO });

export const lede = style({
    maxWidth: "60ch",
    margin: "0 0 24px",
    fontSize: "15px",
    lineHeight: 1.55,
    color: vars.color.snowmelt,
});

export const annoMuted = style({
    ...ANNO,
    color: vars.color.snowmelt,
});

/* Sheet                                                                 */

export const sheet = style({
    position: "relative",
    minHeight: "100%",
    padding: "48px max(24px, calc((100% - 1040px) / 2)) 64px",
    color: vars.color.firn,
});

export const sheetBody = style({
    position: "relative",
});

/* Title block                                                           */

export const titleBlock = style({
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    marginBottom: "28px",
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
});

export const titleBlockMark = style({
    width: "16px",
    height: "2px",
    background: vars.color.cobalt,
    opacity: 0.75,
});

export const titleBlockTitle = style({
    margin: 0,
    fontSize: "32px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.015em",
    color: vars.color.firn,
});

export const titleBlockIdent = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
});

export const titleBlockMeta = style({ ...ANNO, color: vars.color.snowmelt });

/* Labelled rule                                                         */

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
    whiteSpace: "nowrap",
});

export const ruleCap = style({
    width: 0,
    height: "12px",
    borderLeft: RULE.accent,
});

/* Accessibility utilities                                               */

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

/* Unfold                                                                */

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

// Carries nothing that contributes height: under `grid-template-rows: 0fr`
// the track can only collapse to zero if its item has no padding, border or
// margin of its own. Those live on `unfoldContent`.
export const unfoldInner = style({
    minHeight: 0,
});

export const unfoldContent = style({
    paddingTop: "6px",
    borderTop: RULE.hair,
    marginTop: "6px",
});

/* Field (input)                                                         */

export const inputRow = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "12px 16px",
    minHeight: "48px",
    borderRadius: "10px",
    background: vars.color.basalt,
    border: RULE.major,
    transition: `border-color ${DUR.base} ${EASE.standard}`,
    selectors: {
        "&:focus-within": { borderColor: vars.color.cobalt },
    },
});

export const inputLabel = style({
    ...ANNO,
    whiteSpace: "nowrap",
    minWidth: "92px",
});

export const inputControl = style({
    flex: 1,
    minWidth: 0,
    background: "none",
    border: "none",
    outline: "none",
    fontFamily: FONT_SANS,
    fontSize: "14px",
    color: vars.color.firn,
    "::placeholder": { color: vars.color.ash },
    selectors: { "&:focus-visible": { outline: "none" } },
});

export const inputHint = style({
    ...ANNO,
    color: vars.color.wine,
    display: "block",
    marginTop: "6px",
});

export const divider = style({
    height: 0,
    borderTop: "1px solid transparent",
    borderImage: `${hairline(vars.color.scree)} 1`,
});

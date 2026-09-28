import { globalStyle, style } from "@vanilla-extract/css";

import {
    alpha,
    blend,
    DUR,
    EASE,
    GLINT,
    GROUND,
    hitArea,
    KEY_STONE,
    LIT,
    mix,
    RISE,
    SHADE,
    WELL,
} from "./material.css";
import { vars } from "./theme.css";

/**
 * The shared interior-page kit: two type faces, three rule weights, the
 * annotation tier, and the primitives every interior page is built from
 * (Sheet, TitleBlock, Rule, Unfold, Field).
 *
 * Labels are sentence case at their natural size. Nothing here uppercases,
 * tracks out, or decorates; hierarchy comes from size, weight, colour and,
 * since Strata, height: rules are engraved into the ground, fields are carved
 * wells, and a page's content rises out of the ground as it arrives.
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

export const sheet = style(
    blend(GROUND, {
        minHeight: "100%",
        padding: "48px max(24px, calc((100% - 1040px) / 2)) 64px",
        color: vars.color.firn,
    }),
);

export const sheetBody = style({
    position: "relative",
});

// Each section of a page rises out of the ground in reading order, a beat
// apart. Six is as deep as any page goes; later sections land with the sixth.
globalStyle(`.${sheetBody} > *`, { animation: RISE });
for (let i = 2; i <= 6; i++) {
    globalStyle(`.${sheetBody} > :nth-child(${i})`, {
        animationDelay: `${(i - 1) * 50}ms`,
    });
}

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

/** The emblem and the name, side by side. */
export const titleBlockHead = style({
    display: "flex",
    alignItems: "center",
    gap: "18px",
    minWidth: 0,
});

// Raised lettering: the glyphs stand a pixel proud of the ground and cast a
// short soft shadow, the same light as every slab.
export const titleBlockTitle = style({
    margin: 0,
    fontSize: "32px",
    fontWeight: 600,
    lineHeight: 1.2,
    letterSpacing: "-0.015em",
    color: vars.color.firn,
    textShadow: `0 1px 0 ${vars.color.basalt}, 0 3px 8px color-mix(in srgb, black 35%, transparent)`,
});

export const titleBlockIdent = style({
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: 0,
});

export const titleBlockMeta = style({ ...ANNO, color: vars.color.snowmelt });

/** The controls a page sets beside its title. */
export const titleBlockActions = style({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
});

// Clearing a whole record (history, bookmarks) is a plain stone key in wine,
// the tier every remove control in the app wears. The armed second click is
// stated in its label too, so the colour shift is the redundant channel, not
// the only one.
export const clearKey = style(
    blend(KEY_STONE, {
        ...ANNO,
        display: "flex",
        alignItems: "center",
        gap: "6px",
        border: "none",
        borderRadius: "9px",
        padding: "6px 11px",
        cursor: "pointer",
        color: vars.color.wine,
    }),
);

export const clearKeyArmed = style({
    color: vars.color.firn,
    backgroundColor: `color-mix(in oklab, ${vars.color.wine} 30%, ${vars.color.scree})`,
    backgroundImage: LIT,
});

/* Labelled rule                                                         */

export const ruleRow = style({
    display: "flex",
    alignItems: "center",
    gap: "10px",
    width: "100%",
});

// Rules are grooves cut into the ground: a shadowed line with a lit lip
// under it, so a section break reads as carved rather than drawn.
const groove = (shade: string, lip: number) => ({
    flex: 1,
    height: 0,
    borderTop: `1px solid ${shade}`,
    boxShadow: `0 1px 0 color-mix(in srgb, ${vars.color.firn} ${lip}%, transparent)`,
});

export const ruleLine = style(
    groove(`color-mix(in srgb, ${vars.color.basalt} 55%, transparent)`, 5),
);

export const ruleLineMajor = style(groove(vars.color.basalt, 7));

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

// A carved well. The row carries focus; the input inside draws no ring.
export const inputRow = style(
    blend(WELL, {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        minHeight: "48px",
        borderRadius: "12px",
    }),
);

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
    caretColor: vars.color.cobalt,
    "::placeholder": { color: vars.color.ash },
    selectors: { "&:focus-visible": { outline: "none" } },
});

// The glyph leading a field turns cobalt while its well has focus. It colours
// a glyph, not text, so the non-text 3:1 threshold applies rather than 4.5:1.
export const inputIcon = style({
    flexShrink: 0,
    color: vars.color.ash,
    transition: `color ${DUR.base} ${EASE.standard}`,
    selectors: { ":focus-within > &": { color: vars.color.cobalt } },
});

/** Empties a field; small to look at, a full 24px to hit. */
export const inputClear = style({
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "20px",
    height: "20px",
    padding: 0,
    border: "none",
    borderRadius: "6px",
    background: "none",
    color: vars.color.snowmelt,
    cursor: "pointer",
    transition: `color ${DUR.fast} ${EASE.standard}`,
    selectors: {
        "&::after": hitArea(),
        "&:hover": { color: vars.color.firn },
    },
});

export const inputHint = style({
    ...ANNO,
    color: vars.color.wine,
    display: "block",
    marginTop: "6px",
});

export const divider = style(
    groove(`color-mix(in srgb, ${vars.color.basalt} 55%, transparent)`, 5),
);

/* -------------------------------------------------------------------- */
/* Switch                                                                */
/* -------------------------------------------------------------------- */

/**
 * A native checkbox drives this, kept in the tab order and merely made
 * transparent. The visible track and thumb are siblings that read its state
 * through `:checked`, so keyboard, assistive tech and forms all behave without
 * any of it being reimplemented in script.
 */
export const toggle = style({
    position: "relative",
    flexShrink: 0,
    display: "inline-grid",
    alignItems: "center",
    width: "34px",
    height: "18px",
    cursor: "pointer",
});

export const toggleInput = style({
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    margin: 0,
    opacity: 0,
    cursor: "pointer",
});

// The switch is a channel carved into the row; switching on floods it with
// cobalt meltwater.
// Same four layers in both states (wall shade, meltwater glow, rim, lip).
const trackShadow = (glow: string, rim: string) =>
    `${SHADE.pit}, inset 0 0 8px ${glow}, inset 0 0 0 1px ${rim}, 0 1px 0 ${alpha(vars.color.firn, 7)}`;

export const toggleTrack = style({
    borderRadius: "20px",
    position: "absolute",
    inset: 0,
    backgroundColor: vars.color.basalt,
    boxShadow: trackShadow(
        alpha(vars.color.cobalt, 0),
        alpha(vars.color.talus, 60),
    ),
    transitionProperty: "box-shadow, background-color",
    transitionTimingFunction: EASE.enter,
    transitionDuration: DUR.lift,
    selectors: {
        [`${toggleInput}:checked ~ &`]: {
            backgroundColor: mix(vars.color.cobalt, 30, vars.color.basalt),
            boxShadow: trackShadow(
                alpha(vars.color.cobalt, 55),
                vars.color.cobalt,
            ),
        },
        // The ring has to live on the track: the input it belongs to is
        // transparent, so its own outline would be invisible.
        [`${toggleInput}:focus-visible ~ &`]: {
            outline: `1px solid ${vars.color.cobalt}`,
            outlineOffset: "2px",
        },
    },
});

// The knob is a small raised stone that rolls along the channel.
export const toggleThumb = style({
    borderRadius: "50%",
    position: "absolute",
    top: "3px",
    left: "3px",
    width: "12px",
    height: "12px",
    backgroundColor: vars.color.ash,
    backgroundImage: GLINT,
    boxShadow: `0 1px 2px color-mix(in srgb, black 55%, transparent), inset 0 1px 0 ${alpha(vars.color.firn, 35)}`,
    transitionProperty: "transform, background-color, scale",
    transitionTimingFunction: EASE.enter,
    transitionDuration: DUR.lift,
    selectors: {
        [`${toggleInput}:checked ~ &`]: {
            transform: "translateX(16px)",
            backgroundColor: vars.color.cobalt,
        },
        [`${toggle}:hover &`]: { scale: "1.1" },
    },
});

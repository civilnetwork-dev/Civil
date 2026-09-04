import type { JSX } from "@solidjs/web";

/**
 * The Civil icon set — "survey section".
 *
 * Drawn for this app, not borrowed. The four vendor families this replaced
 * (Tabler, Boxicons, Font Awesome, CG) disagreed with each other and, more
 * importantly, with the one rule the interface is most consistent about:
 * DESIGN.md's *"no border radius anywhere; corners are square."* Tabler draws
 * round caps and round joins, so every glyph in the app used to contradict it.
 *
 * ## The grid, and why it is 16 and not 24
 *
 * Icons render at 13–15px across this codebase (measured: 13px×18, 14px×15,
 * 15px×8, everything else in ones and twos). Tabler is drawn on a 24px grid
 * with a 2px stroke, so at 13px its stroke lands at ~1.08px — never on a whole
 * pixel, which is why the old glyphs read soft against a UI built from crisp
 * 0.5px and 1px rules.
 *
 * These are drawn on a **16 × 16 grid with a 1.25 stroke**, 1px safe margin,
 * 14 × 14 live area. At the dominant render sizes the geometry stays near its
 * native scale instead of being halved.
 *
 * ## What makes the set its own
 *
 * Two moves, applied consistently, and nothing else has both:
 *
 * 1. **Corner-notched containers.** A bounded region is drawn as four L-shaped
 *    corners with the sides left open, never as a closed box. This is the
 *    registration mark from the sheet model, at glyph scale — the same drawing
 *    grammar the pages use, shrunk to 16px.
 * 2. **The bedding line.** Where a glyph has a body, one horizontal rule cuts
 *    across it — the bedding plane of a geological section. It is what makes a
 *    lock, a bookmark and a lens read as members of one set rather than three
 *    unrelated pictures.
 * 3. **Section hatch.** 45° parallels marking material that has been *cut*.
 *    Only `IconBan` carries it, and that is a measured limit rather than
 *    restraint: see its comment for why hatch cannot survive a smaller region
 *    at this render size.
 *
 * Curves do not appear — with exactly one exception, `IconPatreon`, which is
 * somebody else's mark and is documented at its definition. Otherwise a circle
 * is a notched square, a globe is a graticule, a spinner is an open square
 * track. Diagonals are 45° only. Caps are butt, joins are miter.
 *
 * **Every glyph's ink is centred in its 16-unit box** unless it is on the
 * allow-list in `index.test.ts`. Two arrows that mirror each other perfectly can
 * still each be off-centre, in opposite directions — which is how back and
 * forward ended up sitting at visibly different positions in the chrome. The
 * test pins this; the allow-list is what forces an asymmetry to be deliberate.
 *
 * ## Contract
 *
 * Every export takes `size` (number, default 16) and `class`, and paints with
 * `currentColor` — the app tints with `ash` for resting glyphs and `cobalt`
 * for active. Nothing here bakes a colour.
 *
 * Three icons are deliberately **filled** — `IconCheck`, `IconAlert`,
 * `IconSpinnerFilled` — because they are verdict glyphs in the filter report
 * where filled-versus-hollow is a redundant channel alongside colour and text.
 * Their inner shapes are punched with `fill-rule="evenodd"` rather than
 * overpainted, so they survive on any ground.
 *
 * `IconPatreon` keeps the recognisable brand mark. It is someone else's asset,
 * not ours to redraw; only the container around it was restyled.
 */

export type IconProps = {
    size?: number;
    class?: string;
};

const STROKE = {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": 1.25,
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
} as const;

/**
 * The one SVG wrapper, so 31 glyphs cannot drift apart on viewBox, sizing or
 * accessibility. `aria-hidden` is unconditional: every call site in this app
 * pairs an icon with a text label or an `aria-label` on the control itself, so
 * an announced glyph would be a duplicate reading, never the only one.
 */
function icon(
    body: () => JSX.Element,
    mode: "stroke" | "fill" = "stroke",
): (props: IconProps) => JSX.Element {
    // `body` is a thunk, not an element. Solid compiles JSX to eager DOM
    // template construction, so an element built at module scope needs a
    // `document` the moment this file is imported — which breaks server render
    // and any test that imports the barrel outside a DOM environment. Deferring
    // it to render time is the whole reason for the indirection.
    return props => (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width={props.size ?? 16}
            height={props.size ?? 16}
            class={props.class}
            aria-hidden="true"
            {...(mode === "stroke" ? STROKE : { fill: "currentColor" })}
        >
            {body()}
        </svg>
    );
}

/* ------------------------------------------------------------------ */
/* Chrome and navigation — the drawing border                          */
/* ------------------------------------------------------------------ */

/**
 * The arrows carry a **datum tick** at the tail rather than a second
 * arrowhead: a dimension line in a drawing is capped, not pointed at both
 * ends, and it keeps back/forward from reading as one reversible glyph.
 *
 * Two things here are easy to get wrong and were, once:
 *
 * **The head is one path, not two.** Drawn as `M3 8L7 4` plus `M3 8L7 12` the
 * two barbs meet as a pair of butt caps crossing at the vertex, so the tip is a
 * blunt notch rather than a point. Written as a single polyline the join is a
 * miter and the point is sharp.
 *
 * **Both arrows span x 2.75→13.25.** They were 3→13.5 and 2.5→13, which is a
 * true mirror of each other but leaves each glyph a quarter-unit off centre in
 * its own box — so back and forward sat at visibly different optical positions
 * in the chrome.
 */
export const IconArrowLeft = icon(() => (
    <>
        <path d="M13.25 8H2.75" />
        <path d="M6.75 4L2.75 8l4 4" />
        <path d="M13.25 5v6" />
    </>
));

export const IconArrowRight = icon(() => (
    <>
        <path d="M2.75 8h10.5" />
        <path d="M9.25 4l4 4-4 4" />
        <path d="M2.75 5v6" />
    </>
));

/** A chevron running into a stop rule: forward *to the end*, not merely right. */
export const IconForward = icon(() => (
    <>
        <path d="M4 3.5L9 8l-5 4.5" />
        <path d="M12 3.5v9" />
    </>
));

/**
 * Reload as two square half-loops. A round arrow would be the one curve in the
 * set; squaring it costs nothing in legibility and keeps the rule intact.
 */
export const IconRefresh = icon(() => (
    <>
        <path d="M2.5 8V3.5h9" />
        <path d="M9.5 1.5l2 2-2 2" />
        <path d="M13.5 8v4.5h-9" />
        <path d="M6.5 14.5l-2-2 2-2" />
    </>
));

export const IconPlus = icon(() => <path d="M8 2.5v11M2.5 8h11" />);

export const IconClose = icon(() => <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />);

export const IconChevronDown = icon(() => (
    <path d="M3.5 5.75L8 10.25l4.5-4.5" />
));

/**
 * The lens is a notched square with a bedding line across it, so search reads
 * as *looking at a section* rather than a magnifier borrowed from every other
 * icon set.
 */
export const IconSearch = icon(() => (
    <>
        <path d="M2.25 4.75V2.25H4.75M8.25 2.25H10.75V4.75M10.75 8.25V10.75H8.25M4.75 10.75H2.25V8.25" />
        <path d="M3.75 6.5h5.5" />
        <path d="M10.75 10.75l3 3" />
    </>
));

/* ------------------------------------------------------------------ */
/* Address and state — the identification strip                        */
/* ------------------------------------------------------------------ */

/**
 * Square shackle — a radius here would be the only one in the app. The shackle
 * is narrower than the body by a clear margin: drawn at equal widths the glyph
 * stops reading as a lock and starts reading as a briefcase.
 */
export const IconLock = icon(() => (
    <>
        <path d="M6.25 7V3h3.5v4" />
        <path d="M3.5 7h9v6h-9z" />
        <path d="M3.5 10h9" />
    </>
));

/** A globe as a graticule — the survey reading of a sphere, not a drawn one. */
export const IconWorld = icon(() => (
    <>
        <path d="M2.5 2.5h11v11h-11z" />
        <path d="M2.5 6h11M2.5 10h11" />
        <path d="M6 2.5v11M10 2.5v11" />
    </>
));

/**
 * Two square hooks offset along the 45° axis, bridged by the bar they share.
 * Side by side on one baseline they closed into a box and read as a panel; the
 * diagonal offset is what makes the pair read as a chain.
 */
export const IconLink = icon(() => (
    <>
        <path d="M7.5 4H4v3.5h3.5" />
        <path d="M8.5 12H12V8.5H8.5" />
        <path d="M6.5 6.5l3 3" />
    </>
));

/**
 * The diagonal stops 0.85 short of the bracket's corner. Run all the way to
 * (12,4) its butt cap — square to a 45° run — cuts a notch straight across the
 * miter it is supposed to disappear into.
 */
export const IconArrowUpRight = icon(() => (
    <>
        <path d="M4 12l7.4-7.4" />
        <path d="M6.5 4H12v5.5" />
    </>
));

/* ------------------------------------------------------------------ */
/* Verdicts — filled/hollow is a channel, not decoration               */
/* ------------------------------------------------------------------ */

/**
 * Filled plate with the mark punched out. The check is a hand-computed
 * six-point outline rather than a stroked path, because a stroke drawn over a
 * filled plate in `currentColor` would be invisible — the glyph has to be one
 * compound path with an even-odd hole to survive on any ground.
 */
export const IconCheck = icon(
    () => (
        <path
            fill-rule="evenodd"
            d="M2 2h12v12H2z M4 9l3.1 3.1L12 7.2l-1.2-1.2-3.7 3.7-1.9-1.9z"
        />
    ),
    "fill",
);

export const IconAlert = icon(
    () => (
        <path
            fill-rule="evenodd"
            d="M2 2h12v12H2z M7.25 3.6h1.5v5.8h-1.5z M7.25 10.6h1.5v1.5h-1.5z"
        />
    ),
    "fill",
);

/**
 * A closed plate struck through at 45°, with the material **section-hatched**
 * either side of the strike. In a drawing, hatch means *this is cut* — which is
 * exactly what a blocked route is. Nothing else in the app hatches, so this is
 * the one glyph that says "severed" rather than merely "no".
 *
 * Drawn with notched corners instead, the open sides plus a diagonal read as a
 * fullscreen control — the exact wrong meaning for the page nobody chooses to
 * open. The container closes here and the strike does the work.
 *
 * **Hatch spacing is 4 units, and that number is a floor, not a preference.**
 * These render at 13px, i.e. 0.81px per unit, against a 1.25-unit stroke. At
 * the 2.5-unit spacing that reads correctly on paper the gaps come out near 1px
 * against a 1px line and the region fills to solid grey. Four units gives a
 * ~3.3px gap at render, which is the tightest that still reads as separate
 * lines. The hatch is also terminated on the plate's inner edge rather than run
 * to the frame — an overshooting hatch line is the same defect as a bar whose
 * corners escape the counter it belongs to.
 */
export const IconBan = icon(() => (
    <>
        <path d="M2.5 2.5h11v11h-11z" />
        <path d="M4 12L12 4" />
        <path d="M3.2 7.14L7.14 3.2M8.86 12.8L12.8 8.86" />
    </>
));

/** An open square track. The gap is what reads as motion once it rotates. */
export const IconSpinner = icon(() => <path d="M2.5 8V2.5h11v11h-11V11" />);

export const IconSpinnerFilled = icon(
    () => <path fill-rule="evenodd" d="M2 2h12v12H2z M5.5 5.5h5v5h-5z" />,
    "fill",
);

/* ------------------------------------------------------------------ */
/* Objects — the things pages are lists of                             */
/* ------------------------------------------------------------------ */

const BOOKMARK = "M4 2.5h8v11l-4-3.5-4 3.5z";

/** Carries the bedding line; the plain outline below is the unmarked variant. */
export const IconBookmark = icon(() => (
    <>
        <path d={BOOKMARK} />
        <path d="M4 6.5h8" />
    </>
));

export const IconBookmarkFilled = icon(() => <path d={BOOKMARK} />, "fill");

export const IconBookmarkOutline = icon(() => <path d={BOOKMARK} />);

/**
 * Every corner 90°; a puzzle piece with round tabs would break the grid. One
 * tab and one socket, not four — a symmetric piece reads as a bracket cluster
 * at 13px, where the asymmetry is the only thing that says "this interlocks".
 */
export const IconPuzzle = icon(() => (
    <path d="M2.5 5.5h2v-3h3v3h6v2h-2v3h2v3h-11z" />
));

/**
 * The face closes. With notched corners the four Ls read as registration
 * marks — which is what they are everywhere else in this app — and the hands
 * disappeared into them.
 */
export const IconClock = icon(() => (
    <>
        <path d="M2.5 2.5h11v11h-11z" />
        <path d="M8 4.5V8h3.5" />
    </>
));

export const IconTrash = icon(() => (
    <>
        <path d="M3 4.5h10" />
        <path d="M6 4.5V2.5h4v2" />
        <path d="M4.5 4.5v9h7v-9" />
        <path d="M4.5 10h7" />
    </>
));

/* ------------------------------------------------------------------ */
/* Panels — devtools docking                                           */
/* ------------------------------------------------------------------ */

const PANEL = "M2.5 2.5h11v11h-11z";

export const IconLayoutNavbar = icon(() => (
    <>
        <path d={PANEL} />
        <path d="M2.5 6h11" />
    </>
));

export const IconLayoutBottom = icon(() => (
    <>
        <path d={PANEL} />
        <path d="M2.5 10h11" />
    </>
));

export const IconLayoutSidebar = icon(() => (
    <>
        <path d={PANEL} />
        <path d="M6.5 2.5v11" />
    </>
));

export const IconLayoutSidebarRight = icon(() => (
    <>
        <path d={PANEL} />
        <path d="M9.5 2.5v11" />
    </>
));

/* ------------------------------------------------------------------ */
/* Transfer                                                            */
/* ------------------------------------------------------------------ */

/** The rule underneath is the datum the file leaves from, not a tray. */
export const IconUpload = icon(() => (
    <>
        <path d="M8 12v-9" />
        <path d="M4.5 6.5L8 3l3.5 3.5" />
        <path d="M2.5 13h11" />
    </>
));

/**
 * Eight ticks on a ring — a bearing rose, spun by CSS.
 *
 * Every tick runs the same radial band, 6 out to 4 in. Written as a flat
 * `l 1.4 1.4` the diagonals ran 5.66→3.68 instead, so the rose was not round:
 * the four corners sat closer to the centre than the four cardinals and the
 * whole thing wobbled as it turned. The diagonal endpoints are 6/√2 and 4/√2
 * off centre, which is what puts all eight on one circle.
 */
export const IconLoader = icon(() => (
    <path d="M8 2v2M8 12v2M2 8h2M12 8h2M3.757 3.757L5.172 5.172M12.243 3.757L10.828 5.172M3.757 12.243L5.172 10.828M12.243 12.243L10.828 10.828" />
));

export const IconLoaderDots = icon(
    () => <path d="M3 7h2v2H3z M7 7h2v2H7z M11 7h2v2h-2z" />,
    "fill",
);

/* ------------------------------------------------------------------ */
/* Third party                                                         */
/* ------------------------------------------------------------------ */

/**
 * Patreon's own mark, and **the one glyph in this set that has curves**.
 *
 * The set's rule is that curves do not appear; this is the stated exception,
 * and it is worth being precise about why. Patreon rebranded in October 2023.
 * The mark this replaced — a disc beside a separate vertical bar — is the
 * *pre-2023* logo, and shipping it was simply wrong. The current symbol is an
 * organic, bulbous "P" whose stem and bowl read as one continuous mass, which
 * cannot be put on a 16-unit square grid at 45° increments and still be
 * Patreon's mark.
 *
 * Given the choice between breaking our own drawing rule and misrepresenting
 * someone else's brand, breaking our own rule is the cheaper mistake. A
 * redrawn brand asset is a worse brand asset.
 *
 * Two overlapping subpaths under the default `nonzero` fill, so they union into
 * one seamless shape — that merge is the whole point of the new mark. Do **not**
 * add `fill-rule="evenodd"` here: it would punch the overlap out and split the
 * P back into the two-piece logo this replaced.
 *
 * Patreon states the mark has no single canonical form, so this is a faithful
 * flat reduction rather than a trace of one file.
 */
export const IconPatreon = icon(
    () => (
        <path d="M2.2 2.9C2.2 2.4 2.6 2 3.1 2h1.6c.5 0 .9.4.9.9v10.2c0 .5-.4.9-.9.9H3.1c-.5 0-.9-.4-.9-.9zM9.8 2.2c2.5 0 4.5 1.9 4.5 4.4 0 2.6-1.9 4.4-4.4 4.4-2.8 0-5.1-1.9-5.1-4.4 0-2.6 2.4-4.4 5-4.4z" />
    ),
    "fill",
);

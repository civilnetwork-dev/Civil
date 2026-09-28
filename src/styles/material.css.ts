/**
 * Strata: the material the whole interface is cut from.
 *
 * The palette is geological (basalt, stratum, scree, talus, firn), so the
 * material takes it literally. Anything you can press is a slab of layered
 * stone whose exposed side shows its sediment bands. Anything you can type
 * into is a well carved into that stone. Large icons are mineral specimens
 * (see Specimen.css.ts), and every page sits on a ground of faint survey
 * contours that drift very slowly.
 *
 * Height is the meaning, which is what keeps a textured interface easy to
 * read: flat is text, raised is pressable, carved is typeable. Hover raises a
 * slab one step; pressing sinks it into its bed.
 *
 * This retires two earlier languages on purpose. "Backlit Instrumentation"
 * simulated light on machined panels, and the schematic language that replaced
 * it drew hairlines on a flat ruled field with no depth at all. The owner asked
 * for depth, texture and a page that feels alive, so the flat rules went with
 * it (DESIGN.md records why). What was kept is the constraint behind them: the
 * primary reader is on a low-end school Chromebook. So nothing here blurs a
 * backdrop, the textures are static images rasterised once, hard-offset edges
 * paint once and cost nothing to hold, only the element under the pointer
 * transitions its shadow, and the one ambient animation per document moves a
 * single composited layer.
 *
 * Every export below is consumed by other `.css.ts` files only, never by a
 * component, so the functions here are never serialised. The recipes are plain
 * style objects; `blend()` spreads them into a component's own `style()`.
 */

import { createVar, keyframes, type StyleRule } from "@vanilla-extract/css";

import { vars } from "./theme.css";

/* -------------------------------------------------------------------- */
/* Motion                                                                */
/* -------------------------------------------------------------------- */

/**
 * Two easings, each with a job.
 * `standard` for state changes; `spring` for anything that should feel
 * physically seated when it lands (toggles, tiles, pop-ins).
 */
export const EASE = {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    /** Decelerate-only: entrances that shouldn't overshoot. */
    enter: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

/**
 * `fast` is hover/press feedback on a control under the cursor, `base` is a
 * state change you're meant to notice, `slow` is a whole-element entrance,
 * and `lift` is a slab rising or settling: long enough to read as weight,
 * short enough that a pointer sweeping across a row of keys never waits.
 */
export const DUR = {
    fast: "0.11s",
    base: "0.18s",
    slow: "0.28s",
    lift: "0.26s",
} as const;

/* -------------------------------------------------------------------- */
/* Geometry helpers                                                      */
/* -------------------------------------------------------------------- */

/**
 * A hairline rule that fades at both ends, so a divider reads as etched
 * into the panel rather than drawn edge to edge with a ruler.
 *
 * Returns a gradient *value*, not a border shorthand, so it cannot sit in
 * `borderTop` directly — pair it with `borderImage`, as the ledger dividers do.
 */
export const hairline = (color: string = vars.color.talus) =>
    `linear-gradient(90deg, transparent 0%, ${color} 12%, ${color} 88%, transparent 100%)`;

/**
 * Expands an element's clickable area to at least `size`×`size` without
 * changing how big it looks or disturbing layout.
 *
 * DESIGN.md deliberately sizes icon controls at 18–30px for instrument-panel
 * density, but WCAG 2.2 SC 2.5.8 asks for a 24×24 minimum target. Rather than
 * inflate the visuals and lose the density, this centres an invisible
 * pseudo-element over the control and lets that catch the pointer.
 *
 * Spread into a `selectors` entry for `&::after`; the host needs a
 * non-static `position` so the overlay is measured against it.
 */
export const hitArea = (size = 24) =>
    ({
        content: '""',
        position: "absolute",
        top: "50%",
        left: "50%",
        width: `max(100%, ${size}px)`,
        height: `max(100%, ${size}px)`,
        transform: "translate(-50%, -50%)",
    }) as const;

/* -------------------------------------------------------------------- */
/* Strata                                                                */
/* -------------------------------------------------------------------- */

const { basalt, stratum, scree, talus, firn, cobalt } = vars.color;

export const mix = (a: string, pct: number, b: string) =>
    `color-mix(in oklab, ${a} ${pct}%, ${b})`;
export const alpha = (color: string, pct: number) =>
    `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/**
 * Stone grain: fractal noise baked into a 180px SVG. As a background image it
 * is rasterised once and tiled, so it costs a texture, not a filter pass.
 */
export const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .08 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E")`;

/** The survey sheet under every page; the tile repeats without a seam. */
export const TERRAIN = 'url("/assets/terrain.svg")';

/** The two sediment tones a neutral slab's side is banded in. */
export const BAND = {
    light: mix(talus, 70, basalt),
    dark: mix(scree, 45, basalt),
} as const;

/**
 * Light and its absence. Shadows are the one place black appears: a shadow is
 * missing light, not a surface colour, so it sits outside the palette's
 * no-pure-black rule.
 */
export const SHADE = {
    /** The lit top lip of any raised face. */
    lip: `inset 0 1px 0 ${alpha(firn, 8)}`,
    /** Contact shadow under a slab resting on the ground. */
    near: `0 10px 18px -10px ${alpha(basalt, 85)}`,
    /** The same slab lifted clear of it. */
    far: `0 22px 32px -14px ${alpha(basalt, 92)}`,
    /** The shaded upper wall inside a carved well. */
    pit: "inset 0 2px 5px color-mix(in srgb, black 55%, transparent)",
} as const;

/**
 * A slab's exposed side: `px` one-pixel bands alternating two tones, then a
 * contact shadow. The bands are hard offsets with no blur, so they rasterise
 * once and read as sediment rather than as a glow.
 *
 * `slots` fixes the length of the list. Every state of one element has to
 * emit the same layers in the same order: a browser interpolates box-shadow
 * lists position by position, so a 3-band rest paired with a 5-band hover
 * turns the soft contact shadow into a hard band halfway through the hover.
 * Bands beyond `px` sit at `px`, tucked under the last visible band, so a
 * growing edge slides its bands out rather than popping them in.
 */
export const edge = (
    px: number,
    light: string = BAND.light,
    dark: string = BAND.dark,
    drop: string = SHADE.near,
    slots = px,
) =>
    [
        ...Array.from(
            { length: slots },
            (_, i) => `0 ${Math.min(i + 1, px)}px 0 ${i % 2 ? dark : light}`,
        ),
        drop,
    ].join(", ");

/**
 * Light on a raised face, with grain over it: a firn wash along the top edge
 * fading out by 60%. It does not depend on the face's colour, so a face can
 * change colour under the pointer while its light stays put. Only
 * `background-color` transitions; an image never swaps mid-hover.
 */
export const LIT = `${GRAIN}, linear-gradient(180deg, ${alpha(firn, 10)}, transparent 60%)`;

/**
 * How far a slab stands off its bed, applied as `translate: 0 ${elevation}`.
 *
 * It is a registered length so the lift runs on the main thread. A transform
 * transition runs on the compositor, which carries the slab's label as a
 * cached bitmap at fractional device pixels (a 2px rise is 2.5 of them at
 * 125%) and repaints it sharp only when the transition ends: every label
 * blurred through the lift, then snapped. A length transition repaints the
 * slab each frame instead, text included, as its shadow transition already
 * does. Not inherited, so a key inside a lifting tile keeps its own height.
 */
export const elevation = createVar({
    syntax: "<length>",
    inherits: false,
    initialValue: "0px",
});

/**
 * How a slab moves. Face, edge and colour share one decelerating curve and
 * one duration, so the face and the sediment under it travel together and the
 * slab's foot stays planted: nothing on a hover overshoots.
 */
export const LIFT = [
    // The bare `--name`: a transition list names the property, not var().
    `${elevation.slice("var(".length, -1)} ${DUR.lift} ${EASE.enter}`,
    `box-shadow ${DUR.lift} ${EASE.enter}`,
    `background-color ${DUR.lift} ${EASE.enter}`,
    `color ${DUR.base} ${EASE.standard}`,
].join(", ");

/**
 * Hit bands. An element that moves under the pointer must never slide out
 * from under it by its own motion: hover drops, the element settles back,
 * catches the pointer again, and the cursor strobes between hand and arrow.
 *
 * So a band exists only in a state that moved, and covers the ground that
 * motion uncovered plus a pixel. At rest there is none, so the rest hit box
 * is exactly the element and nothing outside it can start a hover. A band is
 * the element's own pseudo-element, so a press released on it still clicks.
 *
 * `reach(above, below)` overlays the element itself, which is only safe on a
 * control with no controls inside it. `skirt(lift)` hangs outside a
 * container's bottom edge, clear of the buttons it holds.
 */
const reach = (above: number, below: number) =>
    ({
        content: '""',
        position: "absolute",
        inset: `${above ? -above : 0}px 0 ${below ? -below : 0}px`,
    }) as const;

export const skirt = (lift: number) =>
    ({
        content: '""',
        position: "absolute",
        left: 0,
        right: 0,
        top: "100%",
        height: `${lift + 1}px`,
    }) as const;

/**
 * Merges style rules for `style()`, including their `selectors` and `@media`
 * maps, key by key. Recipes are spread through this rather than composed as
 * classes: composition yields a class *list*, and a list cannot stand in a
 * `.${cls}` selector in a `globalStyle` or a test, where a single class can.
 */
export function blend(...rules: StyleRule[]): StyleRule {
    type Entries = Record<string, object>;
    const out: StyleRule = {};
    const selectors: Entries = {};
    const media: Entries = {};
    const merge = (into: Entries, from: Entries = {}) => {
        for (const [key, value] of Object.entries(from)) {
            into[key] = { ...into[key], ...value };
        }
    };
    for (const rule of rules) {
        Object.assign(out, rule);
        merge(selectors, rule.selectors);
        merge(media, rule["@media"]);
    }
    return { ...out, selectors, "@media": media };
}

// A highlight that never changes, laid over a colour that does, so a gem or a
// knob changes state by fading its colour; gradients themselves cannot
// transition and would swap in one frame.
export const GLINT = `radial-gradient(circle at 35% 30%, ${alpha(vars.color.firn, 55)}, transparent 55%)`;

/** How far a pressable slab rises under the pointer. */
const RISE_PX = 2;

/**
 * A slab you can press. It rests on `px` of edge, rises two pixels on hover
 * while its edge grows by the same two, so its foot stays planted, and sinks
 * into its bed while held. All three states carry `px + 2` band slots.
 */
function pressable(
    surface: string,
    px: number,
    {
        light = BAND.light as string,
        dark = BAND.dark as string,
        lip = SHADE.lip as string,
    } = {},
): StyleRule {
    const slots = px + RISE_PX;
    const sink = px - 1;
    const shadow = (bands: number, drop: string) =>
        `${lip}, ${edge(bands, light, dark, drop, slots)}`;
    return {
        position: "relative",
        translate: `0 ${elevation}`,
        backgroundColor: surface,
        backgroundImage: LIT,
        boxShadow: shadow(px, SHADE.near),
        transition: LIFT,
        selectors: {
            "&:hover:not(:disabled)": {
                vars: { [elevation]: `-${RISE_PX}px` },
                boxShadow: shadow(px + RISE_PX, SHADE.far),
            },
            "&:hover:not(:disabled)::before": reach(0, RISE_PX + 1),
            "&:active:not(:disabled)": {
                vars: { [elevation]: `${sink}px` },
                boxShadow: shadow(1, SHADE.near),
                transitionDuration: "90ms",
            },
            // From risen to sunk is the whole travel, so the band reaches that
            // far above as well as a pixel below.
            "&:active:not(:disabled)::before": reach(RISE_PX + sink + 1, 1),
        },
    };
}

/** Secondary buttons and text actions: a plain stone key. */
export const KEY_STONE = pressable(scree, 3);

const KEYCAP_FACE_COLOR = mix(talus, 40, scree);
const PEBBLE_FACE_COLOR = mix(talus, 28, scree);

/** Icon buttons in toolbars: a low keycap a shade above the toolbar. */
export const KEYCAP = pressable(KEYCAP_FACE_COLOR, 2);

/** Chips: bookmarks, categories, detected filters. One band high. */
export const PEBBLE = pressable(PEBBLE_FACE_COLOR, 1);

/**
 * The same faces, still: for things drawn as keys and chips that are not
 * pressable (keyboard hints, detected filters). Raised means pressable, so
 * these never rise.
 */
export const KEYCAP_FACE: StyleRule = {
    backgroundColor: KEYCAP_FACE_COLOR,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(2)}`,
};

export const PEBBLE_FACE: StyleRule = {
    backgroundColor: PEBBLE_FACE_COLOR,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(1)}`,
};

/**
 * The one cobalt key per view. Its sediment is cobalt sunk toward basalt, and
 * its label stays basalt: firn on cobalt measures 3.2:1 and fails AA, basalt
 * measures 6.1:1.
 */
export const KEY_COBALT = blend(
    pressable(cobalt, 3, {
        light: mix(cobalt, 62, basalt),
        dark: mix(cobalt, 40, basalt),
        lip: `inset 0 1px 0 ${alpha(firn, 38)}`,
    }),
    { color: basalt, fontWeight: 600 },
);

/** Floating things (menus, pickers, toasts, the stop card): a thick slab. */
export const PLATE: StyleRule = {
    backgroundColor: scree,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(6, BAND.light, BAND.dark, SHADE.far)}`,
};

const TABLET_FACE = mix(scree, 70, stratum);

/** A content bed that holds rows: raised off the ground, not pressable. */
export const TABLET: StyleRule = {
    backgroundColor: TABLET_FACE,
    backgroundImage: LIT,
    boxShadow: `${SHADE.lip}, ${edge(4)}`,
};

const WELL_LIP = `0 1px 0 ${alpha(firn, 7)}`;

// Every state of a well has the same four layers (shaded wall, meltwater
// glow, rim, lit lip), so hover and focus fade rather than jump.
const wellShadow = (glow: string, rim: string) =>
    [
        SHADE.pit,
        `inset 0 0 18px ${glow}`,
        `inset 0 0 0 1px ${rim}`,
        WELL_LIP,
    ].join(", ");

/**
 * A well's focused rim, for the one field (the address bar) that also stays
 * lit while its suggestions are open.
 */
export const WELL_FOCUS = wellShadow(alpha(cobalt, 22), cobalt);

/**
 * A field carved into the stone. The upper wall is in shadow, the lower rim
 * catches the light, and focus floods the rim with cobalt meltwater. The row
 * carries focus; the input inside draws no ring of its own.
 */
export const WELL: StyleRule = {
    backgroundColor: basalt,
    backgroundImage: `${GRAIN}, linear-gradient(180deg, ${basalt}, ${mix(basalt, 72, stratum)})`,
    boxShadow: wellShadow(alpha(cobalt, 0), alpha(basalt, 70)),
    transition: `box-shadow ${DUR.lift} ${EASE.enter}`,
    selectors: {
        "&:hover": {
            boxShadow: wellShadow(alpha(cobalt, 0), alpha(talus, 90)),
        },
        "&:focus-within": { boxShadow: WELL_FOCUS },
    },
};

/** A row risen under the pointer or keyboard; see ROW_LIFT. */
export const ROW_UP = {
    backgroundColor: mix(talus, 35, scree),
    boxShadow: `${SHADE.lip}, ${edge(2)}`,
};

/**
 * A row on a tablet. Flat at rest, so a long list stays calm; under the
 * pointer or keyboard focus it rises into a small chip: its face lightens and
 * a lit lip and two sediment bands appear. It rises in light, not in space. A
 * row that moved would slide its own edge out from under a pointer resting
 * on it, so it does not move.
 */
export const ROW_LIFT: StyleRule = {
    position: "relative",
    borderRadius: "10px",
    transition: LIFT,
    selectors: { "&:hover, &:focus-within": ROW_UP },
};

/**
 * Entrance: a slab rises out of the ground. Always used with `backwards`
 * fill, not `both`, so once it lands the element's own hover transform is
 * free to apply again.
 */
export const riseIn = keyframes({
    from: { opacity: 0, transform: "translateY(10px)" },
});

/** The entrance as an `animation` value; delay it to stagger siblings. */
export const RISE = `${riseIn} 560ms ${EASE.enter} backwards`;

const drift = keyframes({
    to: { transform: "translate3d(-180px, -120px, 0)" },
});

const breathe = keyframes({
    from: { opacity: 0.55 },
    to: { opacity: 1 },
});

/**
 * The ground every page stands on: stratum, the survey contours on one fixed
 * layer that drifts a few hundred pixels over four minutes, and grain under a
 * cobalt dawn at the top edge that breathes over eighteen seconds. Both are
 * fixed pseudo-elements, so they cover the viewport however short the page
 * is, the page gains no DOM, and both animate only transform or opacity. The
 * contour layer overhangs right and bottom by the drift distance so its edge
 * never comes into view.
 */
export const GROUND: StyleRule = {
    position: "relative",
    isolation: "isolate",
    backgroundColor: stratum,
    selectors: {
        "&::before": {
            content: '""',
            position: "fixed",
            inset: "0 -200px -200px 0",
            zIndex: -1,
            backgroundImage: TERRAIN,
            backgroundSize: "720px 720px",
            opacity: 0.07,
            pointerEvents: "none",
            animation: `${drift} 240s linear infinite alternate`,
        },
        "&::after": {
            content: '""',
            position: "fixed",
            inset: 0,
            zIndex: -1,
            backgroundImage: `${GRAIN}, radial-gradient(110% 55% at 50% -8%, ${alpha(cobalt, 14)}, transparent 62%)`,
            pointerEvents: "none",
            animation: `${breathe} 18s ${EASE.standard} infinite alternate`,
        },
    },
};

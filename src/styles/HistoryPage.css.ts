import { keyframes, style } from "@vanilla-extract/css";
import { PAGE_PADDING } from "./layout.css";
import {
    atmosphere,
    DUR,
    EASE,
    focusRing,
    hitArea,
    lit,
    machined,
    microLabel,
    readout,
    SHADOW,
} from "./material.css";
import { vars } from "./theme.css";

const emptyFadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(6px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const root = style({
    ...atmosphere(vars.color.sirius),
    minHeight: "100vh",
    padding: PAGE_PADDING,
    color: vars.color.daylight,
    fontFamily: '"Rubik", sans-serif',
});

// Muted destructive tint, matching the system's Status Triad recipe -
// a solid red block would be the one full-saturation "alert" shout the
// palette otherwise never makes.
export const clearBtn = style({
    backgroundColor: `color-mix(in srgb, ${vars.color.antares} 12%, ${vars.color.horizon})`,
    color: vars.color.antares,
    border: `1px solid color-mix(in srgb, ${vars.color.antares} 35%, transparent)`,
    borderRadius: "8px",
    padding: "6px 16px",
    fontSize: "14px",
    fontWeight: 500,
    cursor: "pointer",
    transition: "opacity 0.15s, background 0.15s, border-color 0.15s",
    transitionDuration: "0.15s",
    selectors: {
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.antares} 20%, ${vars.color.horizon})`,
            borderColor: `color-mix(in srgb, ${vars.color.antares} 55%, transparent)`,
        },
    },
});

// Armed state for the second click - the same button, stated plainly, rather
// than a colour change alone carrying the whole message.
export const clearBtnArmed = style({
    background: `color-mix(in srgb, ${vars.color.antares} 26%, ${vars.color.horizon})`,
    borderColor: vars.color.antares,
    color: vars.color.daylight,
    selectors: {
        // You are necessarily hovering the button you just clicked, and
        // `clearBtn:hover` outranks a plain class - so without this the armed
        // colours never rendered at all and only the label changed.
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.antares} 34%, ${vars.color.horizon})`,
            borderColor: vars.color.antares,
        },
    },
});

/**
 * The scope bar states what you are currently looking at. It sits between the
 * masthead and the record itself because the filter doesn't only hide rows -
 * the day charts below recompute from it, so narrowing to a domain turns the
 * whole page into "when did I visit this".
 */
export const scopeBar = style({
    display: "flex",
    alignItems: "center",
    gap: "18px",
    marginBottom: "26px",
    flexWrap: "wrap",
});

export const filterField = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: "1 1 260px",
    maxWidth: "420px",
    height: "36px",
    padding: "0 8px 0 12px",
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "9px",
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "border-color, box-shadow",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.base,
    selectors: {
        "&:focus-within": {
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
            boxShadow: lit(focusRing(vars.color.sirius), true),
        },
    },
});

export const filterIcon = style({
    flexShrink: 0,
    color: vars.color.cinder,
    transition: `color ${DUR.base} ${EASE.standard}`,
    selectors: {
        [`${filterField}:focus-within &`]: { color: vars.color.sirius },
    },
});

export const filterInput = style({
    flex: 1,
    minWidth: 0,
    border: "none",
    background: "transparent",
    outline: "none",
    color: vars.color.daylight,
    fontFamily: "inherit",
    fontSize: "13.5px",
    caretColor: vars.color.sirius,
    selectors: {
        "&::placeholder": { color: vars.color.ember },
        "&::selection": {
            background: `color-mix(in srgb, ${vars.color.sirius} 28%, transparent)`,
        },
    },
});

// The shortcut is advertised on the control it operates, and steps aside as
// soon as there's a query to clear.
export const filterHint = style({
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "18px",
    height: "18px",
    marginRight: "4px",
    borderRadius: "5px",
    border: `1px solid ${vars.color.haze}`,
    background: `color-mix(in srgb, ${vars.color.haze} 40%, transparent)`,
    color: vars.color.cinder,
    fontFamily: "inherit",
    fontSize: "11px",
    lineHeight: 1,
    transition: `opacity ${DUR.base} ${EASE.standard}`,
    selectors: {
        [`${filterField}:focus-within &`]: { opacity: 0 },
    },
});

export const filterClear = style({
    position: "relative",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    width: "22px",
    height: "22px",
    marginRight: "2px",
    padding: 0,
    border: "none",
    borderRadius: "6px",
    background: "transparent",
    color: vars.color.cinder,
    cursor: "pointer",
    transitionProperty: "color, background",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&::after": hitArea(),
        "&:hover": {
            background: `color-mix(in srgb, ${vars.color.haze} 70%, transparent)`,
            color: vars.color.daylight,
        },
    },
});

/**
 * A readout, not a sentence: the figures carry tabular digits and the words
 * between them drop to label weight so the numbers are what you scan.
 *
 * It sits beside the filter rather than out on the right margin. Right-aligned
 * it landed directly under the storage Select, whose open menu clipped the
 * leading digit - and it belongs next to the control that changes it anyway.
 */
export const scopeStat = style({
    ...readout,
    display: "flex",
    alignItems: "baseline",
    gap: "5px",
    fontSize: "13px",
    color: vars.color.daylight,
});

export const scopeStatNum = style({
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
});

export const scopeStatWord = style({
    ...microLabel,
    fontSize: "10px",
    color: vars.color.cinder,
});

export const scopeStatSep = style({
    alignSelf: "center",
    width: "3px",
    height: "3px",
    margin: "0 3px",
    borderRadius: "50%",
    background: vars.color.dust,
});

export const list = style({
    display: "flex",
    flexDirection: "column",
    gap: "22px",
});

// One group per day. The rail lives in a gutter owned by the group rather
// than inside each row: drawn inside the rows it collided with their borders
// and read as a bullet stuck to the card edge instead of a continuous track.
// Soft ends mean the line doesn't need to land on an exact pixel to look
// like it begins and ends at the first and last markers.
export const dayGroup = style({
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    paddingLeft: "30px",
    selectors: {
        "&::before": {
            content: '""',
            position: "absolute",
            left: "8px",
            top: "30px",
            bottom: "16px",
            width: "1px",
            background: `linear-gradient(to bottom, transparent 0, ${vars.color.haze} 16px, ${vars.color.haze} calc(100% - 16px), transparent 100%)`,
        },
    },
});

export const dayHeader = style({
    display: "flex",
    alignItems: "flex-end",
    // No flex gap: the chart's baseline and `dayRule` have to meet flush or
    // the section rule reads as two broken segments. Spacing is applied as
    // margins on the text ends instead.
    gap: 0,
    marginBottom: "9px",
    "@media": {
        // Narrow: the chart takes its own line under the date. Left in the
        // row it had to absorb whatever the label didn't use, so every group
        // got a different width and the same hour sat at a different x on
        // each one. Full width also buys the columns more room than they had
        // on desktop.
        "screen and (max-width: 560px)": { flexWrap: "wrap" },
    },
});

export const dayLabel = style({
    ...microLabel,
    // Never gives up space to the chart - shrinking proportionally, "Today"
    // was clipped to "Tod…" on a phone while the chart kept 176px. The cap
    // still lets a long date ("Wednesday, Sep 24") ellipsise rather than
    // pushing the row wider than its container.
    flexShrink: 0,
    maxWidth: "45%",
    lineHeight: 1,
    marginRight: "14px",
    paddingBottom: "4px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

/**
 * A day's browsing plotted against its own 24 hours: one column per hour,
 * height proportional to that day's busiest hour. The page is already holding
 * every timestamp - this is the one place in the product where that shape is
 * visible, and it's what makes a day divider worth more than a date caption.
 *
 * The columns sit on a baseline that runs on into `dayRule` and fades out to
 * the right, so the chart reads as part of the section rule the date is
 * written on rather than a widget dropped into the header.
 */
export const dayMeter = style({
    position: "relative",
    // Fixed width, not fluid: stretched across a 1000px header the 24 columns
    // stop reading as a compact instrument and become a wall chart that
    // outweighs the entries underneath it.
    // Right-hand seat, after the rule: date labels vary from "Today" to
    // "Wednesday, Sep 24", so a chart placed straight after the label started
    // at a different x on every group and the column looked misaligned.
    // Anchoring it to the count instead keeps every chart on one axis.
    // It shrinks rather than overflowing on narrow screens; the columns
    // bottom out at 2px each.
    flex: "0 1 216px",
    display: "flex",
    "@media": {
        "screen and (max-width: 560px)": {
            order: 1,
            flexBasis: "100%",
            marginTop: "10px",
        },
    },
    alignItems: "flex-end",
    gap: "1px",
    // The extra 5px below the baseline is the gutter the hour notches hang
    // into, which is what makes this read as a plotted axis.
    height: "21px",
    paddingBottom: "5px",
    cursor: "default",
    selectors: {
        // `dayRule` runs into this flush on its left, so the two read as one
        // continuous section rule with the chart sitting on the part of it
        // the day actually occupies.
        "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "4px",
            height: "1px",
            background: vars.color.haze,
        },
    },
});

export const dayRule = style({
    flex: "1 1 12px",
    minWidth: 0,
    height: "1px",
    marginBottom: "4px",
    // Fades in from the date and runs solid into the chart's baseline.
    background: `linear-gradient(90deg, transparent, ${vars.color.haze} 22%)`,
    "@media": {
        // Below this the rule is all that's left to give up before the chart
        // starts losing columns.
        "screen and (max-width: 560px)": { display: "none" },
    },
});

export const dayMeterBar = style({
    position: "relative",
    flex: 1,
    minWidth: "2px",
    height: "100%",
    selectors: {
        // Every column carries an hour tooltip, so every column has to
        // acknowledge the pointer - an empty hour that stayed inert read as
        // dead space you'd hovered by mistake.
        "&:hover::after": {
            background: vars.color.ember,
        },
        // The column itself is a full-height track; the bar is drawn inside
        // it, anchored to the baseline. That keeps the hour grid addressable
        // for the quarter-day guides below.
        "&::after": {
            content: '""',
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "max(2px, var(--fill, 0%))",
            borderRadius: "1.5px",
            // Dimmer than the baseline it stands on. At full `surface1` the
            // empty hours merged with the rule and thickened it into a
            // dashed band instead of reading as an empty grid.
            background: `color-mix(in srgb, ${vars.color.haze} 55%, transparent)`,
            transitionProperty: "background, box-shadow",
            transitionTimingFunction: EASE.standard,
            transitionDuration: DUR.fast,
        },
    },
});

export const dayMeterBarOn = style({
    selectors: {
        "&::after": {
            background: `linear-gradient(to top, color-mix(in srgb, ${vars.color.sirius} 45%, ${vars.color.haze}), ${vars.color.sirius})`,
        },
        // Scrubbing the chart lights the hour under the pointer, the same
        // gesture the rail markers use on the rows below.
        "&:hover::after": {
            background: vars.color.sirius,
            boxShadow: `0 0 8px color-mix(in srgb, ${vars.color.sirius} 65%, transparent)`,
        },
    },
});

// Faint guides at 00:00 / 06:00 / 12:00 / 18:00 so the strip can be read as
// a clock rather than an abstract sparkline. They hang below the baseline as
// notches: drawn up through the plot area at column height they outranked the
// bars and read as the data instead of the axis.
export const dayMeterBarTick = style({
    selectors: {
        "&::before": {
            content: '""',
            position: "absolute",
            left: 0,
            bottom: "-4px",
            height: "3px",
            width: "1px",
            background: vars.color.haze,
        },
    },
});

export const dayCount = style({
    ...readout,
    flexShrink: 0,
    display: "flex",
    alignItems: "baseline",
    gap: "4px",
    lineHeight: 1,
    // Fixed width, right-aligned: the chart is anchored to this edge, so a
    // "1 page" group must not shift its chart relative to an "11 pages" one.
    justifyContent: "flex-end",
    minWidth: "74px",
    marginLeft: "14px",
    "@media": {
        // The rule is gone at this width, so the count needs its own push to
        // stay on the right of the date.
        "screen and (max-width: 560px)": { marginLeft: "auto" },
    },
    paddingBottom: "4px",
    fontSize: "12px",
    color: vars.color.moonlight,
});

export const dayCountUnit = style({
    ...microLabel,
    fontSize: "10px",
    color: vars.color.cinder,
});

export const entry = style({
    position: "relative",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "11px 16px",
    borderRadius: "10px",
    background: machined(vars.color.horizon, vars.color.night),
    border: `1px solid ${vars.color.haze}`,
    boxShadow: lit(SHADOW.resting),
    transitionProperty: "background, transform, box-shadow, border-color",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            transform: "translateX(3px)",
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 38%, ${vars.color.haze})`,
            boxShadow: lit(SHADOW.lifted),
        },
        // The marker for this entry's moment, sitting out on the group's
        // rail rather than inside the card.
        "&::after": {
            content: '""',
            position: "absolute",
            left: "-26px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: vars.color.ember,
            // A moat in the page colour keeps the rail from running visibly
            // through the marker.
            boxShadow: `0 0 0 4px ${vars.color.dusk}, inset 0 1px 1px rgba(255,255,255,0.28)`,
            zIndex: 1,
            transitionProperty: "background, box-shadow",
            transitionTimingFunction: EASE.standard,
            transitionDuration: DUR.fast,
        },
        // The marker lights up for the row under the pointer - the rail
        // reads as a live readout being scrubbed rather than static chrome.
        "&:hover::after": {
            background: vars.color.sirius,
            boxShadow: `0 0 0 4px ${vars.color.dusk}, 0 0 10px color-mix(in srgb, ${vars.color.sirius} 70%, transparent)`,
        },
    },
});

export const favicon = style({
    width: "16px",
    height: "16px",
    borderRadius: "4px",
    objectFit: "contain",
    flexShrink: 0,
});

export const entryInfo = style({
    flex: 1,
    minWidth: 0,
});

export const entryTitle = style({
    fontSize: "14px",
    fontWeight: 500,
    color: vars.color.daylight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

export const entryUrl = style({
    fontSize: "12px",
    color: vars.color.moonlight,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    marginTop: "2px",
});

export const entryTime = style({
    fontSize: "12px",
    color: vars.color.moonlight,
    flexShrink: 0,
    // Equal-width digits so the column of times doesn't jitter row to row.
    fontVariantNumeric: "tabular-nums",
});

export const deleteBtn = style({
    position: "relative",
    background: "none",
    border: "none",
    color: vars.color.cinder,
    cursor: "pointer",
    padding: "2px 6px",
    borderRadius: "6px",
    fontSize: "14px",
    // Same rule as the app tiles and bookmark bar: the destructive control
    // only appears for the row under the pointer, or on keyboard focus.
    opacity: 0,
    // See AppsPage.removeBtn: hidden controls must not stay clickable.
    pointerEvents: "none",
    transitionProperty: "color, opacity",
    transitionTimingFunction: "ease",
    transitionDuration: "0.15s",
    selectors: {
        "&::after": hitArea(),
        [`${entry}:hover &, &:focus-visible`]: {
            opacity: 1,
            pointerEvents: "auto",
        },
        "&:hover": {
            color: vars.color.antares,
        },
    },
});

export const empty = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "20px",
    marginTop: "60px",
    animationName: emptyFadeIn,
    animationTimingFunction: "ease",
    animationFillMode: "both",
    animationDuration: "0.3s",
});

// A single dimmed rail dot - the empty state is the timeline with nothing
// recorded on it yet, not an unrelated placeholder sentence. The rail is
// drawn in too: on its own the dot just read as a failed image.
export const emptyDot = style({
    position: "relative",
    // The rails are absolutely positioned, so they contribute no height and
    // the flex gap alone doesn't clear them - without these margins the lower
    // rail ran 29px down through the message underneath.
    margin: "30px 0",
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: vars.color.dust,
    boxShadow: `0 0 0 6px ${vars.color.horizon}`,
    selectors: {
        "&::before, &::after": {
            content: '""',
            position: "absolute",
            left: "50%",
            marginLeft: "-0.5px",
            width: "1px",
            height: "30px",
        },
        "&::before": {
            bottom: "calc(100% + 7px)",
            background: `linear-gradient(to bottom, transparent, ${vars.color.haze})`,
        },
        "&::after": {
            top: "calc(100% + 7px)",
            background: `linear-gradient(to bottom, ${vars.color.haze}, transparent)`,
        },
    },
});

export const emptyText = style({
    color: vars.color.moonlight,
    fontSize: "14px",
    textAlign: "center",
});

// The way back out of a filter that matched nothing, offered where the user
// is already looking rather than back up in the scope bar.
export const emptyAction = style({
    background: "transparent",
    border: `1px solid ${vars.color.haze}`,
    borderRadius: "8px",
    padding: "6px 14px",
    color: vars.color.moonlight,
    fontFamily: "inherit",
    fontSize: "13px",
    cursor: "pointer",
    transitionProperty: "border-color, color, background",
    transitionTimingFunction: EASE.standard,
    transitionDuration: DUR.fast,
    selectors: {
        "&:hover": {
            borderColor: `color-mix(in srgb, ${vars.color.sirius} 50%, ${vars.color.haze})`,
            color: vars.color.daylight,
            background: `color-mix(in srgb, ${vars.color.sirius} 10%, transparent)`,
        },
    },
});

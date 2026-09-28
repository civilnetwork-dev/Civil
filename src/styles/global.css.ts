import { globalStyle } from "@vanilla-extract/css";

import { FONT_SANS } from "./schematic.css";
import "./themes/twilight.css";
import { vars } from "./theme.css";

globalStyle("*, *::before, *::after", {
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
});

// Honour the OS "reduce motion" setting rather than flattening every
// transition unconditionally. Durations collapse instead of going to
// `animation: none` so animations still reach their final frame and
// completion handlers still fire.
const STILL = {
    transitionDuration: "0.01ms !important",
    transitionDelay: "0s !important",
    animationDuration: "0.01ms !important",
    animationDelay: "0s !important",
    animationIterationCount: "1 !important",
    scrollBehavior: "auto",
} as const;

globalStyle("*, *::before, *::after", {
    "@media": { "(prefers-reduced-motion: reduce)": STILL },
});

// The same, when the user asks Civil itself to reduce motion (Settings sets
// `data-motion` on every document's root in entry-client.tsx).
globalStyle(
    '[data-motion="reduce"] *, [data-motion="reduce"] *::before, [data-motion="reduce"] *::after',
    STILL,
);

globalStyle("html, body", {
    backgroundColor: vars.color.stratum,
    overflowX: "hidden",
});

// The app is dark-only; native controls (number spinners, checkboxes, date
// pickers, autofill) follow suit instead of painting light-theme chrome.
globalStyle(":root", { colorScheme: "dark" });

globalStyle("body", {
    fontFamily: FONT_SANS,
    color: vars.color.firn,
    lineHeight: 1.5,
    WebkitFontSmoothing: "antialiased",
});

globalStyle("::selection", {
    background: vars.color.cobalt,
    color: vars.color.basalt,
});

globalStyle("button, input, textarea, select", {
    fontFamily: "inherit",
});

// No resize grip and no dragging a textarea larger. Its own min-height is its
// resting size, and it grows with whatever is typed or pasted past that.
globalStyle("textarea", { resize: "none", fieldSizing: "content" });

// One keyboard focus ring for the whole app. `:focus-visible` keeps it off
// pointer interactions, so this costs nothing visually for mouse users and
// makes every control reachable without one.
//
// `:where()` drops the specificity to zero, so a component that draws its
// own focus state (a field whose box turns cobalt, a row with its own ring)
// wins regardless of stylesheet order. No border-radius here: an outline
// already follows the element's own corners, and forcing one reshapes the
// element itself (a focused input took its wrapper's pill shape and clipped
// its caret).
globalStyle(":where(*:focus-visible)", {
    outline: `2px solid ${vars.color.cobalt}`,
    outlineOffset: 2,
});

// A slim themed scrollbar rather than no scrollbar at all: long lists (the
// restricted-domain list, history, bookmarks) otherwise give no indication
// that there is anything below the fold. Chrome surfaces that need to hide
// theirs set `scrollbarWidth: "none"` on their own container.
globalStyle("*::-webkit-scrollbar", {
    width: 10,
    height: 10,
});

globalStyle("*::-webkit-scrollbar-track", {
    background: "transparent",
});

globalStyle("*::-webkit-scrollbar-thumb", {
    backgroundColor: vars.color.talus,
    borderRadius: 999,
    border: "2px solid transparent",
    backgroundClip: "content-box",
});

globalStyle("*::-webkit-scrollbar-thumb:hover", {
    backgroundColor: vars.color.talus,
});

globalStyle("*::-webkit-scrollbar-corner", {
    background: "transparent",
});

globalStyle("*", {
    scrollbarWidth: "thin" as const,
    scrollbarColor: `${vars.color.talus} transparent`,
});

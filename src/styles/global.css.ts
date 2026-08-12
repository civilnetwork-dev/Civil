import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./theme.css";

import "./themes/twilight.css";

globalStyle("*, *::before, *::after", {
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
});

// Honour the OS "reduce motion" setting rather than flattening every
// transition unconditionally. Durations collapse instead of going to
// `animation: none` so animations still reach their final frame and
// completion handlers still fire.
globalStyle("*, *::before, *::after", {
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            transitionDuration: "0.01ms !important",
            transitionDelay: "0s !important",
            animationDuration: "0.01ms !important",
            animationDelay: "0s !important",
            animationIterationCount: "1 !important",
            scrollBehavior: "auto",
        },
    },
});

globalStyle("html, body", {
    backgroundColor: vars.color.dusk,
    overflowX: "hidden",
});

globalStyle("body", {
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

globalStyle("button, input, textarea, select", {
    fontFamily: "inherit",
});

// One keyboard focus ring for the whole app. `:focus-visible` keeps it off
// pointer interactions, so this costs nothing visually for mouse users and
// makes every control reachable without one. Components that need a
// different offset override it locally.
globalStyle("*:focus-visible", {
    outline: `2px solid ${vars.color.sirius}`,
    outlineOffset: 2,
    borderRadius: "inherit",
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
    backgroundColor: vars.color.haze,
    borderRadius: 999,
    border: "2px solid transparent",
    backgroundClip: "content-box",
});

globalStyle("*::-webkit-scrollbar-thumb:hover", {
    backgroundColor: vars.color.dust,
});

globalStyle("*::-webkit-scrollbar-corner", {
    background: "transparent",
});

globalStyle("*", {
    scrollbarWidth: "thin" as "thin",
    scrollbarColor: `${vars.color.haze} transparent`,
});

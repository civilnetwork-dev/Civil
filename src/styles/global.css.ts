import { globalStyle } from "@vanilla-extract/css";
import { vars } from "./theme.css";

import "./themes/macchiato.css";

globalStyle("*, *::before, *::after", {
    margin: 0,
    padding: 0,
    boxSizing: "border-box",
});

globalStyle("html, body", {
    backgroundColor: vars.color.base,
    overflowX: "hidden",
});

globalStyle("body", {
    fontFamily: '"Rubik", ui-sans-serif, sans-serif',
});

globalStyle("*::-webkit-scrollbar", {
    display: "none",
});

globalStyle("*", {
    scrollbarWidth: "none" as "none",
});

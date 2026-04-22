import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";

export const newtabRoot = style({
    backgroundColor: vars.color.base,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    width: "100%",
    height: "100vh",
});

export const welcomeText = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
    cursor: "default",
});

const T_WELCOME = "0.46s cubic-bezier(0.4, 0, 0.02, 1)";

globalStyle(`.${welcomeText} h1`, {
    textTransform: "none",
    fontSize: "35px",
    fontWeight: 500,
    transition: T_WELCOME,
});

globalStyle(`.${welcomeText} h1:hover`, {
    color: vars.color.sky,
});

globalStyle(`.${welcomeText} h1 b`, {
    WebkitTextStroke: `2px ${vars.color.overlay1}`,
});

globalStyle(`.${welcomeText} p`, {
    fontSize: "20px",
    fontWeight: 400,
    transition: T_WELCOME,
});

globalStyle(`.${welcomeText} p:hover`, {
    color: vars.color.sapphire,
});

export const searchbarWrap = style({
    position: "relative",
    width: "100%",
});

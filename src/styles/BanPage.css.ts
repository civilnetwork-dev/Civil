import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "./theme.css";
import "./global.css";

export const banRoot = style({
    backgroundColor: vars.color.base,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "20px",
    width: "100%",
    height: "100vh",
});

export const banText = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
    color: vars.color.text,
    fontFamily: '"Rubik", sans-serif',
    cursor: "default",
});

globalStyle(`.${banText} h1`, {
    textTransform: "none",
    fontSize: "35px",
    fontWeight: 500,
});

globalStyle(`.${banText} p`, {
    fontSize: "20px",
    fontWeight: 400,
});

globalStyle(`.${banText} a`, {
    fontSize: "15px",
    fontWeight: 400,
    color: vars.color.sky,
});

globalStyle(`.${banText} a:hover`, {
    color: vars.color.teal,
});

import { createGlobalTheme } from "@vanilla-extract/css";
import { PALETTE } from "../palette";
import { vars } from "../theme.css";

createGlobalTheme(":root", vars, {
    color: PALETTE,
});

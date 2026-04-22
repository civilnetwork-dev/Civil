import { flavors } from "@catppuccin/palette";
import { createGlobalTheme } from "@vanilla-extract/css";
import { vars } from "../theme.css";

const { colors } = flavors.macchiato;

createGlobalTheme(":root", vars, {
    color: Object.fromEntries(
        Object.entries(colors).map(([k, v]) => [k, v.hex]),
    ) as Record<keyof typeof colors, string>,
});

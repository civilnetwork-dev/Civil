import { createGlobalThemeContract } from "@vanilla-extract/css";
import { PALETTE } from "./palette";

export const vars = createGlobalThemeContract(
    {
        color: Object.fromEntries(
            Object.keys(PALETTE).map(k => [k, null]),
        ) as Record<keyof typeof PALETTE, null>,
    },
    (_, path) => `civil-${path.join("-")}`,
);

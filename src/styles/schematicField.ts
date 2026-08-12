import { vars } from "./theme.css";

/**
 * `field`'s implementation, factored out of schematic.css.ts.
 *
 * schematic.css.ts calls real vanilla-extract APIs (`style`, `styleVariants`),
 * so once any page — rather than a test that imports a schematic component
 * directly — pulls it into a production build, every one of its exports must
 * reduce to something vanilla-extract can statically serialize: a plain
 * object, array, string, number, null/undefined, or a function tagged via
 * `addFunctionSerializer`. A bare function fails that check. Keeping the real
 * closure in this plain module (its name doesn't match the `.css.ts` filter,
 * so vanilla-extract's transform never touches it) and having
 * schematic.css.ts reconstruct it through `addFunctionSerializer` satisfies
 * the requirement without changing `field`'s behaviour or call signature.
 */

const FIELD_DENSITY = { fine: 8, base: 16, coarse: 32 } as const;

export type FieldDensity = keyof typeof FIELD_DENSITY;

export function createField() {
    return function field(
        density: FieldDensity = "base",
        color: string = vars.color.horizon,
    ) {
        const px = FIELD_DENSITY[density];
        return {
            backgroundImage: `linear-gradient(to right, ${color} 0.5px, transparent 0.5px), linear-gradient(to bottom, ${color} 0.5px, transparent 0.5px)`,
            backgroundSize: `${px}px ${px}px`,
        };
    };
}

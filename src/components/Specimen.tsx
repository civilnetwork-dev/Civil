import type { JSX } from "@solidjs/web";
import { onSettled } from "solid-js";

import * as s from "~/styles/Specimen.css";

export type Glyph = (props: { size?: number; class?: string }) => JSX.Element;
export type Tint = keyof typeof s.tint;

/** How far the tile turns on each axis with the pointer at a corner. */
const TILT_DEG = 12;

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

/**
 * A mineral specimen: one glyph raised out of a palette-tinted stone tile.
 *
 * Always decorative. Every place that shows one names the same thing in text
 * beside it, so the tile is hidden from assistive tech and a tint never has to
 * carry meaning on its own.
 */
export default function Specimen(props: {
    icon: Glyph;
    tint?: Tint;
    size?: number;
    idle?: boolean;
    class?: string;
}) {
    const size = () => props.size ?? 56;
    let mount!: HTMLSpanElement;

    // The tile turns to face the pointer: the side nearer it rises toward the
    // reader. The pointer is followed across the whole hover target (the link
    // or button the specimen sits in, else the tile), and past the tile's
    // edges the turn holds at its steepest. Touch and reduced motion set
    // nothing and keep the stylesheet's fixed turn.
    onSettled(() => {
        const host = mount.closest<HTMLElement>("a, button") ?? mount;
        const reduce = matchMedia("(prefers-reduced-motion: reduce)");
        const follow = (e: PointerEvent) => {
            const box = mount.getBoundingClientRect();
            if (e.pointerType === "touch" || reduce.matches || !box.width)
                return;
            const x = clamp(((e.clientX - box.left) / box.width) * 2 - 1);
            const y = clamp(((e.clientY - box.top) / box.height) * 2 - 1);
            mount.style.setProperty("--tilt-x", `${y * TILT_DEG}deg`);
            mount.style.setProperty("--tilt-y", `${-x * TILT_DEG}deg`);
        };
        const settle = () => {
            mount.style.removeProperty("--tilt-x");
            mount.style.removeProperty("--tilt-y");
        };
        host.addEventListener("pointermove", follow);
        host.addEventListener("pointerleave", settle);
        return () => {
            host.removeEventListener("pointermove", follow);
            host.removeEventListener("pointerleave", settle);
        };
    });

    // Two spans: the outer one is the still hover target that carries tint and
    // size, the inner one is the tile that tilts (see Specimen.css.ts).
    return (
        <span
            ref={mount}
            class={[s.mount, s.tint[props.tint ?? "cobalt"], props.class]}
            style={{ "--specimen-size": `${size()}px` }}
            aria-hidden="true"
        >
            <span class={[s.specimen, { [s.idle]: !!props.idle }]}>
                <props.icon size={Math.round(size() / 2)} class={s.glyph} />
            </span>
        </span>
    );
}

import type { JSX } from "@solidjs/web";
import * as s from "~/styles/schematic.css";

/**
 * Monospace annotation — the margin voice of the schematic language.
 *
 * Use for data: numerals, hostnames, timings, scores, IDs, dimensions. Not for
 * prose; Rubik still carries anything a person reads as a sentence.
 */
export default function Anno(props: {
    children: JSX.Element;
    muted?: boolean;
    class?: string;
}) {
    return (
        <span class={[props.muted ? s.annoMuted : s.anno, props.class]}>
            {props.children}
        </span>
    );
}

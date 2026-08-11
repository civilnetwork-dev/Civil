import { Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * A labelled hairline — the signature element of the language.
 *
 * The label sits inline with the line rather than above it, the way a
 * dimension callout does on a drawing, so a section heading costs one row
 * instead of three. `caps` adds the short perpendicular ticks that mark a
 * measured span.
 */
export default function Rule(props: {
    label?: string;
    weight?: "hair" | "major";
    caps?: boolean;
    class?: string;
}) {
    return (
        <div class={[s.ruleRow, props.class]}>
            <Show when={props.label}>
                <span class={s.ruleLabel}>{props.label}</span>
            </Show>
            <Show when={props.caps}>
                <span class={s.ruleCap} aria-hidden="true" />
            </Show>
            <span
                class={props.weight === "major" ? s.ruleLineMajor : s.ruleLine}
                aria-hidden="true"
            />
            <Show when={props.caps}>
                <span class={s.ruleCap} aria-hidden="true" />
            </Show>
        </div>
    );
}

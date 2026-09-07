import { createUniqueId, Show } from "solid-js";

import * as s from "~/styles/schematic.css";

/**
 * An input that sits on a rule rather than inside a box.
 *
 * The label lives in the margin at a fixed width so stacked fields align on one
 * column, the way a spec sheet does. The underline is the only chrome; it picks
 * up the accent on `:focus-within`.
 *
 * `onInput` hands back a plain string rather than an event, so callers never
 * reach into `currentTarget` and cannot accidentally read a stale value.
 */
export default function Field(props: {
    label: string;
    value: string;
    onInput: (value: string) => void;
    type?: string;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    onEnter?: () => void;
}) {
    const inputId = createUniqueId();
    const hintId = createUniqueId();

    return (
        <div>
            <div class={s.inputRow}>
                <label class={s.inputLabel} for={inputId}>
                    {props.label}
                </label>
                <input
                    id={inputId}
                    class={s.inputControl}
                    type={props.type ?? "text"}
                    placeholder={props.placeholder}
                    value={props.value}
                    required={props.required}
                    aria-describedby={props.hint ? hintId : undefined}
                    onInput={e => props.onInput(e.currentTarget.value)}
                    onKeyDown={e => {
                        if (e.key !== "Enter" || !props.onEnter) return;
                        // A caller that wires onEnter is handling Enter itself.
                        // Without preventDefault the browser would ALSO submit
                        // the enclosing form, firing the same handler twice — a
                        // duplicate add on Apps, a duplicate report request on
                        // the Filter Checker.
                        e.preventDefault();
                        props.onEnter();
                    }}
                />
            </div>
            <Show when={props.hint}>
                <span id={hintId} class={s.inputHint}>
                    {props.hint}
                </span>
            </Show>
        </div>
    );
}

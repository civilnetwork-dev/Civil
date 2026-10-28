import { Show } from "solid-js";

import { IconClose, IconSearch } from "~/components/icons";

import * as s from "~/styles/schematic.css";

export default function Lookup(props: {
    value: string;
    placeholder: string;
    label: string;
    clearTitle: string;
    onChange: (value: string) => void;
    inputRef?: (el: HTMLInputElement) => void;
}) {
    let input: HTMLInputElement | undefined;
    return (
        <>
            <IconSearch size={15} class={s.inputIcon} />
            <input
                ref={el => {
                    input = el;
                    props.inputRef?.(el);
                }}
                class={s.inputControl}
                type="text"
                value={props.value}
                placeholder={props.placeholder}
                aria-label={props.label}
                onInput={e => props.onChange(e.currentTarget.value)}
                onKeyDown={e => {
                    if (e.key === "Escape") {
                        props.onChange("");
                        e.currentTarget.blur();
                    }
                }}
            />
            <Show when={props.value}>
                <button
                    type="button"
                    class={s.inputClear}
                    title={props.clearTitle}
                    onClick={() => {
                        props.onChange("");
                        input?.focus();
                    }}
                >
                    <IconClose size={13} />
                </button>
            </Show>
        </>
    );
}

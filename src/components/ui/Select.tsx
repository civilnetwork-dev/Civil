// biome-ignore-all lint/a11y/useFocusableInteractive: Bro biome you dont have to
// biome-ignore-all lint/a11y/noNoninteractiveElementToInteractiveRole: Bro biome you dont have to
import { TbOutlineChevronDown } from "solid-icons/tb";
import { createSignal, For, onCleanup, Show } from "solid-js";
import * as s from "~/styles/Select.css";

export interface SelectOption<T extends string = string> {
    value: T;
    label: string;
}

interface SelectProps<T extends string> {
    value: T;
    options: SelectOption<T>[];
    onChange: (value: T) => void;
}

export function Select<T extends string>(props: SelectProps<T>) {
    const [open, setOpen] = createSignal(false);
    let rootRef: HTMLDivElement | undefined;

    const handleClickOutside = (e: MouseEvent) => {
        if (rootRef && !rootRef.contains(e.target as Node)) {
            setOpen(false);
        }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() =>
        document.removeEventListener("mousedown", handleClickOutside),
    );

    const currentLabel = () =>
        props.options.find(o => o.value === props.value)?.label ?? props.value;

    return (
        <div ref={rootRef} class={s.root}>
            <button
                type="button"
                class={[s.trigger, { [s.triggerOpen]: open() }]}
                onClick={() => setOpen(o => !o)}
                aria-haspopup="listbox"
                aria-expanded={open() ? "true" : "false"}
            >
                {currentLabel()}
                <span class={[s.chevron, { [s.chevronOpen]: open() }]}>
                    <TbOutlineChevronDown size={14} />
                </span>
            </button>
            <Show when={open()}>
                <ul class={s.dropdown} role="listbox">
                    <For each={props.options}>
                        {option => (
                            <li
                                class={[
                                    s.option,
                                    {
                                        [s.optionActive]:
                                            option().value === props.value,
                                    },
                                ]}
                                role="option"
                                aria-selected={
                                    option().value === props.value
                                        ? "true"
                                        : "false"
                                }
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => {
                                    props.onChange(option().value);
                                    setOpen(false);
                                }}
                                onKeyDown={e => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        props.onChange(option().value);
                                        setOpen(false);
                                    }
                                }}
                                tabindex={0}
                            >
                                {option().label}
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </div>
    );
}

import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId, For, Show } from "solid-js";

import { IconChevronDown } from "~/components/icons";
import { normalizeHost } from "~/lib/settings";

import * as schematic from "~/styles/schematic.css";
import * as s from "~/styles/SettingControls.css";

/**
 * The rows Settings and setup are built from. Each renders one setting: its
 * name and what it does, then its control. A select's or field's name is a
 * real <label> for it. A switch's name is plain text that names it through
 * aria-labelledby instead: a label hands every click on its words to the
 * switch, so selecting them or double-clicking one would flip it. The
 * explanation is wired to the control with aria-describedby, so a screen
 * reader hears both on focus.
 */

interface RowText {
    label: string;
    hint?: JSX.Element;
    /** Shown dimmed: the setting has no effect with the current choices. */
    off?: boolean;
}

function Row(
    props: RowText & {
        /** The control's id; without one the name is plain text. */
        for?: string;
        /** The plain-text name's id, for a control named by aria-labelledby. */
        labelId?: string;
        hintId: string;
        error?: string | null;
        errorId?: string;
        children: JSX.Element;
    },
) {
    return (
        <div class={[s.row, { [s.rowOff]: Boolean(props.off) }]}>
            <div class={s.rowText}>
                <Show
                    when={props.for}
                    fallback={
                        <span id={props.labelId} class={s.rowLabel}>
                            {props.label}
                        </span>
                    }
                >
                    <label class={s.rowLabel} for={props.for}>
                        {props.label}
                    </label>
                </Show>
                <Show when={props.hint}>
                    <span id={props.hintId} class={s.rowHint}>
                        {props.hint}
                    </span>
                </Show>
                <Show when={props.error}>
                    <span id={props.errorId} class={s.rowError}>
                        {props.error}
                    </span>
                </Show>
            </div>
            <div class={s.rowControl}>{props.children}</div>
        </div>
    );
}

export function ToggleRow(
    props: RowText & {
        checked: boolean;
        onChange: (on: boolean) => void;
        disabled?: boolean;
    },
) {
    const labelId = createUniqueId();
    const hintId = createUniqueId();
    return (
        <Row
            label={props.label}
            hint={props.hint}
            off={props.off ?? props.disabled}
            labelId={labelId}
            hintId={hintId}
        >
            <span class={schematic.toggle}>
                <input
                    type="checkbox"
                    class={[schematic.toggleInput, s.switchHit]}
                    checked={props.checked}
                    disabled={props.disabled}
                    aria-labelledby={labelId}
                    aria-describedby={props.hint ? hintId : undefined}
                    onChange={e => props.onChange(e.currentTarget.checked)}
                />
                <span class={schematic.toggleTrack} />
                <span class={schematic.toggleThumb} />
            </span>
        </Row>
    );
}

export interface Option<T> {
    value: T;
    label: string;
}

/**
 * A native select in a well; option values of any type map back by index.
 * Its open list is drawn in CSS where the browser allows (see selectControl).
 */
export function Select<T extends string | number>(props: {
    value: T;
    options: readonly Option<T>[];
    onChange: (value: T) => void;
    id?: string;
    label?: string;
    describedBy?: string;
    disabled?: boolean;
}) {
    return (
        <span class={s.well}>
            <select
                id={props.id}
                class={s.selectControl}
                aria-label={props.label}
                aria-describedby={props.describedBy}
                disabled={props.disabled}
                onChange={e => {
                    const option = props.options[e.currentTarget.selectedIndex];
                    if (option) props.onChange(option.value);
                }}
            >
                <For each={props.options}>
                    {option => (
                        <option
                            value={String(option.value)}
                            selected={option.value === props.value}
                        >
                            {option.label}
                        </option>
                    )}
                </For>
            </select>
            <IconChevronDown size={14} class={s.selectMark} />
        </span>
    );
}

export function ChoiceRow<T extends string | number>(
    props: RowText & {
        value: T;
        options: readonly Option<T>[];
        onChange: (value: T) => void;
        disabled?: boolean;
        /** Extra controls beside the select, such as an action key. */
        children?: JSX.Element;
    },
) {
    const id = createUniqueId();
    const hintId = createUniqueId();
    return (
        <Row
            label={props.label}
            hint={props.hint}
            off={props.off ?? props.disabled}
            for={id}
            hintId={hintId}
        >
            <Select
                id={id}
                value={props.value}
                options={props.options}
                onChange={props.onChange}
                describedBy={props.hint ? hintId : undefined}
                disabled={props.disabled}
            />
            {props.children}
        </Row>
    );
}

/**
 * A typed value, committed on Enter or when focus leaves. `check` returns a
 * sentence saying what is wrong, or null; nothing is committed while it
 * objects.
 */
export function TextRow(
    props: RowText & {
        value: string;
        onCommit: (value: string) => void;
        check?: (value: string) => string | null;
        placeholder?: string;
        type?: "text" | "number" | "url";
    },
) {
    const id = createUniqueId();
    const hintId = createUniqueId();
    const errorId = createUniqueId();
    const [error, setError] = createSignal<string | null>(null);

    const commit = (input: HTMLInputElement) => {
        const value = input.value.trim();
        const problem = props.check?.(value) ?? null;
        setError(problem);
        if (!problem && value !== props.value) props.onCommit(value);
    };

    return (
        <Row
            label={props.label}
            hint={props.hint}
            off={props.off}
            for={id}
            hintId={hintId}
            error={error()}
            errorId={errorId}
        >
            <span class={s.well}>
                <input
                    id={id}
                    class={s.control}
                    type={props.type ?? "text"}
                    value={props.value}
                    placeholder={props.placeholder}
                    spellcheck={false}
                    autocomplete="off"
                    aria-invalid={error() ? "true" : undefined}
                    aria-describedby={
                        [props.hint ? hintId : "", error() ? errorId : ""]
                            .filter(Boolean)
                            .join(" ") || undefined
                    }
                    onChange={e => commit(e.currentTarget)}
                    onKeyDown={e => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        commit(e.currentTarget);
                    }}
                />
            </span>
        </Row>
    );
}

/** A row whose control is an action, named by its own visible text. */
export function ActionRow(
    props: RowText & {
        children: JSX.Element;
    },
) {
    const hintId = createUniqueId();
    return (
        <Row
            label={props.label}
            hint={props.hint}
            off={props.off}
            hintId={hintId}
        >
            {props.children}
        </Row>
    );
}

/**
 * Adds a site to a list: an address well, any extra controls (a method for
 * connection rules), and the add key. Hands back the site as the lists store
 * it, a bare hostname, or says what's wrong. The address is read from the
 * field at submit rather than tracked as it's typed.
 */
export function HostForm(props: {
    label: string;
    submitLabel: string;
    onAdd: (host: string) => void;
    children?: JSX.Element;
}) {
    const [error, setError] = createSignal<string | null>(null);
    const errorId = createUniqueId();
    let input: HTMLInputElement | undefined;

    const submit = (event: SubmitEvent) => {
        event.preventDefault();
        const host = normalizeHost(input?.value ?? "");
        if (!host) {
            setError("Enter a site's address, like discord.com.");
            return;
        }
        setError(null);
        props.onAdd(host);
        if (input) input.value = "";
    };

    return (
        <>
            <form class={s.hostForm} onSubmit={submit}>
                <span class={s.well}>
                    <input
                        ref={input}
                        class={s.control}
                        placeholder="discord.com"
                        aria-label={props.label}
                        aria-invalid={error() ? "true" : undefined}
                        aria-describedby={error() ? errorId : undefined}
                        spellcheck={false}
                        autocomplete="off"
                    />
                </span>
                {props.children}
                <button type="submit" class={s.key}>
                    {props.submitLabel}
                </button>
            </form>
            <Show when={error()}>
                <span id={errorId} class={s.rowError}>
                    {error()}
                </span>
            </Show>
        </>
    );
}

/**
 * A key that asks once before doing something it cannot undo: the first
 * press arms it and says so in its label, the second acts. It disarms itself
 * after four seconds, like Clear all on the History page.
 */
export function ArmedKey(props: {
    label: string;
    armedLabel: string;
    onConfirm: () => void;
}) {
    const [armed, setArmed] = createSignal(false);
    let timer: ReturnType<typeof setTimeout> | undefined;
    return (
        <button
            type="button"
            class={[schematic.clearKey, { [schematic.clearKeyArmed]: armed() }]}
            onClick={() => {
                clearTimeout(timer);
                if (!armed()) {
                    setArmed(true);
                    timer = setTimeout(() => setArmed(false), 4000);
                    return;
                }
                setArmed(false);
                props.onConfirm();
            }}
        >
            {armed() ? props.armedLabel : props.label}
        </button>
    );
}

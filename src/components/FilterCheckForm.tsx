import { Show } from "solid-js";
import { IconLoaderDots } from "~/components/icons";
import Field from "~/components/schematic/Field";
import * as s from "~/styles/FilterCheckPage.css";

/**
 * The report's specimen section: what to test, and who to test it as.
 *
 * Fields sit on rules with margin labels so they align on one column, the way a
 * spec sheet does.
 */
export default function FilterCheckForm(props: {
    needsEmail: boolean;
    email: string;
    url: string;
    loading: boolean;
    onEmail: (value: string) => void;
    onUrl: (value: string) => void;
    onSubmit: () => void;
}) {
    return (
        <form
            class={s.form}
            onSubmit={e => {
                e.preventDefault();
                props.onSubmit();
            }}
        >
            <Show when={props.needsEmail}>
                <Field
                    label="school email"
                    type="email"
                    value={props.email}
                    onInput={props.onEmail}
                    placeholder="student@school.edu"
                    required
                />
            </Show>
            <Field
                label="specimen url"
                type="url"
                value={props.url}
                onInput={props.onUrl}
                placeholder="https://example.com"
                required
            />
            <button class={s.submit} type="submit" disabled={props.loading}>
                <Show when={props.loading} fallback="run report">
                    <IconLoaderDots size={14} class={s.spinner} /> running…
                </Show>
            </button>
        </form>
    );
}

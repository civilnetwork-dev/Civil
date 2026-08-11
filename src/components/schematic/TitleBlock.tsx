import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * A drawing's title block: what this sheet is, what it's called, and its
 * measured state.
 *
 * Supersedes the `masthead` pattern in layout.css.ts for schematic pages. That
 * module keeps its exports because three unmigrated pages still use it
 * (AppsPage, ExtensionsPage, and HistoryPage); do not delete it until pass 2.
 */
export default function TitleBlock(props: {
    eyebrow: string;
    title: string;
    meta?: string;
    actions?: JSX.Element;
}) {
    return (
        <header class={s.titleBlock}>
            <div class={s.titleBlockTop}>
                <div>
                    <span class={s.titleBlockEyebrow}>
                        <span class={s.titleBlockMark} aria-hidden="true" />
                        {props.eyebrow}
                    </span>
                    <h1 class={s.titleBlockTitle}>{props.title}</h1>
                </div>
                <Show when={props.meta}>
                    <span class={s.titleBlockMeta}>{props.meta}</span>
                </Show>
                {props.actions}
            </div>
        </header>
    );
}

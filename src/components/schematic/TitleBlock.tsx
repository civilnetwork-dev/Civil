import type { JSX } from "@solidjs/web";
import { Show } from "solid-js";

import * as s from "~/styles/schematic.css";

/**
 * A drawing's title block: what this sheet is, what it's called, and its
 * measured state.
 *
 * The meta sits *under* the title, not as a third flex child. The row is
 * `space-between`, so a floating meta landed in a different place on every
 * page — centred where a page had actions, hard right where it did not — which
 * read as a value that had come loose rather than as the sheet's state. A real
 * title block stacks its identifying data in one corner, and that is also the
 * only arrangement that is stable across pages.
 *
 * The eyebrow is optional and currently unused. Every page once carried one —
 * "launcher", "diagnostic", "collection", "archive" — and session watching
 * showed why they had to go: they are internal category labels, words a
 * developer files pages under, not words a user acts on. A student scanning
 * for "where do I search" reads a cryptic extra word above every title. The
 * slot stays because the *drawing* grammar allows one; the pages dropped it.
 */
export default function TitleBlock(props: {
    eyebrow?: string;
    title: string;
    meta?: string;
    actions?: JSX.Element;
}) {
    return (
        <header class={s.titleBlock}>
            <div class={s.titleBlockTop}>
                <div class={s.titleBlockIdent}>
                    <Show when={props.eyebrow}>
                        <span class={s.titleBlockEyebrow}>
                            <span class={s.titleBlockMark} aria-hidden="true" />
                            {props.eyebrow}
                        </span>
                    </Show>
                    <h1 class={s.titleBlockTitle}>{props.title}</h1>
                    <Show when={props.meta}>
                        <span class={s.titleBlockMeta}>{props.meta}</span>
                    </Show>
                </div>
                {props.actions}
            </div>
        </header>
    );
}

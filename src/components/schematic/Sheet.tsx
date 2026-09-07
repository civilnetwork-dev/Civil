import type { JSX } from "@solidjs/web";
import { For } from "solid-js";

import type { FieldDensity } from "~/styles/schematic.css";
import * as s from "~/styles/schematic.css";

export type Corner = "tl" | "tr" | "bl" | "br";

/** Three corners, not four: bottom-left belongs to the title block. */
const DEFAULT_MARKS: Corner[] = ["tl", "tr", "br"];

/**
 * The page plane every interior surface sits on.
 *
 * Defaults to three registration marks rather than four: bottom-left is where a
 * real drawing puts its title block, so leaving that corner unmarked is what
 * makes the title block read as belonging to the sheet instead of floating on
 * it.
 */
export default function Sheet(props: {
    children: JSX.Element;
    density?: FieldDensity;
    marks?: Corner[];
    class?: string;
}) {
    const marks = () => props.marks ?? DEFAULT_MARKS;
    const density = () => props.density ?? "base";

    return (
        <div class={[s.sheet, props.class]}>
            <div
                class={[s.sheetField, s.sheetFieldDensity[density()]]}
                aria-hidden="true"
            />
            <For each={marks()} keyed={false}>
                {corner => (
                    <span
                        class={[s.mark, s.markCorner[corner()]]}
                        aria-hidden="true"
                    />
                )}
            </For>
            <div class={s.sheetBody}>{props.children}</div>
        </div>
    );
}

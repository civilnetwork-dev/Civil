import type { JSX } from "@solidjs/web";

import * as s from "~/styles/schematic.css";

/** The page plane every interior surface sits on. */
export default function Sheet(props: {
    children: JSX.Element;
    class?: string;
}) {
    return (
        <div class={[s.sheet, props.class]}>
            <div class={s.sheetBody}>{props.children}</div>
        </div>
    );
}

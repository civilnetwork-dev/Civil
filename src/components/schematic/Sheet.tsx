import type { JSX } from "@solidjs/web";

import AppShell from "~/components/AppShell";

import * as s from "~/styles/schematic.css";

/** The page plane every interior surface sits on, inside the app's shell. */
export default function Sheet(props: {
    children: JSX.Element;
    class?: string;
}) {
    return (
        <AppShell>
            <div class={[s.sheet, props.class]}>
                <div class={s.sheetBody}>{props.children}</div>
            </div>
        </AppShell>
    );
}

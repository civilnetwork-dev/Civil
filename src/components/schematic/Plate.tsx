import type { JSX } from "@solidjs/web";
import { Dynamic } from "@solidjs/web";
import { Show } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * A bounded region inside a sheet — what a card would be, without the box.
 *
 * Two diagonal corner ticks imply the boundary instead of a four-sided border.
 * That is the whole trick: the region reads as bounded while the page stays
 * mostly empty, which is what lets a dense grid feel calm at rest.
 *
 * `as="li"` exists because grids of plates belong in real lists, and a `div`
 * inside a `ul` is invalid markup that screen readers announce badly.
 */
export default function Plate(props: {
    children: JSX.Element;
    ticks?: boolean;
    class?: string;
    as?: "div" | "li";
}) {
    const ticks = () => props.ticks !== false;

    return (
        <Dynamic component={props.as ?? "div"} class={[s.plate, props.class]}>
            <Show when={ticks()}>
                <span
                    class={[s.plateTick, s.plateTickCorner.tl]}
                    aria-hidden="true"
                />
                <span
                    class={[s.plateTick, s.plateTickCorner.br]}
                    aria-hidden="true"
                />
            </Show>
            {props.children}
        </Dynamic>
    );
}

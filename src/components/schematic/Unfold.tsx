import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId } from "solid-js";
import * as s from "~/styles/schematic.css";

/**
 * Depth on demand: a summary at rest, a dense block on intent.
 *
 * Three independent inputs drive one derived state, because each has a
 * different lifetime:
 *
 *   pinned  — an explicit decision (click, Enter, Space). Survives the pointer
 *             leaving, which is what makes the content readable at all.
 *   hovered — a pointer convenience. No keyboard or touch equivalent.
 *   focused — keyboard presence anywhere inside the container.
 *
 * Focus is tracked on the container rather than the trigger. Using the
 * trigger's own blur would collapse the region the instant a keyboard user
 * tabbed into the content it had just revealed; `focusout` with a
 * `relatedTarget` containment check is what avoids that.
 *
 * Collapsed content stays mounted but gets `aria-hidden` and `inert`, so it is
 * neither announced nor reachable by Tab while invisible. Keeping it mounted is
 * what allows the height transition.
 */
export default function Unfold(props: {
    label: string;
    summary: JSX.Element;
    children: JSX.Element;
    class?: string;
}) {
    const [pinned, setPinned] = createSignal(false);
    const [hovered, setHovered] = createSignal(false);
    const [focused, setFocused] = createSignal(false);
    const open = () => pinned() || hovered() || focused();
    const regionId = createUniqueId();

    let root: HTMLDivElement | undefined;

    const handleFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (next && root?.contains(next)) return;
        setFocused(false);
    };

    return (
        // biome-ignore lint/a11y/noStaticElementInteractions: hover/focus tracking wrapper around a real interactive button; the div itself is not the control
        <div
            ref={root}
            class={[s.unfold, props.class]}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusIn={() => setFocused(true)}
            onFocusOut={handleFocusOut}
        >
            <button
                type="button"
                class={s.unfoldTrigger}
                aria-expanded={open() ? "true" : "false"}
                aria-controls={regionId}
                aria-label={props.label}
                onClick={() => setPinned(p => !p)}
            >
                {props.summary}
            </button>
            <div
                id={regionId}
                class={open() ? s.unfoldRegionOpen : s.unfoldRegion}
                aria-hidden={open() ? "false" : "true"}
                inert={!open() || undefined}
            >
                <div class={s.unfoldInner}>{props.children}</div>
            </div>
        </div>
    );
}

import type { JSX } from "@solidjs/web";
import { createSignal, createUniqueId } from "solid-js";

import * as s from "~/styles/schematic.css";

/** The open state and the handlers that drive it; see Unfold. */
function useUnfoldState() {
    const [pinned, setPinned] = createSignal(false);
    const [hovered, setHovered] = createSignal(false);
    const [focusHeld, setFocusHeld] = createSignal(false);
    const open = () => pinned() || hovered() || focusHeld();
    const refs: { root?: HTMLDivElement; trigger?: HTMLButtonElement } = {};

    /**
     * A deliberate close: second activation of the trigger, or Escape. If
     * focus is currently anywhere inside the container it is about to land
     * on content that becomes `inert`, so the trigger takes focus back
     * before `pinned`/`focusHeld` are cleared.
     */
    const collapse = () => {
        if (
            refs.root &&
            document.activeElement &&
            refs.root.contains(document.activeElement)
        ) {
            refs.trigger?.focus();
        }
        setPinned(false);
        setFocusHeld(false);
    };

    return {
        open,
        refs,
        onTriggerClick: () => {
            if (pinned()) collapse();
            else setPinned(true);
        },
        onPointerEnter: (event: PointerEvent) => {
            if (event.pointerType === "mouse") setHovered(true);
        },
        onPointerLeave: (event: PointerEvent) => {
            if (event.pointerType === "mouse") setHovered(false);
        },
        onFocusIn: () => {
            if (pinned() || hovered()) setFocusHeld(true);
        },
        onFocusOut: (event: FocusEvent) => {
            const next = event.relatedTarget as Node | null;
            if (next && refs.root?.contains(next)) return;
            setFocusHeld(false);
        },
        onKeyDown: (event: KeyboardEvent) => {
            if (event.key !== "Escape" || !open()) return;
            collapse();
        },
    };
}

/**
 * Depth on demand: a summary at rest, a dense block on intent.
 *
 * Three signals drive one derived state, but they are not peers. Each has a
 * different authority over `open`:
 *
 *   pinned: the only signal a user sets on purpose. Click (which is also
 *               how a <button> reports Enter/Space) sets it; a second click
 *               or Escape clears it. This is what makes the content survive
 *               the pointer leaving or focus moving on.
 *   hovered: mouse convenience, and mouse only. `onPointerEnter`/
 *               `onPointerLeave` are gated on `pointerType === "mouse"`
 *               because mobile browsers synthesise a `mouseenter` before
 *               every tap's `click` but no matching `mouseleave` until the
 *               user touches somewhere else: treat touch as hover and the
 *               toggle goes dead on the second tap (open, pinned clears,
 *               `hovered` is still stuck true). Pen is excluded for the same
 *               reason as touch.
 *   focusHeld: a hold, never an opener. `onFocusIn` only sets it when the
 *               region is already open (`pinned() || hovered()`); tabbing to
 *               a closed trigger must not reveal content nobody asked for.
 *               Once set, it keeps the region open while focus is anywhere
 *               inside it, so tabbing from the trigger into the content it
 *               just revealed can't collapse it out from under the user.
 *
 * open = pinned() || hovered() || focusHeld()
 *
 * Focus is tracked on the container rather than the trigger, via `focusin`/
 * `focusout` with a `relatedTarget` containment check on the latter: using
 * the trigger's own blur would collapse the region the instant focus moved
 * into the content it had just revealed.
 *
 * Collapsing (a second activation, or Escape) can leave focus stranded: if
 * the user tabbed into the revealed content, that element is about to become
 * `inert`, and an `inert` element cannot hold focus. Both paths run through
 * `collapse()`, which refocuses the trigger first whenever focus is
 * currently inside the container, then clears state.
 *
 * Collapsed content stays mounted but gets `aria-hidden` and `inert`, so it is
 * neither announced nor reachable by Tab while invisible. Keeping it mounted is
 * what allows the height transition.
 *
 * The trigger's accessible name is label-plus-visible-text, not a
 * replacement: `props.label` renders as visually-hidden (`srOnly`) text
 * *before* `props.summary` inside the button, rather than as `aria-label`.
 * An `aria-label` would discard the visible text from the accessible name
 * entirely, which fails WCAG 2.5.3 Label in Name and breaks voice control:
 * a user saying "click chess.org" needs "chess.org" to actually be part of
 * the name their command is matched against.
 */
export default function Unfold(props: {
    label: string;
    summary: JSX.Element;
    children: JSX.Element;
    class?: string;
}) {
    const state = useUnfoldState();
    const regionId = createUniqueId();

    return (
        // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- hover/focus tracking wrapper around a real interactive button; the div itself is not the control
        <div
            ref={el => (state.refs.root = el)}
            class={[s.unfold, props.class]}
            onPointerEnter={state.onPointerEnter}
            onPointerLeave={state.onPointerLeave}
            onFocusIn={state.onFocusIn}
            onFocusOut={state.onFocusOut}
            onKeyDown={state.onKeyDown}
        >
            <button
                type="button"
                ref={el => (state.refs.trigger = el)}
                class={s.unfoldTrigger}
                aria-expanded={state.open() ? "true" : "false"}
                aria-controls={regionId}
                onClick={state.onTriggerClick}
            >
                <span class={s.srOnly}>{props.label}</span>
                {props.summary}
            </button>
            <div
                id={regionId}
                class={state.open() ? s.unfoldRegionOpen : s.unfoldRegion}
                aria-hidden={state.open() ? "false" : "true"}
                inert={!state.open() || undefined}
            >
                <div class={s.unfoldInner}>
                    <div class={s.unfoldContent}>{props.children}</div>
                </div>
            </div>
        </div>
    );
}

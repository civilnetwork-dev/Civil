// @vitest-environment happy-dom
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Unfold from "./Unfold";

/**
 * Every simulated event is followed by `flush()`. Solid 2.0 batches writes made
 * outside a computation, so a signal set inside a click or focus handler has not
 * reached the DOM when the dispatch call returns.
 */

function mount() {
    return renderSolid(() => (
        <Unfold label="app detail" summary={<span>chess.org</span>}>
            <a href="https://example.com">remove</a>
        </Unfold>
    ));
}

const trigger = (c: HTMLElement) =>
    c.querySelector("button") as HTMLButtonElement;
const region = (c: HTMLElement) =>
    c.querySelector(`.${s.unfoldRegion}`) as HTMLElement;

/**
 * `pointerenter`/`pointerleave` carrying a `pointerType`. happy-dom does ship
 * a real `PointerEvent` constructor, but the fallback to `MouseEvent` plus
 * `Object.defineProperty` keeps this working on any DOM that only has
 * `MouseEvent` — the same defensiveness the tests below already use for
 * `relatedTarget`, which happy-dom's `FocusEvent` also accepts natively.
 */
function firePointer(
    type: "pointerenter" | "pointerleave",
    pointerType: "mouse" | "touch" | "pen",
): Event {
    const Ctor: typeof MouseEvent =
        typeof PointerEvent === "function"
            ? (PointerEvent as unknown as typeof MouseEvent)
            : MouseEvent;
    const event = new Ctor(type, { bubbles: false });
    Object.defineProperty(event, "pointerType", { value: pointerType });
    return event;
}

describe("Unfold", () => {
    it("renders the summary and keeps content in the DOM when collapsed", () => {
        const { container, unmount } = mount();
        expect(container.textContent).toContain("chess.org");
        expect(container.textContent).toContain("remove");
        unmount();
    });

    it("starts collapsed", () => {
        const { container, unmount } = mount();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("makes collapsed content inert so it is not tabbable", () => {
        const { container, unmount } = mount();
        expect(region(container).hasAttribute("inert")).toBe(true);
        unmount();
    });

    it("expands on click and collapses on a second click", () => {
        const { container, unmount } = mount();
        trigger(container).click();
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("true");
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        expect(region(container).hasAttribute("inert")).toBe(false);

        trigger(container).click();
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
        unmount();
    });

    it("applies the open class only when expanded", () => {
        const { container, unmount } = mount();
        expect(region(container).className).not.toContain(s.unfoldRegionOpen);
        trigger(container).click();
        flush();
        expect(region(container).className).toContain(s.unfoldRegionOpen);
        unmount();
    });

    it("associates the trigger with the region it controls", () => {
        const { container, unmount } = mount();
        const controls = trigger(container).getAttribute("aria-controls");
        expect(controls).toBeTruthy();
        expect(region(container).id).toBe(controls);
        unmount();
    });

    // Was "labels the trigger for screen readers", asserting
    // `aria-label === props.label`. That is now the bug: an `aria-label`
    // replaces the accessible name outright, discarding the visible summary
    // text and failing WCAG 2.5.3 Label in Name. The fix makes the label a
    // visually-hidden *prefix* to the visible text instead, so both rewrite
    // the test and its name to match.
    it("names the trigger from the label and the visible summary, not aria-label", () => {
        const { container, unmount } = mount();
        const btn = trigger(container);
        expect(btn.hasAttribute("aria-label")).toBe(false);
        expect(btn.textContent).toContain("app detail");
        expect(btn.textContent).toContain("chess.org");
        unmount();
    });

    // Was dispatching plain `MouseEvent("mouseenter"/"mouseleave")`. Hover is
    // now tracked via `onPointerEnter`/`onPointerLeave` gated on
    // `pointerType === "mouse"`, so the simulated events must carry that.
    it("expands on hover and collapses when the pointer leaves", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        root.dispatchEvent(firePointer("pointerenter", "mouse"));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        root.dispatchEvent(firePointer("pointerleave", "mouse"));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    // Was dispatching `focusin` on a closed region and expecting it to open.
    // Under the new model, focus alone never opens anything (that was
    // Defect 2) — it only holds a region open once something else already
    // opened it. So this now opens via click first, then checks focus
    // moving into the content doesn't close it back up.
    it("stays open while focus moves into the revealed content", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        const link = container.querySelector("a") as HTMLAnchorElement;

        trigger(container).click();
        flush();

        root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");

        const moveWithin = new FocusEvent("focusout", { bubbles: true });
        Object.defineProperty(moveWithin, "relatedTarget", { value: link });
        root.dispatchEvent(moveWithin);
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");

        unmount();
    });

    // Was opening via a bare `focusin` (the same problem as above), then
    // proving nothing: with `pinned` never set, "collapses when focus
    // leaves" and "was never really open" are indistinguishable. Opening via
    // click instead would prove the opposite of the test's name, since
    // `pinned` alone would keep it open regardless of focus. So this opens
    // via hover, lets `focusHeld` pick up while it's still hovered, and only
    // then removes hover — isolating `focusHeld` as the one thing keeping
    // the region open — before finally moving focus outside entirely.
    it("collapses when focus leaves the container entirely", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        const outside = document.createElement("button");
        document.body.appendChild(outside);

        root.dispatchEvent(firePointer("pointerenter", "mouse"));
        flush();
        root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        flush();
        root.dispatchEvent(firePointer("pointerleave", "mouse"));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");

        const moveAway = new FocusEvent("focusout", { bubbles: true });
        Object.defineProperty(moveAway, "relatedTarget", { value: outside });
        root.dispatchEvent(moveAway);
        flush();

        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        outside.remove();
        unmount();
    });

    it("stays open on pointer-leave once pinned by click", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        trigger(container).click();
        flush();
        root.dispatchEvent(firePointer("pointerleave", "mouse"));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        unmount();
    });

    // Regression test for the Critical defect: mobile browsers synthesise a
    // `mouseenter`-equivalent pointer event before a tap's `click`, and no
    // `pointerleave` until the user touches elsewhere. Under the old model
    // that left `hovered` stuck true, so the second tap's `pinned` clear
    // never actually closed anything. The current suite would pass without
    // this test.
    it("opens on tap and closes on a second tap, since touch never sets hover", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;

        root.dispatchEvent(firePointer("pointerenter", "touch"));
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");

        trigger(container).click();
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("true");

        trigger(container).click();
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");

        unmount();
    });

    it("does not expand when focus merely tabs to the trigger", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        flush();
        expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("collapses on Escape and returns focus to the trigger", () => {
        const { container, unmount } = mount();
        const btn = trigger(container);
        const link = container.querySelector("a") as HTMLAnchorElement;

        btn.click();
        flush();
        link.focus();
        flush();
        expect(document.activeElement).toBe(link);

        link.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        flush();

        expect(btn.getAttribute("aria-expanded")).toBe("false");
        expect(document.activeElement).toBe(btn);
        unmount();
    });
});

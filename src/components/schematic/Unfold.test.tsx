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

    it("labels the trigger for screen readers", () => {
        const { container, unmount } = mount();
        expect(trigger(container).getAttribute("aria-label")).toBe(
            "app detail",
        );
        unmount();
    });

    it("expands on hover and collapses when the pointer leaves", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        root.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("stays open while focus moves into the revealed content", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        const link = container.querySelector("a") as HTMLAnchorElement;

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

    it("collapses when focus leaves the container entirely", () => {
        const { container, unmount } = mount();
        const root = container.firstElementChild as HTMLElement;
        const outside = document.createElement("button");
        document.body.appendChild(outside);

        root.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
        flush();
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
        root.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
        flush();
        expect(region(container).getAttribute("aria-hidden")).toBe("false");
        unmount();
    });
});

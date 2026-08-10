// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "./renderSolid";

describe("renderSolid", () => {
    it("mounts a component and exposes its container", () => {
        const { container, unmount } = renderSolid(() => <p>hello</p>);
        expect(container.textContent).toBe("hello");
        unmount();
    });

    it("removes the container from the document on unmount", () => {
        const { container, unmount } = renderSolid(() => <p>bye</p>);
        expect(document.body.contains(container)).toBe(true);
        unmount();
        expect(document.body.contains(container)).toBe(false);
    });

    it("isolates consecutive renders", () => {
        const a = renderSolid(() => <p>first</p>);
        const b = renderSolid(() => <p>second</p>);
        expect(a.container.textContent).toBe("first");
        expect(b.container.textContent).toBe("second");
        a.unmount();
        b.unmount();
    });
});

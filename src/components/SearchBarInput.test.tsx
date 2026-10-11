// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/swUtils", () => ({ hasServiceWorker: () => false }));

import SearchBarInput from "./SearchBarInput";

describe("SearchBarInput without a service worker", () => {
    it("tells the user the browser is not supported instead of a dead search bar", async () => {
        const { container, unmount } = renderSolid(() => (
            <SearchBarInput onSubmit={() => {}} onSuggestions={() => {}} />
        ));

        await vi.waitFor(() =>
            expect(container.querySelector('[role="status"]')).not.toBeNull(),
        );
        const input = container.querySelector("input")!;
        expect(input.disabled).toBe(true);
        expect(input.getAttribute("aria-describedby")).toBe("sb-unsupported");
        expect(container.querySelector("button")?.disabled).toBe(true);
        expect(container.textContent).toContain(
            "This browser does not support service workers.",
        );
        unmount();
    });
});

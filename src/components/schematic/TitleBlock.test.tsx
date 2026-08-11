// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import TitleBlock from "./TitleBlock";

describe("TitleBlock", () => {
    it("renders eyebrow and title", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="launcher" title="Apps" />
        ));
        expect(container.textContent).toContain("launcher");
        expect(container.textContent).toContain("Apps");
        unmount();
    });

    it("renders the title as the page heading", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="launcher" title="Apps" />
        ));
        expect(container.querySelector("h1")?.textContent).toBe("Apps");
        unmount();
    });

    it("renders meta only when supplied", () => {
        const withMeta = renderSolid(() => (
            <TitleBlock eyebrow="e" title="t" meta="12 pinned" />
        ));
        expect(withMeta.container.textContent).toContain("12 pinned");
        withMeta.unmount();

        const without = renderSolid(() => <TitleBlock eyebrow="e" title="t" />);
        expect(
            without.container.querySelector(`.${s.titleBlockMeta}`),
        ).toBeNull();
        without.unmount();
    });

    it("renders actions when supplied", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock
                eyebrow="e"
                title="t"
                actions={<button type="button">go</button>}
            />
        ));
        expect(container.querySelector("button")?.textContent).toBe("go");
        unmount();
    });

    it("marks the index dash decorative", () => {
        const { container, unmount } = renderSolid(() => (
            <TitleBlock eyebrow="e" title="t" />
        ));
        expect(
            container
                .querySelector(`.${s.titleBlockMark}`)
                ?.getAttribute("aria-hidden"),
        ).toBe("true");
        unmount();
    });
});

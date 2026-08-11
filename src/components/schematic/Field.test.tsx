// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { renderSolid } from "$tests/helpers/renderSolid";
import * as s from "~/styles/schematic.css";
import Field from "./Field";

describe("Field", () => {
    it("associates its label with its input", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="url to check" value="" onInput={() => {}} />
        ));
        const label = container.querySelector("label") as HTMLLabelElement;
        const input = container.querySelector("input") as HTMLInputElement;
        expect(label.getAttribute("for")).toBe(input.id);
        expect(input.id).toBeTruthy();
        unmount();
    });

    it("shows the label text", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="add item" value="" onInput={() => {}} />
        ));
        expect(container.textContent).toContain("add item");
        unmount();
    });

    it("reflects the value", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="chess.org" onInput={() => {}} />
        ));
        expect(
            (container.querySelector("input") as HTMLInputElement).value,
        ).toBe("chess.org");
        unmount();
    });

    it("reports typed input as a plain string", () => {
        const onInput = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={onInput} />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        input.value = "typed";
        input.dispatchEvent(new Event("input", { bubbles: true }));
        expect(onInput).toHaveBeenCalledWith("typed");
        unmount();
    });

    it("calls onEnter when Enter is pressed", () => {
        const onEnter = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} onEnter={onEnter} />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
        );
        expect(onEnter).toHaveBeenCalledOnce();
        unmount();
    });

    it("ignores other keys", () => {
        const onEnter = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} onEnter={onEnter} />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "a", bubbles: true }),
        );
        expect(onEnter).not.toHaveBeenCalled();
        unmount();
    });

    it("renders a hint and links it to the input for assistive tech", () => {
        const { container, unmount } = renderSolid(() => (
            <Field
                label="l"
                value=""
                onInput={() => {}}
                hint="not a web address"
            />
        ));
        const input = container.querySelector("input") as HTMLInputElement;
        const hint = container.querySelector(`.${s.inputHint}`) as HTMLElement;
        expect(hint.textContent).toBe("not a web address");
        expect(input.getAttribute("aria-describedby")).toBe(hint.id);
        unmount();
    });

    it("omits the hint element when there is no hint", () => {
        const { container, unmount } = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} />
        ));
        expect(container.querySelector(`.${s.inputHint}`)).toBeNull();
        expect(
            (container.querySelector("input") as HTMLInputElement).hasAttribute(
                "aria-describedby",
            ),
        ).toBe(false);
        unmount();
    });

    it("defaults to a text input and honours an override", () => {
        const asText = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} />
        ));
        expect(
            (asText.container.querySelector("input") as HTMLInputElement).type,
        ).toBe("text");
        asText.unmount();

        const asEmail = renderSolid(() => (
            <Field label="l" value="" onInput={() => {}} type="email" />
        ));
        expect(
            (asEmail.container.querySelector("input") as HTMLInputElement).type,
        ).toBe("email");
        asEmail.unmount();
    });
});

import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { IconClock } from "~/components/icons";

import Specimen from "./Specimen";

import * as s from "~/styles/Specimen.css";

describe("Specimen", () => {
    it("is decorative, carries its tint, and holds its glyph at half size", () => {
        const { container, unmount } = renderSolid(() => (
            <Specimen icon={IconClock} tint="juniper" size={48} />
        ));
        const tile = container.firstElementChild!;
        expect(tile.getAttribute("aria-hidden")).toBe("true");
        expect(tile.className).toContain(s.tint.juniper);
        const glyph = tile.querySelector('svg[data-icon="clock"]');
        expect(glyph?.getAttribute("width")).toBe("24");
        unmount();
    });

    it("defaults to a cobalt tile", () => {
        const { container, unmount } = renderSolid(() => (
            <Specimen icon={IconClock} />
        ));
        expect(container.firstElementChild!.className).toContain(s.tint.cobalt);
        unmount();
    });

    // The link is the hover target, so the pointer is followed across all of
    // it; the side of the tile nearer the pointer rises.
    it("turns toward the pointer over its link and settles when it leaves", async () => {
        const { container, unmount } = renderSolid(() => (
            <a href="/apps">
                <Specimen icon={IconClock} size={40} />
                Apps
            </a>
        ));
        await Promise.resolve();
        const link = container.querySelector("a")!;
        const mount = link.firstElementChild as HTMLElement;
        mount.getBoundingClientRect = () => new DOMRect(0, 0, 40, 40);
        const tilt = () => [
            mount.style.getPropertyValue("--tilt-x"),
            mount.style.getPropertyValue("--tilt-y"),
        ];
        const move = (clientX: number, clientY: number) =>
            link.dispatchEvent(
                new PointerEvent("pointermove", {
                    clientX,
                    clientY,
                    pointerType: "mouse",
                }),
            );

        move(0, 0);
        expect(tilt()).toEqual(["-12deg", "12deg"]);
        move(20, 90);
        expect(tilt()).toEqual(["12deg", "0deg"]);
        link.dispatchEvent(new PointerEvent("pointerleave"));
        expect(tilt()).toEqual(["", ""]);
        unmount();
    });
});

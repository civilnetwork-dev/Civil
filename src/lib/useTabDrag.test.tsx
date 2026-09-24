// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { onSettled } from "solid-js";
import { expect, it, vi } from "vitest";

const releases = vi.hoisted(() => [vi.fn(), vi.fn(), vi.fn()]);
vi.mock("@atlaskit/pragmatic-drag-and-drop/element/adapter", () => ({
    draggable: () => releases[0],
    dropTargetForElements: () => releases[1],
    monitorForElements: () => releases[2],
}));
import {
    registerTabDraggable,
    registerTabDropTarget,
    registerTabMonitor,
} from "./useTabDrag";

it("registers tab drag handlers in Solid 2 settled scopes and releases them on unmount", async () => {
    const element = document.createElement("div");
    const view = renderSolid(() => {
        onSettled(() => {
            const cleanup = [
                registerTabDraggable(element, "tab", () => element, {
                    setDraggingId: () => {},
                }),
                registerTabDropTarget(element, "tab", {
                    getTabs: () => [],
                    onReorder: () => {},
                }),
                registerTabMonitor({ setDraggingId: () => {} }),
            ];
            return () => cleanup.forEach(release => release());
        });
        return element;
    });
    await Promise.resolve();
    view.unmount();
    releases.forEach(release => expect(release).toHaveBeenCalledOnce());
});

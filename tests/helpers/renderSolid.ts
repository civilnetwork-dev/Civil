import { render } from "@solidjs/web";
import type { JSX } from "solid-js";

/**
 * Mount a Solid component into a detached container for assertions.
 *
 * Exists so component tests need no third-party testing library:
 * `@solidjs/web` is already a dependency and its `render` returns the dispose
 * function, which is all a test needs.
 *
 * Callers must invoke `unmount()`; leaving containers attached leaks DOM
 * between tests and makes `document.body` queries match the wrong render.
 */
export function renderSolid(component: () => JSX.Element): {
    container: HTMLElement;
    unmount: () => void;
} {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dispose = render(component, container);
    return {
        container,
        unmount: () => {
            dispose();
            container.remove();
        },
    };
}

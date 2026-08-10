import { clientOnly as startClientOnly } from "@solidjs/start";
import type { ComponentProps, JSX } from "@solidjs/web";
import type { Component } from "solid-js";

export function clientOnly<T extends Component<any>>(
    fn: () => Promise<{ default: T }>,
    options?: { lazy?: boolean },
): (props: ComponentProps<T> & { fallback?: JSX.Element }) => JSX.Element {
    return startClientOnly(fn as any, options) as never;
}

import { promiseHooks } from "node:v8";
import { runInContext, type Context } from "node:vm";

export const ASYNC_CONTAINMENT_INCOMPLETE =
    "VM detached rejection containment is unavailable in this runtime";

interface PromiseState {
    handled: boolean;
    parent?: PromiseState;
}

interface Scope {
    active: boolean;
    observing: boolean;
    timers: Set<ReturnType<typeof setTimeout>>;
}

function observeRejection(
    promise: Promise<unknown>,
    state: PromiseState,
    scope: Scope,
    onError: (error: unknown) => void,
): void {
    // A promise is not fully initialized inside the V8 init hook.
    queueMicrotask(() => {
        if (!scope.active) return;
        scope.observing = true;
        try {
            void Promise.prototype.then.call(promise, undefined, error => {
                const timer = setTimeout(() => {
                    scope.timers.delete(timer);
                    if (scope.active && !state.handled) onError(error);
                }, 0);
                scope.timers.add(timer);
            });
        } finally {
            scope.observing = false;
        }
    });
}

/** Contains detached async startup too; process rejection listeners cannot isolate VMs. */
export function containVmRejections(
    context: Context,
    onError: (error: unknown) => void,
): (() => void) | undefined {
    const prototype = runInContext("Promise.prototype", context) as object;
    const promises = new WeakMap<Promise<unknown>, PromiseState>();
    const scope: Scope = { active: true, observing: false, timers: new Set() };
    let stop: () => void;
    try {
        const stopHook = promiseHooks.createHook({
            init(promise, parent) {
                if (scope.observing) return;
                const previous = parent && promises.get(parent);
                if (
                    !previous &&
                    !Object.prototype.isPrototypeOf.call(prototype, promise)
                )
                    return;
                const state = { handled: false, parent: previous };
                promises.set(promise, state);
                observeRejection(promise, state, scope, onError);
            },
            before(promise) {
                // await creates parent links that are not rejection handlers.
                const parent = promises.get(promise)?.parent;
                if (parent) parent.handled = true;
            },
        });
        stop = () => stopHook();
    } catch {
        // Bun exposes this API but throws NotImplementedError when called.
        return undefined;
    }
    return () => {
        scope.active = false;
        stop();
        for (const timer of scope.timers) clearTimeout(timer);
        scope.timers.clear();
    };
}

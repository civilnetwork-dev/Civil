import type { ChromeEvent } from "../types";

export class CivilEvent<TCallback extends (...args: never[]) => unknown>
    implements ChromeEvent<TCallback>
{
    private readonly _listeners = new Set<TCallback>();

    addListener(callback: TCallback): void {
        this._listeners.add(callback);
    }

    removeListener(callback: TCallback): void {
        this._listeners.delete(callback);
    }

    hasListener(callback: TCallback): boolean {
        return this._listeners.has(callback);
    }

    hasListeners(): boolean {
        return this._listeners.size > 0;
    }

    dispatch(...args: Parameters<TCallback>): ReturnType<TCallback>[] {
        const results: ReturnType<TCallback>[] = [];
        for (const cb of this._listeners) {
            try {
                const r = (cb as unknown as (...a: unknown[]) => unknown)(
                    ...args,
                );
                results.push(r as ReturnType<TCallback>);
            } catch (e) {
                console.error("[civil-ext-shim] event listener threw:", e);
            }
        }
        return results;
    }

    get size(): number {
        return this._listeners.size;
    }
}

export function makeNoopEvent<
    T extends (...args: never[]) => unknown,
>(): ChromeEvent<T> {
    return new CivilEvent<T>();
}

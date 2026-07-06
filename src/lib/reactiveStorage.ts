import { type Accessor, createRoot, createSignal } from "solid-js";

/**
 * Reactive localStorage layer.
 *
 * The native `storage` event only fires in *other* tabs, never the one that
 * performed the write, so same-tab UI never learns about its own updates. Every
 * write here goes through {@link lsSetRaw}/{@link lsSetJSON}/{@link lsRemove},
 * which dispatch a same-tab `civil:ls-change` CustomEvent keyed by the storage
 * key. Consumers subscribe with {@link onLsChange} or read a live value via
 * {@link createReactiveJSON}. Cross-tab updates are covered by also listening to
 * the native `storage` event.
 */

const CHANGE_EVENT = "civil:ls-change";

function emit(key: string): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key } }));
}

/** Write a raw string and notify same-tab + cross-tab listeners. */
export function lsSetRaw(key: string, value: string): void {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
    emit(key);
}

/** JSON-encode a value, write it, and notify listeners. */
export function lsSetJSON(key: string, value: unknown): void {
    lsSetRaw(key, JSON.stringify(value));
}

/** Remove a key and notify listeners. */
export function lsRemove(key: string): void {
    if (typeof localStorage !== "undefined") localStorage.removeItem(key);
    emit(key);
}

/**
 * Run `cb` whenever `key` changes in this tab (via the helpers above) or another
 * tab (native `storage` event). Returns an unsubscribe function.
 */
export function onLsChange(key: string, cb: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const onCustom = (e: Event) => {
        if ((e as CustomEvent<{ key: string }>).detail?.key === key) cb();
    };
    const onStorage = (e: StorageEvent) => {
        if (e.key === key || e.key === null) cb();
    };
    window.addEventListener(CHANGE_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, onCustom);
        window.removeEventListener("storage", onStorage);
    };
}

/**
 * Module-level reactive accessor for a JSON-backed localStorage key. Reading the
 * accessor inside a tracking scope (JSX, createMemo, createEffect) re-runs when
 * the value changes from any write in any tab. The signal lives for the app's
 * lifetime (created in a detached root), so a single instance is shared by all
 * consumers of the key.
 */
export function createReactiveJSON<T>(key: string, fallback: T): Accessor<T> {
    const read = (): T => {
        if (typeof localStorage === "undefined") return fallback;
        try {
            const raw = localStorage.getItem(key);
            return raw === null ? fallback : (JSON.parse(raw) as T);
        } catch {
            return fallback;
        }
    };
    // Box the value so a `T` that is itself a function isn't mistaken for a
    // signal updater, and to sidestep createSignal's Exclude<T, Function> typing.
    return createRoot(() => {
        const [box, setBox] = createSignal<{ value: T }>({ value: read() });
        onLsChange(key, () => setBox({ value: read() }));
        return () => box().value;
    });
}

/**
 * Chrome's other calling convention.
 *
 * Every method in `api/*.ts` is written as an `async` function, which is the
 * MV3 promise style. That is not the only style extensions use, and for a
 * good part of this corpus it isn't even an available one:
 *
 *   - MV2 has **no** promise API at all. `chrome.storage.local.get(keys, cb)`
 *     is how you read storage, full stop. Seven of the twenty-eight tracked
 *     filters are still MV2.
 *   - MV3 kept callbacks working, and vendors kept using them — out of habit,
 *     and because the same source often has to run under both manifest
 *     versions and under Firefox. The scan behind
 *     `fixtures/filterApiSurface.json` finds callback-style calls in twenty
 *     of the twenty-eight bundles, including MV3-only ones.
 *
 * A method that returns a promise and ignores the function it was handed
 * doesn't fail loudly — the extension just waits forever for a reply that
 * never comes. That reads as "this extension does nothing", which is the
 * most misleading possible result for a host whose whole job is observing
 * what a filter extension does.
 *
 * `withCallbacks` closes that by wrapping an already-written promise API: if
 * the last argument is a function, it is removed from the call and invoked
 * with the result. The promise is still returned, so promise-style callers
 * are unaffected.
 */

import { buildFreshConsole } from "./platform";

// A callback that throws is the vendor's error, reported the way Chrome does
// — to the extension's own console, never past the API call that invoked it.
// Let it propagate and it surfaces as an unhandled rejection in whatever
// process hosts this (mobileguardian's storage callback, calling a
// `runtime.getManifest` its content script didn't have yet).
const vendorConsole = buildFreshConsole();

function invoke(callback: (value: unknown) => void, value: unknown): void {
    try {
        callback(value);
    } catch (error) {
        vendorConsole.error(error);
    }
}

/** An object is an event registry, not a namespace of methods, if it has an
 *  `addListener`. The distinction matters because the two are told apart by
 *  the same signal otherwise: `chrome.storage.local.clear(cb)` passes a lone
 *  function that IS a callback, and `chrome.tabs.onUpdated.addListener(fn)`
 *  passes a lone function that is NOT. Recursing into events and treating
 *  their listeners as callbacks would silently unregister every listener a
 *  filter installs. */
function isEventRegistry(value: object): boolean {
    return (
        typeof (value as { addListener?: unknown }).addListener === "function"
    );
}

function wrapMethod(
    method: (...args: unknown[]) => unknown,
): (...args: unknown[]) => unknown {
    const wrapped = (...args: unknown[]) => {
        const last = args[args.length - 1];
        // Untouched, and not coerced to a promise either: `runtime.getURL`
        // and `runtime.getManifest` return their value synchronously in real
        // Chrome, and bundles use the result directly.
        if (typeof last !== "function") return method(...args);

        const callback = last as (value: unknown) => void;
        const result = method(...args.slice(0, -1));
        // Chrome calls the callback on the next turn, never synchronously
        // inside the call. `Promise.resolve` gives that for free and also
        // handles a method that returned a plain value rather than a promise.
        const settled = Promise.resolve(result);
        void settled.then(
            value => invoke(callback, value),
            // Chrome reports a failed call by leaving `runtime.lastError` set
            // and calling the callback with no result — it does not throw at
            // the call site, and it does not skip the callback. Skipping it
            // here would reintroduce exactly the silent hang this file
            // exists to prevent.
            () => invoke(callback, undefined),
        );
        return settled;
    };

    // `name` and `length` are not cosmetic here. A rest-parameter wrapper
    // reports `length === 0` and `name === "wrapped"`, and bundles that
    // wrap the whole `chrome` object in a promisifying layer introspect
    // exactly those to decide which methods take a callback and how many
    // arguments precede it. goguardian's layer, handed a zero-arity
    // `extension.getURL`, promisified it — after which `getURL()` returned a
    // Promise, the extension passed that Promise to `XMLHttpRequest.open`,
    // and it died parsing the empty response several modules away.
    Object.defineProperty(wrapped, "name", {
        value: method.name,
        configurable: true,
    });
    Object.defineProperty(wrapped, "length", {
        value: method.length,
        configurable: true,
    });
    return wrapped;
}

/**
 * Returns `api` with every method also accepting a trailing callback.
 * Recurses one level into plain sub-objects (`storage.local`, `storage.sync`)
 * and leaves event registries alone. Non-function members (`runtime.id`,
 * `declarativeNetRequest.MAX_NUMBER_OF_DYNAMIC_AND_SESSION_RULES`) pass
 * through untouched.
 */
export function withCallbacks<T extends object>(api: T): T {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(api)) {
        if (typeof value === "function") {
            out[key] = wrapMethod(value as (...args: unknown[]) => unknown);
        } else if (
            value !== null &&
            typeof value === "object" &&
            !isEventRegistry(value)
        ) {
            out[key] = withCallbacks(value);
        } else {
            out[key] = value;
        }
    }
    return out as T;
}

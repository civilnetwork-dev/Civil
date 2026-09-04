/**
 * A black hole for any `chrome.*`/`browser.*` member this host hasn't
 * implemented.
 *
 * Real vendor extensions reach for dozens of APIs (`windows`, `webRequest`,
 * `cookies`, `identity`, `idle`, `notifications`, ...) during startup even
 * when only a handful of them matter to filter-evasion analysis. Without a
 * fallback, the first `chrome.windows.onFocusChanged.addListener(...)` in a
 * real bundle throws `TypeError: undefined is not an object` and the whole
 * background script dies before ever reaching the declarativeNetRequest
 * calls this host actually exists to observe — confirmed against a real
 * Blocksi service worker while building this.
 *
 * `universalStub()` is simultaneously callable (any call resolves to
 * `undefined`) and infinitely indexable (any property access returns
 * another stub), so `chrome.windows.getCurrent()`,
 * `chrome.windows.onFocusChanged.addListener(fn)`, and
 * `chrome.windows.WINDOW_ID_NONE` all "work" by doing nothing, rather than
 * crashing the script that touches them.
 */
/** Registering a listener is not a callback-style call. Both look identical
 *  from inside the proxy — one trailing function argument — so the member
 *  name is what tells them apart, and getting it wrong is worse than doing
 *  nothing: firing `chrome.webRequest.onBeforeRequest.addListener(fn)`'s
 *  argument immediately calls the vendor's request handler with no request,
 *  and it dies on `details.url`. */
const LISTENER_METHODS = new Set([
    "addListener",
    "removeListener",
    "hasListener",
    "addEventListener",
    "removeEventListener",
    "addRules",
    "removeRules",
]);

export function universalStub(member = ""): unknown {
    const fn = (..._args: unknown[]) => Promise.resolve(undefined);
    return new Proxy(fn, {
        get(_target, prop) {
            // Without this, `await` sees a callable `.then` on the stub and
            // treats it as a thenable — calling `stub.then(resolve, reject)`
            // returns a promise of its own instead of invoking `resolve`,
            // so the `await` never settles. Reporting no `.then` makes the
            // stub a plain, already-"resolved" value to `await` instead.
            if (prop === "then") return undefined;
            // Same rule as withFallback: a stub of a stub must not claim to
            // be an ES module or an already-promisified API either.
            if (isIntrospectionProbe(prop)) return undefined;
            return universalStub(typeof prop === "string" ? prop : "");
        },
        apply(_target, _thisArg, args: unknown[]) {
            // A stubbed call made in callback style still has to call back.
            // `chrome.tabs.captureVisibleTab(cb)` and
            // `chrome.tabs.reload(id, cb)` are real calls in real bundles
            // against members this host doesn't implement; a stub that
            // absorbs the call but never invokes the callback leaves the
            // bundle waiting forever, which is the same silent hang
            // api/callbacks.ts exists to prevent for the implemented ones.
            // Chrome's behavior for a call that produced no result is to
            // invoke the callback with `undefined`, on a later turn.
            const last = args[args.length - 1];
            if (typeof last === "function" && !LISTENER_METHODS.has(member))
                queueMicrotask(() => (last as () => void)());
            return Promise.resolve(undefined);
        },
    });
}

/** Wraps a real, implemented API tree so any namespace not present on it
 *  (`chrome.windows`, `chrome.webRequest`, ...) falls back to a stub instead
 *  of being `undefined`. Implemented namespaces are untouched. */
/**
 * Names that are questions about the object rather than requests for a
 * Chrome API, and so must answer `undefined` — the truth — instead of a
 * stub.
 *
 * A stub that says yes to everything says yes to these too, and each one
 * then means something false:
 *
 *   - `__esModule` is the module-interop flag every webpack bundle checks:
 *     `e.__esModule ? e : { default: e }`. Answering truthily makes the
 *     bundle skip the wrapper and read `chrome.default`, which is another
 *     stub, and from there `chrome.default.extension.getURL(path)` returns a
 *     promise instead of a URL. goguardian then handed that promise to
 *     `XMLHttpRequest.open` and died parsing the empty result, four modules
 *     and no recognisable clue away from the cause.
 *   - Any other `__dunder__` is tooling protocol for the same reason.
 *   - `default` is the other half of that interop pair.
 *
 * The rule these share: the stub exists so an API this host doesn't
 * implement does nothing instead of throwing. It does not exist to claim the
 * object is something it is not.
 *
 * The `Async` promisification suffix was tried here too and removed. It is
 * the same kind of name — a question, not an API — but answering `undefined`
 * breaks the opposite case: bundles that promisify the whole `chrome` object
 * and then call `tabs.executeScriptAsync` for a member this host stubs get a
 * hard `is not a function` where a stub would have absorbed it. Stubbing it
 * costs nothing that was observed; withholding it cost goguardian.
 */
function isIntrospectionProbe(prop: string | symbol): boolean {
    if (typeof prop !== "string") return false;
    return prop.startsWith("__") || prop === "default";
}

export function withFallback<T extends object>(implemented: T): T {
    return new Proxy(implemented, {
        get(target, prop, receiver) {
            if (Reflect.has(target, prop))
                return Reflect.get(target, prop, receiver);
            if (isIntrospectionProbe(prop)) return undefined;
            return universalStub(typeof prop === "string" ? prop : "");
        },
    });
}

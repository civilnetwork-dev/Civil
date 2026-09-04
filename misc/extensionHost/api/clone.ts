/**
 * Every value that crosses from the sandboxed extension script into
 * `ExtensionState` (action-call args, sendResponse payloads, storage writes,
 * DNR rules) was constructed in the vm sandbox's own V8 realm, so it carries
 * that realm's `Object`/`Array` prototypes — not the host's. Values print
 * identically either way, but a host-side deep-equal that fast-paths on
 * prototype identity (as vitest's does) sees them as unequal, and so would
 * any downstream consumer doing the same. Real Chrome imposes the same
 * "structured-cloneable" contract on exactly these boundaries (storage,
 * messaging, declarativeNetRequest), so cloning here isn't a workaround —
 * it's the same rule Chrome already enforces, just also fixing the realm.
 */
export function crossRealm<T>(value: T): T {
    try {
        return structuredClone(value);
    } catch {
        // `chrome.storage` is not actually structured-clone backed — Chrome
        // serializes it as JSON, which silently drops functions, symbols and
        // class instances rather than throwing on them. A bundle storing an
        // object with a method on it therefore works in Chrome and threw
        // here, taking down whatever `await`ed the write (loilo's, in
        // particular). Matching Chrome means falling back to the JSON rule,
        // and dropping the value entirely only if even that fails — a
        // circular structure, which Chrome rejects too.
        try {
            return JSON.parse(JSON.stringify(value)) as T;
        } catch {
            // Neither clone worked — a structure too deep for the JSON
            // serializer, or circular. Keep the original rather than
            // substituting `undefined`: the value crossing realms untouched
            // is a cosmetic problem (foreign prototypes), whereas silently
            // storing nothing is a data loss the extension discovers much
            // later as `data[key]` on an object that isn't there.
            // mobileguardian hit exactly that, and surfaced it as a stack
            // overflow followed by an unrelated-looking TypeError.
            return value;
        }
    }
}

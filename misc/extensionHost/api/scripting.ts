/**
 * chrome.scripting. There is no DOM here for `executeScript` to run
 * `func`/`files` against — "without emulating a full browser" is exactly the
 * line this API sits on. Without a `runScript` callback, calls are recorded
 * and resolve with an empty result array (Chrome's own shape for "ran,
 * produced no frame results"), so background scripts that call this during
 * startup and check the return shape don't throw; nothing actually executes.
 *
 * A caller with a real page to inject into (misc/filterProbe/sandbox.ts, via
 * `LoadOptions.runScript`) gets real execution instead — some filters
 * (interclass) block by injecting a redirect this way rather than through a
 * static content script.
 */

interface InjectionTarget {
    target?: { tabId?: number; frameIds?: number[]; allFrames?: boolean };
    func?: (...args: unknown[]) => unknown;
    args?: unknown[];
    files?: string[];
}

export function buildScripting(
    runScript?: (call: {
        func?: string;
        files?: string[];
        args?: unknown[];
    }) => Promise<unknown[]>,
) {
    return {
        executeScript: async (details: InjectionTarget = {}) => {
            if (!runScript) return [];
            // `func` is serialized to source here, at the boundary — real
            // Chrome does the same (structured-clones the function into the
            // target frame's isolated world), which is also why a `func`
            // that closes over the background's own variables never worked
            // for real either; only its own arguments are.
            return runScript({
                func: details.func?.toString(),
                files: details.files,
                args: details.args,
            });
        },
        insertCSS: async () => {},
        removeCSS: async () => {},
        registerContentScripts: async () => {},
        getRegisteredContentScripts: async () => [],
    };
}

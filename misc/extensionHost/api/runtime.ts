/** chrome.runtime: id, manifest, and same-process message dispatch.
 *
 * There is exactly one JS realm per loaded extension here (no separate
 * background/content/popup contexts to bridge between), so `sendMessage`
 * doesn't need the postMessage bus the in-page shim uses — it calls
 * registered listeners directly and collects whichever `sendResponse` fired
 * first, matching Chrome's own "first responder wins" behavior.
 */

import type { ChromeManifest } from "../../browserApiEmulators/extensions/chrome/types";
import { extensionUrl } from "../manifest";
import type { ExtensionState, RuntimeMessageListener } from "../state";
import { crossRealm } from "./clone";

export interface RuntimeDeps {
    extensionId: string;
    manifest: ChromeManifest;
    state: ExtensionState;
}

export async function dispatchMessage(
    state: ExtensionState,
    message: unknown,
): Promise<{ response: unknown; handled: boolean }> {
    for (const listener of state.messageListeners) {
        let responded = false;
        let response: unknown;
        const keepAsync = listener(message, state.messageSender, r => {
            responded = true;
            response = crossRealm(r);
        });
        if (responded) return { response, handled: true };
        // A listener returning `true` means it will call sendResponse
        // asynchronously (the real chrome.runtime contract). This host runs
        // everything synchronously in one tick, so "asynchronous" here just
        // means "after this listener returns" rather than "after a promise
        // resolves" — good enough for extensions that call sendResponse from
        // a microtask, which is the common real-world pattern.
        if (keepAsync === true) {
            await Promise.resolve();
            if (responded) return { response, handled: true };
        }
    }
    return { response: undefined, handled: false };
}

/** A `Port` that keeps its holder running without carrying anything.
 *
 * Nine of the twenty-eight tracked filters call `runtime.connect`, and a port
 * is used the moment it is created — `port.onMessage.addListener(...)`,
 * `port.postMessage(...)` — so returning nothing usable kills the background
 * script on its next line. There is only one JS realm per loaded extension
 * here, so there is no second end for a real port to reach; what this
 * provides is a port-shaped object that absorbs both, which is enough for
 * setup code to complete and honest about delivering no messages. */
function buildPort(name: string) {
    return {
        name,
        sender: undefined,
        postMessage: () => {},
        disconnect: () => {},
        onMessage: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
        onDisconnect: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
    };
}

export function buildRuntime(deps: RuntimeDeps) {
    const { extensionId, manifest, state } = deps;
    state.messageSender = {
        id: extensionId,
        url: extensionUrl(extensionId, "background.js"),
    };

    return {
        id: extensionId,
        getManifest: () => manifest,
        getURL: (path: string) => extensionUrl(extensionId, path),
        lastError: undefined as { message: string } | undefined,

        sendMessage: (...args: unknown[]) => {
            // Overloads: sendMessage(message), sendMessage(message, options),
            // sendMessage(extId, message, ...). The extension id form is a
            // no-op here (single-extension host). A trailing callback is not
            // handled here — every method in this host gets that uniformly
            // from `withCallbacks`, which strips it before this ever sees it.
            const message =
                typeof args[0] === "string" && args.length > 1
                    ? args[1]
                    : args[0];
            state.sentMessages.push(message);

            // Delivered to nobody, deliberately. Chrome fires `onMessage` in
            // every frame of the extension *except the frame that sent the
            // message* — a background page that messages itself does not hear
            // itself. This host has exactly one frame, so a `sendMessage`
            // from inside it reaches no listener at all, and the reply is
            // `undefined` (Chrome's answer when nothing responds).
            //
            // Echoing it back instead is not a harmless shortcut. It turns
            // any `sendMessage` inside an `onMessage` handler — a completely
            // ordinary shape, "tell everyone the state changed" — into
            // unbounded recursion. mobileguardian's background page does
            // exactly that, and re-entered its own listener 18,689 times
            // before the stack gave out.
            //
            // Messages from *another* context still arrive, which is what
            // `ExtensionHandle.sendMessage` is: a content script or popup
            // talking to the background.
            return Promise.resolve(undefined);
        },

        connect: (...args: unknown[]) => {
            // connect(connectInfo) or connect(extensionId, connectInfo).
            const info = (args.find(
                arg => typeof arg === "object" && arg !== null,
            ) ?? {}) as { name?: string };
            return buildPort(info.name ?? "");
        },
        connectNative: (application: string) => buildPort(application),

        // Read for their contents, not just called: a bundle does
        // `getPlatformInfo(info => info.os)` and dies on the property access
        // if this falls through to a stub that resolves undefined.
        getPlatformInfo: async () => ({
            os: "cros",
            arch: "x86-64",
            nacl_arch: "x86-64",
        }),
        // No offscreen documents, no other extension pages: one realm, and
        // Chrome's answer for "which of these contexts exist" is a list.
        getContexts: async () => [],
        getBackgroundPage: async () => undefined,
        openOptionsPage: async () => {},
        setUninstallURL: async () => {},
        reload: () => {},
        requestUpdateCheck: async () => ({ status: "no_update" }),
        onConnect: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
        onConnectExternal: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },

        onMessage: {
            addListener: (cb: RuntimeMessageListener) =>
                state.messageListeners.add(cb),
            removeListener: (cb: RuntimeMessageListener) =>
                state.messageListeners.delete(cb),
            hasListener: (cb: RuntimeMessageListener) =>
                state.messageListeners.has(cb),
        },

        // Real Chrome fires onInstalled once, the first time an extension is
        // added. A surprising number of vendor bundles register their real
        // DNR rules and webRequest listeners inside this handler rather than
        // at the top of the script — host.ts fires it once after the
        // background script's synchronous top-level body finishes running,
        // so those handlers actually execute instead of sitting unused.
        onInstalled: {
            addListener: (cb: (details: { reason: string }) => void) =>
                state.installedListeners.add(cb),
            removeListener: (cb: (details: { reason: string }) => void) =>
                state.installedListeners.delete(cb),
            hasListener: (cb: (details: { reason: string }) => void) =>
                state.installedListeners.has(cb),
        },
        // onStartup/onSuspend are real registries (so addListener doesn't
        // throw) but never fire: this host has no concept of "browser
        // startup" or "background page unload" to trigger them from.
        onStartup: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
        onSuspend: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
    };
}

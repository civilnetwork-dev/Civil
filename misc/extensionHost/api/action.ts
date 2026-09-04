/** chrome.action (MV3) / chrome.browserAction (MV2). No toolbar exists to
 *  draw a badge on, so every call is recorded rather than rendered — a test
 *  can assert "the extension flagged this page" by checking `actionCalls`. */

import type { ActionCall } from "../types";
import { crossRealm } from "./clone";

export function buildAction(actionCalls: ActionCall[]) {
    const record =
        (method: ActionCall["method"]) =>
        async (...args: unknown[]) => {
            actionCalls.push({ method, args: crossRealm(args) });
        };

    return {
        setBadgeText: record("setBadgeText"),
        setBadgeBackgroundColor: record("setBadgeBackgroundColor"),
        setTitle: record("setTitle"),
        setIcon: record("setIcon"),
        enable: record("enable"),
        disable: record("disable"),
        onClicked: {
            addListener: () => {},
            removeListener: () => {},
            hasListener: () => false,
        },
    };
}

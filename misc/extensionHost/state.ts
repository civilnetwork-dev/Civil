/**
 * The mutable state one loaded extension owns: storage areas, alarms, DNR
 * rules, message listeners. Each `api/*.ts` module is a pure function of
 * this state plus whatever arguments the extension passes in — the state
 * lives here so `host.ts` can snapshot and drive it without reaching through
 * a chain of closures.
 */

import type {
    Alarm,
    MessageSender,
} from "../browserApiEmulators/extensions/chrome/types";
import type { ActionCall, CapturedMessage } from "./types";

/** `managed` is the enterprise-policy area: read-only to the extension,
 *  written by the device's admin console. Five of the tracked filters read
 *  their whole configuration out of it (see filterCompat.test.ts), so a host
 *  without it runs their unconfigured code path rather than the one a
 *  managed Chromebook actually takes. */
export type StorageArea = "local" | "sync" | "session" | "managed";

export interface DNRRuleset {
    /** Chrome's own field name for a rule's id is `id` — not `ruleId`, which
     *  is what `chrome.declarativeNetRequest.getMatchedRules` reports back in
     *  its *results*. A vendor's real rules use `id`. */
    id: number;
    priority: number;
    action: {
        type:
            | "block"
            | "allow"
            | "redirect"
            | "allowAllRequests"
            | "upgradeScheme"
            | "modifyHeaders";
        redirect?: { url?: string };
    };
    condition: {
        urlFilter?: string;
        regexFilter?: string;
        isUrlFilterCaseSensitive?: boolean;
        resourceTypes?: string[];
        excludedResourceTypes?: string[];
        requestMethods?: string[];
        domainType?: "firstParty" | "thirdParty";
        initiatorDomains?: string[];
        excludedInitiatorDomains?: string[];
    };
}

interface ScheduledAlarm extends Alarm {
    /** Virtual-clock timestamp (ms) the alarm next fires at. */
    nextFireAt: number;
}

/** Chrome hands a listener three arguments, in this order. Dropping the
 *  `sender` in the middle is not a harmless simplification: the three-argument
 *  form is what 278 listener registrations across nine of the tracked filter
 *  bundles are written against, and to them a two-argument dispatch makes
 *  `sendResponse` arrive as `undefined` — so every reply they try to send
 *  throws instead. */
export type RuntimeMessageListener = (
    message: unknown,
    sender: MessageSender,
    sendResponse: (response: unknown) => void,
) => boolean | undefined;

export class ExtensionState {
    readonly storage: Record<StorageArea, Map<string, unknown>> = {
        local: new Map(),
        sync: new Map(),
        session: new Map(),
        managed: new Map(),
    };

    /** What `chrome.runtime.onMessage` listeners receive as their `sender`.
     *  Set by `buildRuntime`, which is the only place that knows the id. */
    messageSender: MessageSender = {};

    readonly dynamicRules = new Map<number, DNRRuleset>();
    readonly sessionRules = new Map<number, DNRRuleset>();
    readonly alarms = new Map<string, ScheduledAlarm>();
    readonly messageListeners = new Set<RuntimeMessageListener>();
    readonly installedListeners = new Set<
        (details: { reason: string }) => void
    >();
    readonly actionCalls: ActionCall[] = [];
    readonly capturedMessages: CapturedMessage[] = [];
    /** Messages the extension itself sent with `runtime.sendMessage`. They
     *  reach no listener here (see api/runtime.ts for why that matches
     *  Chrome), so recording them is the only way a test can observe that
     *  the extension tried to broadcast something. */
    readonly sentMessages: unknown[] = [];

    /** Virtual clock. Advanced only by `ExtensionHandle.advanceTime`, never
     *  by wall-clock time — see api/alarms.ts for why. */
    now = 0;

    onAlarmFired: ((alarm: Alarm) => void) | null = null;

    seedStorage(area: StorageArea, data: Record<string, unknown>): void {
        for (const [key, value] of Object.entries(data))
            this.storage[area].set(key, value);
    }

    snapshotStorage(area: StorageArea): Record<string, unknown> {
        return Object.fromEntries(this.storage[area]);
    }

    scheduleAlarm(
        name: string,
        whenMs: number,
        periodMinutes: number | undefined,
    ): void {
        this.alarms.set(name, {
            name,
            scheduledTime: whenMs,
            periodInMinutes: periodMinutes,
            nextFireAt: whenMs,
        });
    }

    /** Fires every alarm now due, rescheduling periodic ones. Called by
     *  `advanceTime` after the clock moves; never on a real timer. */
    advanceTo(targetMs: number): void {
        this.now = targetMs;
        for (const alarm of this.alarms.values()) {
            while (alarm.nextFireAt <= this.now) {
                this.onAlarmFired?.({
                    name: alarm.name,
                    scheduledTime: alarm.nextFireAt,
                    periodInMinutes: alarm.periodInMinutes,
                });
                if (!alarm.periodInMinutes) {
                    this.alarms.delete(alarm.name);
                    break;
                }
                alarm.nextFireAt += alarm.periodInMinutes * 60_000;
            }
        }
    }
}

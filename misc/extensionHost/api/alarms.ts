/**
 * chrome.alarms, backed by the extension's virtual clock rather than real
 * timers.
 *
 * A test that wants to know "does this extension re-check its block-list
 * every 30 minutes" should not have to wait 30 real minutes, or run on fake
 * global timers that also freeze the test framework's own timeouts. Calling
 * `ExtensionHandle.advanceTime(ms)` moves only this extension's clock and
 * fires whatever alarms fall due — deterministic and instant.
 */

import type { ExtensionState } from "../state";

export function buildAlarms(state: ExtensionState) {
    const listeners = new Set<
        (
            alarm: import("../../browserApiEmulators/extensions/chrome/types").Alarm,
        ) => void
    >();
    state.onAlarmFired = alarm => {
        for (const listener of listeners) listener(alarm);
    };

    return {
        create: async (
            ...args:
                | [
                      name: string,
                      info: {
                          when?: number;
                          delayInMinutes?: number;
                          periodInMinutes?: number;
                      },
                  ]
                | [
                      info: {
                          when?: number;
                          delayInMinutes?: number;
                          periodInMinutes?: number;
                      },
                  ]
        ) => {
            // Chrome accepts `create(name, info)` or `create(info)` with the
            // name omitted entirely — not just undefined, genuinely a single
            // argument. A real FortiGuard bundle calls the one-arg form; a
            // fixed `(name, info)` signature crashes on it since `info` is
            // never passed at all.
            const [key, info] =
                typeof args[0] === "string"
                    ? [args[0], args[1]!]
                    : ["", args[0]!];
            // Chrome's own default when only `periodInMinutes` is given: the
            // first fire is one period out, not immediate. Getting this wrong
            // means a freshly created periodic alarm fires the instant the
            // clock moves at all, which is not what "every 30 minutes" means.
            const delayMinutes =
                info.delayInMinutes ?? info.periodInMinutes ?? 0;
            const when = info.when ?? state.now + delayMinutes * 60_000;
            state.scheduleAlarm(key, when, info.periodInMinutes);
        },
        get: async (name?: string) => {
            const alarm = state.alarms.get(name ?? "");
            return alarm
                ? {
                      name: alarm.name,
                      scheduledTime: alarm.scheduledTime,
                      periodInMinutes: alarm.periodInMinutes,
                  }
                : undefined;
        },
        getAll: async () =>
            [...state.alarms.values()].map(a => ({
                name: a.name,
                scheduledTime: a.scheduledTime,
                periodInMinutes: a.periodInMinutes,
            })),
        clear: async (name?: string) => {
            const existed = state.alarms.has(name ?? "");
            state.alarms.delete(name ?? "");
            return existed;
        },
        clearAll: async () => {
            const existed = state.alarms.size > 0;
            state.alarms.clear();
            return existed;
        },
        onAlarm: {
            addListener: (cb: (alarm: unknown) => void) =>
                listeners.add(cb as never),
            removeListener: (cb: (alarm: unknown) => void) =>
                listeners.delete(cb as never),
            hasListener: (cb: (alarm: unknown) => void) =>
                listeners.has(cb as never),
        },
    };
}

import type { Alarm, AlarmCreateInfo } from "../types";
import { CivilEvent } from "./event";
import { dual } from "./util";

type Scheduled = { alarm: Alarm; timerId: ReturnType<typeof setTimeout> };

function scheduledTimeFor(info: AlarmCreateInfo): number {
    if (info.when) return info.when;
    if (info.delayInMinutes != null)
        return Date.now() + info.delayInMinutes * 60_000;
    return Date.now() + 60_000;
}

/** Real timers behind chrome.alarms, rescheduled after each periodic fire. */
class AlarmScheduler {
    readonly alarms = new Map<string, Scheduled>();
    readonly onAlarm = new CivilEvent<(alarm: Alarm) => void>();

    private fire(alarm: Alarm): void {
        this.onAlarm.dispatch({ ...alarm });
        if (!alarm.periodInMinutes) {
            this.alarms.delete(alarm.name);
        }
    }

    schedule(alarm: Alarm): void {
        const existing = this.alarms.get(alarm.name);
        if (existing) clearTimeout(existing.timerId);

        const delayMs = Math.max(0, alarm.scheduledTime - Date.now());

        const fire = () => {
            this.fire(alarm);
            if (alarm.periodInMinutes) {
                alarm.scheduledTime =
                    Date.now() + alarm.periodInMinutes * 60_000;
                const newTimer = setTimeout(
                    fire,
                    alarm.periodInMinutes * 60_000,
                );
                const current = this.alarms.get(alarm.name);
                if (current) current.timerId = newTimer;
            }
        };

        const timerId = setTimeout(fire, delayMs);
        this.alarms.set(alarm.name, { alarm, timerId });
    }

    clear(name: string): boolean {
        const entry = this.alarms.get(name);
        if (!entry) return false;
        clearTimeout(entry.timerId);
        this.alarms.delete(name);
        return true;
    }

    clearAll(): boolean {
        for (const { timerId } of this.alarms.values()) clearTimeout(timerId);
        const had = this.alarms.size > 0;
        this.alarms.clear();
        return had;
    }
}

export function buildAlarmsAPI() {
    const scheduler = new AlarmScheduler();

    function create(
        nameOrInfo: string | AlarmCreateInfo,
        maybeInfo?: AlarmCreateInfo,
    ): void {
        const name = typeof nameOrInfo === "string" ? nameOrInfo : "";
        const info: AlarmCreateInfo =
            typeof nameOrInfo === "object" ? nameOrInfo : (maybeInfo ?? {});
        scheduler.schedule({
            name,
            scheduledTime: scheduledTimeFor(info),
            periodInMinutes: info.periodInMinutes,
        });
    }

    return {
        create,
        get: (
            name: string,
            cb?: (alarm: Alarm | undefined) => void,
        ): Promise<Alarm | undefined> =>
            dual(() => Promise.resolve(scheduler.alarms.get(name)?.alarm), cb),
        getAll: (cb?: (alarms: Alarm[]) => void): Promise<Alarm[]> =>
            dual(
                () =>
                    Promise.resolve(
                        [...scheduler.alarms.values()].map(v => ({
                            ...v.alarm,
                        })),
                    ),
                cb,
            ),
        clear: (
            name?: string,
            cb?: (wasCleared: boolean) => void,
        ): Promise<boolean> =>
            dual(() => Promise.resolve(scheduler.clear(name ?? "")), cb),
        clearAll: (cb?: (wasCleared: boolean) => void): Promise<boolean> =>
            dual(() => Promise.resolve(scheduler.clearAll()), cb),
        onAlarm: scheduler.onAlarm,
    };
}

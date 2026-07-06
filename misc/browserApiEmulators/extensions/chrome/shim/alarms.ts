import type { Alarm, AlarmCreateInfo } from "../types";
import { CivilEvent } from "./event";
import { dual } from "./util";

export function buildAlarmsAPI() {
    const _alarms = new Map<
        string,
        { alarm: Alarm; timerId: ReturnType<typeof setTimeout> }
    >();

    const onAlarm = new CivilEvent<(alarm: Alarm) => void>();

    function _fire(alarm: Alarm): void {
        onAlarm.dispatch({ ...alarm });
        if (!alarm.periodInMinutes) {
            _alarms.delete(alarm.name);
        }
    }

    function _schedule(alarm: Alarm): void {
        const existing = _alarms.get(alarm.name);
        if (existing) clearTimeout(existing.timerId);

        const delayMs = Math.max(0, alarm.scheduledTime - Date.now());

        const fire = () => {
            _fire(alarm);
            if (alarm.periodInMinutes) {
                alarm.scheduledTime =
                    Date.now() + alarm.periodInMinutes * 60_000;
                const newTimer = setTimeout(
                    fire,
                    alarm.periodInMinutes * 60_000,
                );
                const existing2 = _alarms.get(alarm.name);
                if (existing2) existing2.timerId = newTimer;
            }
        };

        const timerId = setTimeout(fire, delayMs);
        _alarms.set(alarm.name, { alarm, timerId });
    }

    function create(
        nameOrInfo: string | AlarmCreateInfo,
        maybeInfo?: AlarmCreateInfo,
    ): void {
        const name = typeof nameOrInfo === "string" ? nameOrInfo : "";
        const info: AlarmCreateInfo =
            typeof nameOrInfo === "object" ? nameOrInfo : (maybeInfo ?? {});

        let scheduledTime: number;
        if (info.when) {
            scheduledTime = info.when;
        } else if (info.delayInMinutes != null) {
            scheduledTime = Date.now() + info.delayInMinutes * 60_000;
        } else {
            scheduledTime = Date.now() + 60_000;
        }

        const alarm: Alarm = {
            name,
            scheduledTime,
            periodInMinutes: info.periodInMinutes,
        };

        _schedule(alarm);
    }

    function get(
        name: string,
        cb?: (alarm: Alarm | undefined) => void,
    ): Promise<Alarm | undefined> {
        return dual(() => Promise.resolve(_alarms.get(name)?.alarm), cb);
    }

    function getAll(cb?: (alarms: Alarm[]) => void): Promise<Alarm[]> {
        return dual(
            () =>
                Promise.resolve(
                    [..._alarms.values()].map(v => ({ ...v.alarm })),
                ),
            cb,
        );
    }

    function clear(
        name?: string,
        cb?: (wasCleared: boolean) => void,
    ): Promise<boolean> {
        return dual(() => {
            const n = name ?? "";
            const entry = _alarms.get(n);
            if (entry) {
                clearTimeout(entry.timerId);
                _alarms.delete(n);
                return Promise.resolve(true);
            }
            return Promise.resolve(false);
        }, cb);
    }

    function clearAll(cb?: (wasCleared: boolean) => void): Promise<boolean> {
        return dual(() => {
            for (const { timerId } of _alarms.values()) clearTimeout(timerId);
            const had = _alarms.size > 0;
            _alarms.clear();
            return Promise.resolve(had);
        }, cb);
    }

    return { create, get, getAll, clear, clearAll, onAlarm };
}

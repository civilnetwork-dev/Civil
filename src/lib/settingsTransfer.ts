import {
    getSetting,
    type SettingKey,
    SETTINGS,
    setSetting,
    type SettingValue,
} from "~/lib/settings";

/**
 * Settings as a file or a block of text, so they survive a Chromebook that
 * wipes itself at sign-out, or move to another browser. Settings only:
 * history, bookmarks and tabs are data and stay where they are.
 *
 * An imported file is untrusted input. Every value goes through the same
 * validation as a stored one (`setSetting` refuses anything the registry
 * would not read back), and keys this build does not know are skipped, not
 * written.
 */

const FORMAT = "civil-settings";
const VERSION = 1;

const KEYS = Object.keys(SETTINGS) as SettingKey[];

export function exportSettings(): string {
    const settings = Object.fromEntries(
        KEYS.map(key => [key, getSetting(key)]),
    );
    return JSON.stringify(
        {
            format: FORMAT,
            version: VERSION,
            exported: new Date().toISOString(),
            settings,
        },
        null,
        2,
    );
}

export type ImportResult =
    | { ok: true; applied: SettingKey[]; skipped: string[] }
    | { ok: false; reason: string };

export function importSettings(text: string): ImportResult {
    let file: unknown;
    try {
        file = JSON.parse(text);
    } catch {
        return { ok: false, reason: "That isn't a Civil settings file." };
    }
    const { format, version, settings } = (file ?? {}) as {
        format?: unknown;
        version?: unknown;
        settings?: unknown;
    };
    if (format !== FORMAT || !settings || typeof settings !== "object") {
        return { ok: false, reason: "That isn't a Civil settings file." };
    }
    if (typeof version !== "number" || version > VERSION) {
        return {
            ok: false,
            reason: "That file comes from a newer Civil. Update Civil, then try again.",
        };
    }

    const applied: SettingKey[] = [];
    const skipped: string[] = [];
    for (const [key, value] of Object.entries(settings)) {
        const known = (KEYS as string[]).includes(key);
        if (
            known &&
            setSetting(key as SettingKey, value as SettingValue<SettingKey>)
        ) {
            applied.push(key as SettingKey);
        } else {
            skipped.push(key);
        }
    }
    return { ok: true, applied, skipped };
}

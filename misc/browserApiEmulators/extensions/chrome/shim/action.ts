import { CivilEvent } from "./event";
import { resolved } from "./util";

interface BadgeState {
    text: string;
    color: string;
    backgroundColor: string;
    title: string;
    popup: string;
    enabled: boolean;
}

type TabDetails = { tabId?: number };

/** The action's global state, with per-tab overrides on top. */
class BadgeStore {
    private readonly global: BadgeState = {
        text: "",
        color: "#ffffff",
        backgroundColor: "#4688f1",
        title: "",
        popup: "",
        enabled: true,
    };

    private readonly tabs = new Map<number, Partial<BadgeState>>();

    get(tabId?: number): BadgeState {
        if (tabId != null) {
            return { ...this.global, ...this.tabs.get(tabId) };
        }
        return { ...this.global };
    }

    set(tabId: number | undefined, patch: Partial<BadgeState>): void {
        if (tabId != null) {
            const prev = this.tabs.get(tabId) ?? {};
            this.tabs.set(tabId, { ...prev, ...patch });
        } else {
            Object.assign(this.global, patch);
        }
    }
}

function badgeSetters(store: BadgeStore) {
    const done = (cb?: () => void) => resolved(undefined, cb);
    return {
        setIcon: (_details: chrome.action.TabIconDetails, cb?: () => void) =>
            done(cb),
        setBadgeText: (
            details: { text: string } & TabDetails,
            cb?: () => void,
        ) => {
            store.set(details.tabId, { text: details.text });
            return done(cb);
        },
        setBadgeBackgroundColor: (
            details: {
                color: string | [number, number, number, number];
            } & TabDetails,
            cb?: () => void,
        ) => {
            const color = Array.isArray(details.color)
                ? `rgba(${details.color.join(",")})`
                : details.color;
            store.set(details.tabId, { backgroundColor: color });
            return done(cb);
        },
        setBadgeTextColor: (
            _details: { color: string } & TabDetails,
            cb?: () => void,
        ) => done(cb),
        setTitle: (
            details: { title: string } & TabDetails,
            cb?: () => void,
        ) => {
            store.set(details.tabId, { title: details.title });
            return done(cb);
        },
        setPopup: (
            details: { popup: string } & TabDetails,
            cb?: () => void,
        ) => {
            store.set(details.tabId, { popup: details.popup });
            return done(cb);
        },
        enable: (tabId?: number, cb?: () => void) => {
            store.set(tabId, { enabled: true });
            return done(cb);
        },
        disable: (tabId?: number, cb?: () => void) => {
            store.set(tabId, { enabled: false });
            return done(cb);
        },
    };
}

function badgeGetters(store: BadgeStore) {
    type Read = (
        details: TabDetails,
        cb?: (result: string) => void,
    ) => Promise<string>;
    const read =
        (key: "text" | "backgroundColor" | "color" | "title" | "popup"): Read =>
        (details, cb) =>
            resolved(store.get(details.tabId)[key], cb);
    return {
        getBadgeText: read("text"),
        getBadgeBackgroundColor: read("backgroundColor"),
        getBadgeTextColor: read("color"),
        getTitle: read("title"),
        getPopup: read("popup"),
        isEnabled: (tabId?: number, cb?: (isEnabled: boolean) => void) =>
            resolved(store.get(tabId).enabled, cb),
    };
}

export function buildActionAPI() {
    const store = new BadgeStore();
    return {
        ...badgeSetters(store),
        ...badgeGetters(store),
        openPopup: (_options?: { windowId?: number }, cb?: () => void) =>
            resolved(undefined, cb),
        getUserSettings: (cb?: (settings: { isOnToolbar: boolean }) => void) =>
            resolved({ isOnToolbar: true }, cb),
        onClicked: new CivilEvent<(tab: chrome.tabs.Tab) => void>(),
        onUserSettingsChanged: new CivilEvent<
            (change: { isOnToolbar?: boolean }) => void
        >(),
    };
}

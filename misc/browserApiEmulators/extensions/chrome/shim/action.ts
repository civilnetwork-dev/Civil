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

export function buildActionAPI() {
    const _state: BadgeState = {
        text: "",
        color: "#ffffff",
        backgroundColor: "#4688f1",
        title: "",
        popup: "",
        enabled: true,
    };

    const _tabStates = new Map<number, Partial<BadgeState>>();

    function _getState(tabId?: number): BadgeState {
        if (tabId != null) {
            return { ..._state, ...(_tabStates.get(tabId) ?? {}) };
        }
        return { ..._state };
    }

    const onClicked = new CivilEvent<(tab: chrome.tabs.Tab) => void>();
    const onUserSettingsChanged = new CivilEvent<
        (change: { isOnToolbar?: boolean }) => void
    >();

    function setIcon(_details: chrome.action.TabIconDetails, cb?: () => void) {
        return resolved(undefined, cb);
    }

    function setBadgeText(
        details: { text: string; tabId?: number },
        cb?: () => void,
    ) {
        if (details.tabId != null) {
            const prev = _tabStates.get(details.tabId) ?? {};
            _tabStates.set(details.tabId, { ...prev, text: details.text });
        } else {
            _state.text = details.text;
        }
        return resolved(undefined, cb);
    }

    function getBadgeText(
        details: { tabId?: number },
        cb?: (result: string) => void,
    ) {
        return resolved(_getState(details.tabId).text, cb);
    }

    function setBadgeBackgroundColor(
        details: {
            color: string | [number, number, number, number];
            tabId?: number;
        },
        cb?: () => void,
    ) {
        const color = Array.isArray(details.color)
            ? `rgba(${details.color.join(",")})`
            : details.color;
        if (details.tabId != null) {
            const prev = _tabStates.get(details.tabId) ?? {};
            _tabStates.set(details.tabId, { ...prev, backgroundColor: color });
        } else {
            _state.backgroundColor = color;
        }
        return resolved(undefined, cb);
    }

    function getBadgeBackgroundColor(
        details: { tabId?: number },
        cb?: (result: string) => void,
    ) {
        return resolved(_getState(details.tabId).backgroundColor, cb);
    }

    function setBadgeTextColor(
        _details: { color: string; tabId?: number },
        cb?: () => void,
    ) {
        return resolved(undefined, cb);
    }

    function getBadgeTextColor(
        details: { tabId?: number },
        cb?: (result: string) => void,
    ) {
        return resolved(_getState(details.tabId).color, cb);
    }

    function setTitle(
        details: { title: string; tabId?: number },
        cb?: () => void,
    ) {
        if (details.tabId != null) {
            const prev = _tabStates.get(details.tabId) ?? {};
            _tabStates.set(details.tabId, { ...prev, title: details.title });
        } else {
            _state.title = details.title;
        }
        return resolved(undefined, cb);
    }

    function getTitle(
        details: { tabId?: number },
        cb?: (result: string) => void,
    ) {
        return resolved(_getState(details.tabId).title, cb);
    }

    function setPopup(
        details: { popup: string; tabId?: number },
        cb?: () => void,
    ) {
        if (details.tabId != null) {
            const prev = _tabStates.get(details.tabId) ?? {};
            _tabStates.set(details.tabId, { ...prev, popup: details.popup });
        } else {
            _state.popup = details.popup;
        }
        return resolved(undefined, cb);
    }

    function getPopup(
        details: { tabId?: number },
        cb?: (result: string) => void,
    ) {
        return resolved(_getState(details.tabId).popup, cb);
    }

    function enable(tabId?: number, cb?: () => void) {
        if (tabId != null) {
            const prev = _tabStates.get(tabId) ?? {};
            _tabStates.set(tabId, { ...prev, enabled: true });
        } else {
            _state.enabled = true;
        }
        return resolved(undefined, cb);
    }

    function disable(tabId?: number, cb?: () => void) {
        if (tabId != null) {
            const prev = _tabStates.get(tabId) ?? {};
            _tabStates.set(tabId, { ...prev, enabled: false });
        } else {
            _state.enabled = false;
        }
        return resolved(undefined, cb);
    }

    function isEnabled(tabId?: number, cb?: (isEnabled: boolean) => void) {
        return resolved(_getState(tabId).enabled, cb);
    }

    function openPopup(_options?: { windowId?: number }, cb?: () => void) {
        return resolved(undefined, cb);
    }

    function getUserSettings(
        cb?: (settings: { isOnToolbar: boolean }) => void,
    ) {
        return resolved({ isOnToolbar: true }, cb);
    }

    const api = {
        setIcon,
        setBadgeText,
        getBadgeText,
        setBadgeBackgroundColor,
        getBadgeBackgroundColor,
        setBadgeTextColor,
        getBadgeTextColor,
        setTitle,
        getTitle,
        setPopup,
        getPopup,
        enable,
        disable,
        isEnabled,
        openPopup,
        getUserSettings,
        onClicked,
        onUserSettingsChanged,
    };

    return api;
}

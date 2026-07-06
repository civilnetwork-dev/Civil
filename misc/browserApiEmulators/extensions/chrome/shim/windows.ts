import { CivilEvent } from "./event";
import { dispatchBrowserEvent, getBiB, resolved } from "./util";

function makeWindow(): chrome.windows.Window {
    const bib = getBiB();
    const syn = bib.currentWindow;
    return {
        id: syn.id ?? 1,
        focused: true,
        alwaysOnTop: false,
        incognito: syn.incognito ?? bib.incognito,
        state: syn.state ?? "normal",
        type: syn.type ?? "normal",
        top: syn.top ?? 0,
        left: syn.left ?? 0,
        width:
            syn.width ??
            (typeof window !== "undefined" ? window.outerWidth : 1280),
        height:
            syn.height ??
            (typeof window !== "undefined" ? window.outerHeight : 800),
        tabs: [],
        sessionId: undefined,
    };
}

export function buildWindowsAPI() {
    const onFocusChanged = new CivilEvent<(windowId: number) => void>();
    const onCreated = new CivilEvent<(win: chrome.windows.Window) => void>();
    const onRemoved = new CivilEvent<(windowId: number) => void>();
    const onBoundsChanged = new CivilEvent<
        (win: chrome.windows.Window) => void
    >();

    const _cb = <T>(qOrCb?: unknown, cb?: (r: T) => void) =>
        typeof qOrCb === "function" ? (qOrCb as (r: T) => void) : cb;

    return {
        get: (
            _id: number,
            qOrCb?: unknown,
            cb?: (w: chrome.windows.Window) => void,
        ) => resolved(makeWindow(), _cb(qOrCb, cb)),
        getCurrent: (
            qOrCb?: unknown,
            cb?: (w: chrome.windows.Window) => void,
        ) => resolved(makeWindow(), _cb(qOrCb, cb)),
        getLastFocused: (
            qOrCb?: unknown,
            cb?: (w: chrome.windows.Window) => void,
        ) => resolved(makeWindow(), _cb(qOrCb, cb)),
        getAll: (qOrCb?: unknown, cb?: (ws: chrome.windows.Window[]) => void) =>
            resolved([makeWindow()], _cb(qOrCb, cb)),
        create(
            props?: chrome.windows.CreateData,
            cb?: (w?: chrome.windows.Window) => void,
        ): Promise<chrome.windows.Window | undefined> {
            const bib = getBiB();
            if (props?.url) {
                const url = Array.isArray(props.url) ? props.url[0] : props.url;
                if (url) dispatchBrowserEvent(bib.newTabEvent, { url });
            }
            return resolved(makeWindow(), cb);
        },
        update: (
            _id: number,
            _info: chrome.windows.UpdateInfo,
            cb?: (w: chrome.windows.Window) => void,
        ) => resolved(makeWindow(), cb),
        remove: (_id: number, cb?: () => void) => resolved(undefined, cb),

        onFocusChanged,
        onCreated,
        onRemoved,
        onBoundsChanged,
        WINDOW_ID_NONE: -1,
        WINDOW_ID_CURRENT: -2,
    };
}

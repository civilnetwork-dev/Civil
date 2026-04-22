// biome-ignore-all lint: chrome apis

import type {
    CivilTabCreateProperties,
    CivilTabQueryInfo,
    CivilTabUpdateProperties,
} from "~/types";
import {
    civilStorage,
    idbDelete,
    idbGet,
    idbGetAll,
    idbPut,
    openCivilDB,
} from "./storage";
import {
    tabsActivate,
    tabsCreate,
    tabsGet,
    tabsGetActive,
    tabsGetAll,
    tabsOnActivated,
    tabsOnCreated,
    tabsOnRemoved,
    tabsOnUpdated,
    tabsQuery,
    tabsRemove,
    tabsUpdate,
} from "./tabs";

const _listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

function addListener(event: string, cb: (...args: unknown[]) => void): void {
    if (!_listeners.has(event)) _listeners.set(event, new Set());
    _listeners.get(event)!.add(cb);
}

function removeListener(event: string, cb: (...args: unknown[]) => void): void {
    _listeners.get(event)?.delete(cb);
}

function emit(event: string, ...args: unknown[]): void {
    _listeners.get(event)?.forEach(cb => cb(...args));
}

const _storageLocalListeners: Set<
    (
        changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    ) => void
> = new Set();

const storageLocalProxy = new Proxy(civilStorage, {
    set(target, prop, value) {
        const oldValue = target.getItem(prop as string);
        target.setItem(
            prop as string,
            typeof value === "string" ? value : JSON.stringify(value),
        );
        const changes: Record<
            string,
            { oldValue?: unknown; newValue?: unknown }
        > = {};
        changes[prop as string] = {
            oldValue: oldValue ? JSON.parse(oldValue) : undefined,
            newValue: value,
        };
        _storageLocalListeners.forEach(cb => cb(changes));
        return true;
    },
});

let _idbRef: IDBDatabase | null = null;
async function getIDB(): Promise<IDBDatabase> {
    if (!_idbRef) _idbRef = await openCivilDB("civil-extension-db", "kv");
    return _idbRef;
}

export const chromeRuntime = {
    id: "civil-extension-runtime",
    getManifest: () => ({}),
    getURL: (path: string) => path,
    sendMessage: (message: unknown, callback?: (response: unknown) => void) => {
        emit("runtime.onMessage", message, {}, callback ?? (() => {}));
    },
    onMessage: {
        addListener: (
            cb: (msg: unknown, sender: unknown, sendResponse: unknown) => void,
        ) =>
            addListener(
                "runtime.onMessage",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("runtime.onMessage", cb),
        hasListener: (cb: (...args: unknown[]) => void) =>
            _listeners.get("runtime.onMessage")?.has(cb) ?? false,
    },
    onInstalled: {
        addListener: (cb: (details: { reason: string }) => void) =>
            addListener(
                "runtime.onInstalled",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("runtime.onInstalled", cb),
    },
    onStartup: {
        addListener: (cb: () => void) =>
            addListener(
                "runtime.onStartup",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("runtime.onStartup", cb),
    },
    lastError: null as null | { message: string },
    connect: (_connectInfo?: { name?: string }) => ({
        postMessage: (msg: unknown) => emit("runtime.onConnect.message", msg),
        onMessage: {
            addListener: (cb: (msg: unknown) => void) =>
                addListener(
                    "runtime.onConnect.message",
                    cb as (...args: unknown[]) => void,
                ),
        },
        disconnect: () => {},
    }),
};

export const chromeTabs = {
    get: (_windowId: unknown, tabId: string) => tabsGet(tabId),
    query: (_windowId: unknown, query: CivilTabQueryInfo) => tabsQuery(query),
    create: (_windowId: unknown, props: CivilTabCreateProperties) =>
        tabsCreate(props),
    update: (tabId: string, props: CivilTabUpdateProperties) =>
        tabsUpdate(tabId, props),
    remove: (tabId: string) => tabsRemove(tabId),
    getActive: () => tabsGetActive(),
    getAll: () => tabsGetAll(),
    activate: (tabId: string) => tabsActivate(tabId),
    onCreated: {
        addListener: (cb: Parameters<typeof tabsOnCreated>[0]) =>
            tabsOnCreated(cb),
    },
    onRemoved: {
        addListener: (cb: Parameters<typeof tabsOnRemoved>[0]) =>
            tabsOnRemoved(cb),
    },
    onUpdated: {
        addListener: (cb: Parameters<typeof tabsOnUpdated>[0]) =>
            tabsOnUpdated(cb),
    },
    onActivated: {
        addListener: (cb: Parameters<typeof tabsOnActivated>[0]) =>
            tabsOnActivated(cb),
    },
    sendMessage: (_tabId: string, message: unknown) =>
        emit("tabs.onMessage", message),
    onMessage: {
        addListener: (cb: (msg: unknown) => void) =>
            addListener("tabs.onMessage", cb as (...args: unknown[]) => void),
    },
    executeScript: (
        _tabId: string,
        details: { code?: string; file?: string },
    ) => {
        if (details.code) {
            try {
                (0, eval)(details.code);
            } catch {}
        }
        return Promise.resolve([]);
    },
    insertCSS: (_tabId: string, details: { code?: string }) => {
        if (details.code) {
            const style = document.createElement("style");
            style.textContent = details.code;
            document.head?.appendChild(style);
        }
        return Promise.resolve();
    },
    captureVisibleTab: () => Promise.resolve(""),
};

export const chromeStorageLocal = {
    get: async (keys: string | string[] | null) => {
        const db = await getIDB();
        if (keys === null)
            return idbGetAll<{ id: string; value: unknown }>(db, "kv").then(
                all => Object.fromEntries(all.map(v => [v.id, v.value])),
            );
        const ks = Array.isArray(keys) ? keys : [keys];
        const result: Record<string, unknown> = {};
        for (const k of ks) {
            const val = await idbGet<{ id: string; value: unknown }>(
                db,
                "kv",
                k,
            );
            if (val !== undefined) result[k] = val.value;
        }
        return result;
    },
    set: async (items: Record<string, unknown>) => {
        const db = await getIDB();
        for (const [k, v] of Object.entries(items)) {
            await idbPut(db, "kv", { id: k, value: v });
        }
    },
    remove: async (keys: string | string[]) => {
        const db = await getIDB();
        const ks = Array.isArray(keys) ? keys : [keys];
        for (const k of ks) await idbDelete(db, "kv", k);
    },
    clear: async () => {
        const db = await getIDB();
        const all = await idbGetAll<{ id: string }>(db, "kv");
        for (const item of all) await idbDelete(db, "kv", item.id);
    },
    onChanged: {
        addListener: (
            cb: (
                changes: Record<
                    string,
                    { oldValue?: unknown; newValue?: unknown }
                >,
            ) => void,
        ) => _storageLocalListeners.add(cb),
        removeListener: (
            cb: (
                changes: Record<
                    string,
                    { oldValue?: unknown; newValue?: unknown }
                >,
            ) => void,
        ) => _storageLocalListeners.delete(cb),
    },
};

export const chromeStorageSync = chromeStorageLocal;

export const chromeWindows = {
    getCurrent: () =>
        Promise.resolve({
            id: 0,
            focused: true,
            type: "normal",
            state: "normal",
        }),
    getAll: () =>
        Promise.resolve([
            { id: 0, focused: true, type: "normal", state: "normal" },
        ]),
    create: (props: { url?: string }) => {
        if (props.url) tabsCreate({ url: props.url });
        return Promise.resolve({ id: 0 });
    },
    remove: () => Promise.resolve(),
    update: () => Promise.resolve({ id: 0 }),
    onFocusChanged: {
        addListener: (cb: (id: number) => void) =>
            addListener(
                "windows.onFocusChanged",
                cb as (...args: unknown[]) => void,
            ),
    },
    onCreated: {
        addListener: (cb: (w: unknown) => void) =>
            addListener(
                "windows.onCreated",
                cb as (...args: unknown[]) => void,
            ),
    },
    onRemoved: {
        addListener: (cb: (id: number) => void) =>
            addListener(
                "windows.onRemoved",
                cb as (...args: unknown[]) => void,
            ),
    },
};

export const chromeContextMenus = {
    _items: new Map<string, unknown>(),
    create: (props: { id: string; title: string; contexts?: string[] }) => {
        chromeContextMenus._items.set(props.id, props);
        return props.id;
    },
    update: (id: string, props: unknown) => {
        chromeContextMenus._items.set(id, {
            ...(chromeContextMenus._items.get(id) as object),
            ...(props as object),
        });
    },
    remove: (id: string) => {
        chromeContextMenus._items.delete(id);
    },
    removeAll: () => {
        chromeContextMenus._items.clear();
    },
    onClicked: {
        addListener: (cb: (info: unknown, tab: unknown) => void) =>
            addListener(
                "contextMenus.onClicked",
                cb as (...args: unknown[]) => void,
            ),
    },
};

export const chromeI18n = {
    getMessage: (key: string) => key,
    getUILanguage: () => navigator.language,
    detectLanguage: (text: string) =>
        Promise.resolve({
            isReliable: false,
            languages: [{ language: "en", percentage: 100 }],
            text,
        }),
};

export const chromePermissions = {
    _granted: new Set<string>(),
    contains: (perms: { permissions?: string[]; origins?: string[] }) =>
        Promise.resolve(
            (perms.permissions ?? []).every(p =>
                chromePermissions._granted.has(p),
            ),
        ),
    request: (perms: { permissions?: string[]; origins?: string[] }) => {
        (perms.permissions ?? []).forEach(p =>
            chromePermissions._granted.add(p),
        );
        return Promise.resolve(true);
    },
    remove: (perms: { permissions?: string[] }) => {
        (perms.permissions ?? []).forEach(p =>
            chromePermissions._granted.delete(p),
        );
        return Promise.resolve(true);
    },
    getAll: () =>
        Promise.resolve({
            permissions: Array.from(chromePermissions._granted),
            origins: [],
        }),
};

export const chromeNotifications = {
    create: (
        id: string,
        options: { title: string; message: string; iconUrl?: string },
    ) => {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(options.title, {
                body: options.message,
                icon: options.iconUrl,
            });
        }
        return Promise.resolve(id);
    },
    clear: (id: string) => Promise.resolve(!!id),
    getAll: () => Promise.resolve({}),
    onClicked: {
        addListener: (cb: (id: string) => void) =>
            addListener(
                "notifications.onClicked",
                cb as (...args: unknown[]) => void,
            ),
    },
    onClosed: {
        addListener: (cb: (id: string) => void) =>
            addListener(
                "notifications.onClosed",
                cb as (...args: unknown[]) => void,
            ),
    },
};

export const chromeCookies = {
    _store: new Map<string, unknown>(),
    get: (_details: { url: string; name: string }) => Promise.resolve(null),
    set: (details: { url: string; name: string; value: string }) => {
        document.cookie = `${details.name}=${details.value}`;
        return Promise.resolve(details);
    },
    remove: (details: { url: string; name: string }) => {
        document.cookie = `${details.name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
        return Promise.resolve(details);
    },
    getAll: () => Promise.resolve([]),
    onChanged: {
        addListener: (cb: (changeInfo: unknown) => void) =>
            addListener(
                "cookies.onChanged",
                cb as (...args: unknown[]) => void,
            ),
    },
};

export const chromeHistory = {
    search: (_query: { text: string }) => Promise.resolve([]),
    addUrl: (_details: { url: string }) => Promise.resolve(),
    deleteUrl: (_details: { url: string }) => Promise.resolve(),
    deleteAll: () => Promise.resolve(),
    onVisited: {
        addListener: (cb: (result: unknown) => void) =>
            addListener(
                "history.onVisited",
                cb as (...args: unknown[]) => void,
            ),
    },
    onVisitRemoved: {
        addListener: (cb: (removed: unknown) => void) =>
            addListener(
                "history.onVisitRemoved",
                cb as (...args: unknown[]) => void,
            ),
    },
};

export const chromeBookmarks = {
    _tree: [] as unknown[],
    get: (_idOrIds: string | string[]) => Promise.resolve([]),
    getTree: () => Promise.resolve(chromeBookmarks._tree),
    create: (bookmark: { title: string; url?: string; parentId?: string }) => {
        const node = {
            ...bookmark,
            id: crypto.randomUUID(),
            dateAdded: Date.now(),
            children: [],
        };
        chromeBookmarks._tree.push(node);
        return Promise.resolve(node);
    },
    update: () => Promise.resolve({}),
    remove: () => Promise.resolve(),
    search: () => Promise.resolve([]),
    onCreated: {
        addListener: (cb: (id: string, bookmark: unknown) => void) =>
            addListener(
                "bookmarks.onCreated",
                cb as (...args: unknown[]) => void,
            ),
    },
    onRemoved: {
        addListener: (cb: (id: string) => void) =>
            addListener(
                "bookmarks.onRemoved",
                cb as (...args: unknown[]) => void,
            ),
    },
};

export const chromeWebNavigation = {
    onCompleted: {
        addListener: (cb: (details: unknown) => void) =>
            addListener(
                "webNavigation.onCompleted",
                cb as (...args: unknown[]) => void,
            ),
    },
    onBeforeNavigate: {
        addListener: (cb: (details: unknown) => void) =>
            addListener(
                "webNavigation.onBeforeNavigate",
                cb as (...args: unknown[]) => void,
            ),
    },
    onCommitted: {
        addListener: (cb: (details: unknown) => void) =>
            addListener(
                "webNavigation.onCommitted",
                cb as (...args: unknown[]) => void,
            ),
    },
    onCreatedNavigationTarget: {
        addListener: (cb: (details: unknown) => void) =>
            addListener(
                "webNavigation.onCreatedNavigationTarget",
                cb as (...args: unknown[]) => void,
            ),
    },
    onErrorOccurred: {
        addListener: (cb: (details: unknown) => void) =>
            addListener(
                "webNavigation.onErrorOccurred",
                cb as (...args: unknown[]) => void,
            ),
    },
    getFrame: () => Promise.resolve(null),
    getAllFrames: () => Promise.resolve([]),
};

export const chromeWebRequest = {
    onBeforeRequest: {
        addListener: (
            cb: (details: unknown) => boolean | void,
            filter: unknown,
            _extraInfo?: string[],
        ) =>
            addListener(
                "webRequest.onBeforeRequest",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("webRequest.onBeforeRequest", cb),
    },
    onBeforeSendHeaders: {
        addListener: (
            cb: (details: unknown) => void,
            filter: unknown,
            _extraInfo?: string[],
        ) =>
            addListener(
                "webRequest.onBeforeSendHeaders",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("webRequest.onBeforeSendHeaders", cb),
    },
    onCompleted: {
        addListener: (cb: (details: unknown) => void, filter: unknown) =>
            addListener(
                "webRequest.onCompleted",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("webRequest.onCompleted", cb),
    },
    onErrorOccurred: {
        addListener: (cb: (details: unknown) => void, filter: unknown) =>
            addListener(
                "webRequest.onErrorOccurred",
                cb as (...args: unknown[]) => void,
            ),
        removeListener: (cb: (...args: unknown[]) => void) =>
            removeListener("webRequest.onErrorOccurred", cb),
    },
};

export function emitChromeEvent(event: string, ...args: unknown[]): void {
    emit(event, ...args);
}

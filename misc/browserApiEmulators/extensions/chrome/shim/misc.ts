import type { DNRRule } from "../types";
import { CivilEvent, makeNoopEvent } from "./event";
import {
    buildWebRequestEventSet,
    installNetworkInterceptor,
} from "./networkIntercept";
import { getBiB, resolved } from "./util";

interface MessageEntry {
    message: string;
    placeholders?: Record<string, { content: string }>;
}

// Chrome's predefined messages
const PREDEFINED_MESSAGES: Record<string, string> = {
    "@@ui_locale":
        (typeof navigator !== "undefined" && navigator.language) || "en",
    "@@bidi_dir": "ltr",
    "@@bidi_reversed_dir": "rtl",
    "@@bidi_start_edge": "left",
    "@@bidi_end_edge": "right",
};

/** `entry` with its named placeholders and then $1..$n filled in. */
function formatMessage(
    entry: MessageEntry,
    substitutions?: string | string[],
): string {
    let msg = entry.message;
    const subs = Array.isArray(substitutions)
        ? substitutions
        : substitutions != null
          ? [substitutions]
          : [];
    if (entry.placeholders) {
        for (const [name, { content }] of Object.entries(entry.placeholders)) {
            msg = msg.replace(new RegExp(`\\$${name}\\$`, "gi"), content);
        }
    }
    subs.forEach((s, i) => {
        msg = msg.replace(new RegExp(`\\$${i + 1}`, "g"), s);
    });
    return msg;
}

function detectLanguage(
    _text: string,
    cb?: (result: {
        isReliable: boolean;
        languages: { language: string; percentage: number }[];
    }) => void,
) {
    let lang = "en";
    try {
        if (typeof navigator !== "undefined" && navigator.language) {
            lang = navigator.language.split("-")[0] ?? "en";
        }
    } catch {}
    return resolved(
        { isReliable: false, languages: [{ language: lang, percentage: 100 }] },
        cb,
    );
}

export function buildI18nAPI() {
    const extra: Record<string, MessageEntry> = {};

    function getMessage(
        messageName: string,
        substitutions?: string | string[],
    ): string {
        if (messageName in PREDEFINED_MESSAGES)
            return PREDEFINED_MESSAGES[messageName]!;
        const entry = { ...getBiB().messages, ...extra }[messageName];
        return entry ? formatMessage(entry, substitutions) : "";
    }

    return {
        getMessage,
        getUILanguage: (): string =>
            (typeof navigator !== "undefined" && navigator.language) || "en",
        detectLanguage,
        getAcceptLanguages: (cb?: (languages: string[]) => void) =>
            resolved(
                typeof navigator !== "undefined" && navigator.languages
                    ? [...navigator.languages]
                    : ["en"],
                cb,
            ),
        _seed: (messages: Record<string, MessageEntry>): void => {
            Object.assign(extra, messages);
        },
    };
}

const WEB_PERMISSIONS: Record<string, PermissionName> = {
    geolocation: "geolocation",
    notifications: "notifications",
    microphone: "microphone",
    camera: "camera",
    midi: "midi",
    "midi-sysex": "midi" as PermissionName,
    clipboard: "clipboard-read" as PermissionName,
    "clipboard-read": "clipboard-read" as PermissionName,
    "clipboard-write": "clipboard-write" as PermissionName,
};

/** Whether every permission is granted here and not denied by the browser. */
async function permissionsHeld(
    granted: Set<string>,
    chromePerms: string[],
): Promise<boolean> {
    const nonMapped = chromePerms.filter(
        name => !WEB_PERMISSIONS[name] && !granted.has(name),
    );
    if (nonMapped.length > 0) return false;

    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
        for (const name of chromePerms) {
            const webName = WEB_PERMISSIONS[name];
            if (!webName) continue;
            try {
                const status = await navigator.permissions.query({
                    name: webName,
                });
                if (status.state === "denied") return false;
            } catch {}
        }
    }
    return true;
}

async function stopAfterGrant(constraints: MediaStreamConstraints) {
    const s = await navigator.mediaDevices.getUserMedia(constraints);
    s.getTracks().forEach(t => {
        t.stop();
    });
}

/** Asks the browser for the web permission behind one chrome permission.
 *  Returns false only when the browser says no outright. */
async function requestWebPermission(webName: PermissionName): Promise<boolean> {
    if (webName === "geolocation") {
        await new Promise<void>((res, rej) => {
            navigator.geolocation.getCurrentPosition(
                () => res(),
                e => (e.code === e.PERMISSION_DENIED ? rej(e) : res()),
                { timeout: 0 },
            );
        });
    } else if (webName === ("notifications" as PermissionName)) {
        const r = await Notification.requestPermission();
        if (r === "denied") return false;
    } else if (webName === ("microphone" as PermissionName)) {
        await stopAfterGrant({ audio: true });
    } else if (webName === ("camera" as PermissionName)) {
        await stopAfterGrant({ video: true });
    }
    return true;
}

async function requestPermissions(
    granted: Set<string>,
    chromePerms: string[],
): Promise<boolean> {
    let allGranted = true;
    for (const perm of chromePerms) {
        granted.add(perm);
        const webName = WEB_PERMISSIONS[perm];
        if (!webName) continue;
        try {
            if (!(await requestWebPermission(webName))) allGranted = false;
        } catch {}
    }
    return allGranted;
}

type Permissions = chrome.permissions.Permissions;

export function buildPermissionsAPI() {
    const granted = new Set<string>(["<all_urls>", "storage", "tabs"]);
    const onAdded = new CivilEvent<(permissions: Permissions) => void>();
    const onRemoved = new CivilEvent<(permissions: Permissions) => void>();

    return {
        contains(perms: Permissions, cb?: (result: boolean) => void) {
            const p = permissionsHeld(granted, perms.permissions ?? []);
            if (cb) p.then(cb).catch(() => cb(false));
            return p;
        },
        request(perms: Permissions, cb?: (granted: boolean) => void) {
            const p = requestPermissions(granted, perms.permissions ?? []).then(
                allGranted => {
                    onAdded.dispatch(perms);
                    return allGranted;
                },
            );
            if (cb) p.then(cb).catch(() => cb(false));
            return p;
        },
        remove(perms: Permissions, cb?: (removed: boolean) => void) {
            (perms.permissions ?? []).forEach(p => {
                granted.delete(p);
            });
            onRemoved.dispatch(perms);
            return resolved(true, cb);
        },
        getAll(cb?: (permissions: Permissions) => void) {
            return resolved(
                {
                    permissions: [
                        ...granted,
                    ] as unknown as Permissions["permissions"],
                    origins: ["<all_urls>"],
                },
                cb,
            );
        },
        onAdded,
        onRemoved,
    };
}

type MenuItem = Record<string, unknown>;
type MenuClick = chrome.contextMenus.OnClickData;

/** The click data for `item` when its contexts cover what was clicked. */
function menuClickFor(
    item: MenuItem,
    target: HTMLElement | null,
): MenuClick | null {
    const contexts = (item.contexts as string[] | undefined) ?? ["page"];
    const isText =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
    const isImage = target instanceof HTMLImageElement;
    const isLink = target instanceof HTMLAnchorElement;
    const matches =
        contexts.includes("all") ||
        contexts.includes("page") ||
        (contexts.includes("editable") && isText) ||
        (contexts.includes("image") && isImage) ||
        (contexts.includes("link") && isLink) ||
        (contexts.includes("selection") &&
            (window.getSelection()?.toString().length ?? 0) > 0);
    if (!matches) return null;
    return {
        menuItemId: item.id as string | number,
        editable: isText,
        pageUrl: window.location.href,
        selectionText: window.getSelection()?.toString() || undefined,
        srcUrl: isImage ? (target as HTMLImageElement).src : undefined,
        linkUrl: isLink ? (target as HTMLAnchorElement).href : undefined,
    };
}

export function buildContextMenusAPI() {
    const items = new Map<string | number, MenuItem>();
    let idCounter = 1;
    const onClicked = new CivilEvent<
        (info: MenuClick, tab?: chrome.tabs.Tab) => void
    >();

    if (typeof document !== "undefined") {
        document.addEventListener("contextmenu", (e: MouseEvent) => {
            if (items.size === 0) return;
            const target = e.target as HTMLElement | null;
            for (const [, item] of items) {
                const info = menuClickFor(item, target);
                if (info) onClicked.dispatch(info);
            }
        });
    }

    return {
        create(
            props: chrome.contextMenus.CreateProperties,
            cb?: () => void,
        ): string | number {
            const id = (props.id as string | number | undefined) ?? idCounter++;
            items.set(id, { ...props, id });
            if (cb) cb();
            return id;
        },
        update(id: string | number, props: MenuItem, cb?: () => void) {
            items.set(id, { ...items.get(id), ...props });
            return resolved(undefined, cb);
        },
        remove(id: string | number, cb?: () => void) {
            items.delete(id);
            return resolved(undefined, cb);
        },
        removeAll(cb?: () => void) {
            items.clear();
            return resolved(undefined, cb);
        },
        onClicked,
        ACTION_MENU_TOP_LEVEL_LIMIT: 6,
    };
}

export function buildWebRequestAPI(
    getDNRRules: () => DNRRule[],
    proxyExternalRequests = false,
) {
    const events = buildWebRequestEventSet();
    installNetworkInterceptor(events, getDNRRules, proxyExternalRequests);
    return {
        ...events,
        MAX_HANDLER_BEHAVIOR_CHANGED_CALLS_PER_10_MINUTES: 20,
        handlerBehaviorChanged(cb?: () => void) {
            return resolved(undefined, cb);
        },
    };
}

type NotificationOptionsChrome = chrome.notifications.NotificationOptions;
type NotificationEntry = {
    options: NotificationOptionsChrome;
    notif?: Notification;
};

function notificationEvents() {
    return {
        onClicked: new CivilEvent<(id: string) => void>(),
        onClosed: new CivilEvent<(id: string, byUser: boolean) => void>(),
        onButtonClicked: new CivilEvent<
            (id: string, buttonIndex: number) => void
        >(),
        onPermissionLevelChanged: new CivilEvent<(level: string) => void>(),
        onShowSettings: new CivilEvent<() => void>(),
    };
}

type NotificationEvents = ReturnType<typeof notificationEvents>;

/**
 * Shows `options` as a real browser notification when the page may, and
 * returns the entry to remember either way.
 */
function showNotification(
    id: string,
    options: NotificationOptionsChrome,
    events: NotificationEvents,
    extra: Partial<NotificationOptions> = {},
): NotificationEntry {
    const opts = options as Record<string, unknown>;
    try {
        if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
        ) {
            const n = new Notification((opts?.title as string) ?? "", {
                body: (opts?.message as string) ?? "",
                icon: (opts?.iconUrl as string) ?? undefined,
                tag: id,
                ...extra,
            });
            n.onclick = () => events.onClicked.dispatch(id);
            n.onclose = () => events.onClosed.dispatch(id, true);
            return { options, notif: n };
        }
    } catch {}
    return { options };
}

function createNotification(
    store: Map<string, NotificationEntry>,
    events: NotificationEvents,
) {
    return (
        idOrOptions: string | NotificationOptionsChrome,
        optionsOrCb?: NotificationOptionsChrome | ((id: string) => void),
        maybeCb?: (id: string) => void,
    ) => {
        const id =
            typeof idOrOptions === "string" ? idOrOptions : crypto.randomUUID();
        const options =
            typeof idOrOptions === "object"
                ? idOrOptions
                : (optionsOrCb as NotificationOptionsChrome);
        const cb = typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
        const opts = options as Record<string, unknown>;
        store.set(
            id,
            showNotification(id, options, events, {
                requireInteraction:
                    (opts?.requireInteraction as boolean) ?? false,
            }),
        );
        return resolved(id, cb);
    };
}

function updateNotification(
    store: Map<string, NotificationEntry>,
    events: NotificationEvents,
) {
    return (
        id: string,
        options: NotificationOptionsChrome,
        cb?: (wasUpdated: boolean) => void,
    ) => {
        const entry = store.get(id);
        if (!entry) return resolved(false, cb);
        try {
            entry.notif?.close();
        } catch {}
        store.set(
            id,
            showNotification(id, { ...entry.options, ...options }, events),
        );
        return resolved(true, cb);
    };
}

export function buildNotificationsAPI() {
    const store = new Map<string, NotificationEntry>();
    const events = notificationEvents();

    if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
    ) {
        Notification.requestPermission()
            .then(p => events.onPermissionLevelChanged.dispatch(p))
            .catch(() => {});
    }

    return {
        create: createNotification(store, events),
        clear(id: string, cb?: (wasCleared: boolean) => void) {
            const entry = store.get(id);
            if (!entry) return resolved(false, cb);
            try {
                entry.notif?.close();
            } catch {}
            store.delete(id);
            events.onClosed.dispatch(id, false);
            return resolved(true, cb);
        },
        getAll(
            cb?: (
                notifications: Record<string, NotificationOptionsChrome>,
            ) => void,
        ) {
            const result: Record<string, NotificationOptionsChrome> = {};
            for (const [id, entry] of store) result[id] = entry.options;
            return resolved(result, cb);
        },
        getPermissionLevel(cb?: (level: string) => void) {
            const level =
                typeof Notification !== "undefined"
                    ? Notification.permission
                    : "denied";
            return resolved(level, cb);
        },
        update: updateNotification(store, events),
        ...events,
    };
}

async function clearIndexedDB(): Promise<void> {
    if (!("databases" in indexedDB)) return;
    const dbs = await (
        indexedDB as IDBFactory & {
            databases(): Promise<{ name?: string; version?: number }[]>;
        }
    ).databases();
    await Promise.all(
        dbs.map(
            db =>
                new Promise<void>((res, rej) => {
                    if (!db.name) return res();
                    const req = indexedDB.deleteDatabase(db.name);
                    req.onsuccess = () => res();
                    req.onerror = () => rej(req.error);
                }),
        ),
    );
}

async function clearCacheStorage(): Promise<void> {
    if (typeof caches !== "undefined" && typeof caches.keys === "function") {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
    }
}

function clearDocumentCookies(): void {
    for (const cookie of document.cookie.split(";")) {
        const name = cookie.split("=")[0]?.trim();
        if (name) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        }
    }
}

/** Clears each kind of storage asked for; a kind that fails is skipped. */
async function clearStorage(dataTypes: Record<string, boolean>): Promise<void> {
    const steps: [boolean | undefined, () => void | Promise<void>][] = [
        [
            dataTypes.localStorage || dataTypes.fileSystems,
            () => localStorage.clear(),
        ],
        [dataTypes.sessionStorage, () => sessionStorage.clear()],
        [dataTypes.indexedDB, clearIndexedDB],
        [dataTypes.cacheStorage || dataTypes.appcache, clearCacheStorage],
        [dataTypes.cookies, clearDocumentCookies],
    ];
    for (const [wanted, clear] of steps) {
        try {
            if (wanted) await clear();
        } catch {}
    }
}

function removeFn(dataTypes: Record<string, boolean>) {
    return (
        _options?: unknown,
        _dataTypesOverride?: unknown,
        cb?: () => void,
    ) => {
        const p = clearStorage(dataTypes).then(() => undefined);
        if (cb) p.then(cb).catch(() => cb());
        return p;
    };
}

async function removeServiceWorkers(_options?: unknown, cb?: () => void) {
    try {
        if (typeof navigator !== "undefined" && navigator.serviceWorker) {
            const registrations =
                await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(r => r.unregister()));
        }
    } catch {}
    if (cb) cb();
}

type BrowsingDataSettings = {
    options: chrome.browsingData.RemovalOptions;
    dataToRemove: chrome.browsingData.DataTypeSet;
};

export function buildBrowsingDataAPI() {
    return {
        remove: (
            _options: unknown,
            dataTypes: Record<string, boolean>,
            cb?: () => void,
        ) => removeFn(dataTypes ?? {})(undefined, undefined, cb),
        removeAppcache: removeFn({ appcache: true }),
        removeCache: removeFn({ cacheStorage: true }),
        removeCacheStorage: removeFn({ cacheStorage: true }),
        removeCookies: removeFn({ cookies: true }),
        removeDownloads: removeFn({}),
        removeFileSystems: removeFn({ fileSystems: true }),
        removeFormData: removeFn({}),
        removeHistory: removeFn({}),
        removeIndexedDB: removeFn({ indexedDB: true }),
        removeLocalStorage: removeFn({ localStorage: true }),
        removePasswords: removeFn({}),
        removePluginData: removeFn({}),
        removeServiceWorkers,
        removeWebSQL: removeFn({}),
        settings(cb?: (result: BrowsingDataSettings) => void) {
            return resolved(
                {
                    options: { since: 0 },
                    dataToRemove: {},
                    dataRemovalPermitted: {},
                } as unknown as BrowsingDataSettings,
                cb,
            );
        },
    };
}

export function buildManagementAPI() {
    const onEnabled = new CivilEvent<
        (info: chrome.management.ExtensionInfo) => void
    >();
    const onDisabled = new CivilEvent<
        (info: chrome.management.ExtensionInfo) => void
    >();
    const onInstalled = new CivilEvent<
        (info: chrome.management.ExtensionInfo) => void
    >();
    const onUninstalled = new CivilEvent<(id: string) => void>();
    return {
        getAll(cb?: (result: chrome.management.ExtensionInfo[]) => void) {
            return resolved([], cb);
        },
        get(
            _id: string,
            cb?: (result: chrome.management.ExtensionInfo) => void,
        ) {
            return resolved({} as chrome.management.ExtensionInfo, cb);
        },
        getSelf(cb?: (result: chrome.management.ExtensionInfo) => void) {
            return resolved({} as chrome.management.ExtensionInfo, cb);
        },
        setEnabled(_id: string, _enabled: boolean, cb?: () => void) {
            return resolved(undefined, cb);
        },
        uninstallSelf(
            _options?: { showConfirmDialog?: boolean },
            cb?: () => void,
        ) {
            return resolved(undefined, cb);
        },
        onEnabled,
        onDisabled,
        onInstalled,
        onUninstalled,
    };
}

const OFFSCREEN_ID = "__civil_offscreen__";

/** The offscreen page's HTML with the chrome shim injected into its head. */
async function offscreenSrcDoc(
    civilUrl: string,
    shimSrc: string,
    shimOpts: string,
): Promise<string> {
    const resp = await fetch(civilUrl);
    const html = await resp.text();
    // Escape </script inside the injected source to avoid
    // prematurely closing the script tag.
    const safeSrc = shimSrc.replace(/<\/script/gi, "</script");
    const shimInject = `<script>window.__CIVIL_SHIM_OPTIONS__=${shimOpts};${safeSrc}</script>`;
    if (/<head[^>]*>/i.test(html)) {
        return html.replace(
            /<head([^>]*)>/i,
            (_m, a: string) => `<head${a}>${shimInject}`,
        );
    }
    return shimInject + html;
}

/**
 * Loads the offscreen document into a hidden iframe. The chrome shim is
 * injected into it, so that chrome.runtime.id (and all other APIs) are
 * available there.
 */
async function createOffscreenFrame(
    url: string,
    extId: string,
    manifest: Record<string, unknown>,
): Promise<void> {
    document.getElementById(OFFSCREEN_ID)?.remove();
    const iframe = document.createElement("iframe");
    iframe.id = OFFSCREEN_ID;
    iframe.style.cssText =
        "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";

    const shimSrc = (window as unknown as Record<string, unknown>)
        .__CIVIL_SHIM_SRC__ as string | undefined;

    // chrome-extension:// URLs can't be fetched directly;
    // rewrite to Civil's /civil-ext/ origin-relative form.
    const bib = getBiB();
    const civilUrl = url.replace(
        /^chrome-extension:\/\/([^/]+)\//,
        `${bib.origin}/civil-ext/$1/`,
    );

    if (shimSrc) {
        const shimOpts = JSON.stringify({
            extId,
            manifest,
            contextType: "offscreen",
            bib,
        });
        try {
            iframe.srcdoc = await offscreenSrcDoc(civilUrl, shimSrc, shimOpts);
        } catch {
            // Fallback: load URL directly (shim absent)
            iframe.src = civilUrl;
        }
    } else {
        iframe.src = civilUrl;
    }

    // Wait for the iframe to finish loading before resolving
    // so TM can immediately sendMessage to the offscreen doc.
    await new Promise<void>(resolve => {
        iframe.addEventListener("load", () => resolve(), { once: true });
        // Fallback: give up after 5 s even if load never fires
        setTimeout(resolve, 5000);
        document.body?.appendChild(iframe);
    });
}

const OFFSCREEN_REASONS = Object.fromEntries(
    [
        "TESTING",
        "AUDIO_PLAYBACK",
        "IFRAME_SCRIPTING",
        "DOM_SCRAPING",
        "BLOBS",
        "DOM_PARSER",
        "USER_MEDIA",
        "DISPLAY_MEDIA",
        "WEB_RTC",
        "CLIPBOARD",
        "LOCAL_STORAGE",
        "WORKERS",
        "BATTERY_STATUS",
        "MATCH_MEDIA",
        "GEOLOCATION",
    ].map(reason => [reason, reason]),
);

export function buildOffscreenAPI(
    extId: string,
    manifest: Record<string, unknown>,
    _contextType: string,
) {
    return {
        async createDocument(
            params: { url: string; reasons: string[]; justification: string },
            cb?: () => void,
        ) {
            if (typeof document !== "undefined") {
                try {
                    await createOffscreenFrame(params.url, extId, manifest);
                } catch {}
            }
            if (cb) cb();
            return Promise.resolve(undefined);
        },
        closeDocument(cb?: () => void) {
            try {
                document.getElementById(OFFSCREEN_ID)?.remove();
            } catch {}
            return resolved(undefined, cb);
        },
        hasDocument(cb?: (result: boolean) => void) {
            return resolved(!!document.getElementById(OFFSCREEN_ID), cb);
        },
        Reason: OFFSCREEN_REASONS,
    };
}

export function buildSidePanelAPI() {
    return {
        open(
            _options?: { tabId?: number; windowId?: number },
            cb?: () => void,
        ) {
            return resolved(undefined, cb);
        },
        setOptions(
            _options: { tabId?: number; path?: string; enabled?: boolean },
            cb?: () => void,
        ) {
            return resolved(undefined, cb);
        },
        getOptions(
            _options: { tabId?: number },
            cb?: (options: { path?: string; enabled?: boolean }) => void,
        ) {
            return resolved({ enabled: false }, cb);
        },
        setPanelBehavior(
            _behavior: { openPanelOnActionClick?: boolean },
            cb?: () => void,
        ) {
            return resolved(undefined, cb);
        },
        getPanelBehavior(
            cb?: (behavior: { openPanelOnActionClick: boolean }) => void,
        ) {
            return resolved({ openPanelOnActionClick: false }, cb);
        },
    };
}

function makeChromeSetting() {
    const onChange =
        makeNoopEvent<
            (details: { value: unknown; levelOfControl: string }) => void
        >();
    return {
        get(
            _details: { incognito?: boolean },
            cb?: (details: { value: unknown; levelOfControl: string }) => void,
        ) {
            return resolved(
                { value: false, levelOfControl: "not_controllable" },
                cb,
            );
        },
        set(_details: { value: unknown; scope?: string }, cb?: () => void) {
            return resolved(undefined, cb);
        },
        clear(_details: { scope?: string }, cb?: () => void) {
            return resolved(undefined, cb);
        },
        onChange,
    };
}

export function buildPrivacyAPI() {
    const s = makeChromeSetting;
    return {
        network: {
            networkPredictionEnabled: s(),
            webRTCIPHandlingPolicy: s(),
            webRTCMultipleRoutesEnabled: s(),
            webRTCNonProxiedUdpEnabled: s(),
        },
        services: {
            alternateErrorPagesEnabled: s(),
            autofillAddressEnabled: s(),
            autofillCreditCardEnabled: s(),
            autofillEnabled: s(),
            hotwordSearchEnabled: s(),
            passwordSavingEnabled: s(),
            safeBrowsingEnabled: s(),
            safeBrowsingExtendedReportingEnabled: s(),
            searchSuggestEnabled: s(),
            spellingServiceEnabled: s(),
            translationServiceEnabled: s(),
        },
        websites: {
            adMeasurementEnabled: s(),
            fledgeEnabled: s(),
            hyperlinkAuditingEnabled: s(),
            interestCohortEnabled: s(),
            privacySandboxEnabled: s(),
            protectedContentEnabled: s(),
            referrersEnabled: s(),
            relatedWebsiteSetsEnabled: s(),
            thirdPartyCookiesAllowed: s(),
            topicsEnabled: s(),
        },
    };
}

export function buildProxyAPI() {
    return {
        settings: makeChromeSetting(),
        onProxyError:
            makeNoopEvent<
                (details: {
                    fatal: boolean;
                    error: string;
                    details: string;
                }) => void
            >(),
        onRequest: makeNoopEvent<(details: unknown) => void>(),
        Mode: {
            DIRECT: "direct",
            AUTO_DETECT: "auto_detect",
            PAC_SCRIPT: "pac_script",
            FIXED_SERVERS: "fixed_servers",
            SYSTEM: "system",
        },
    };
}

export function buildDnsAPI() {
    return {
        resolve(
            hostname: string,
            cb?: (resolveInfo: {
                resultCode: number;
                address?: string;
            }) => void,
        ) {
            const p = (async () => {
                try {
                    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`;
                    const resp = await fetch(url, {
                        headers: { accept: "application/dns-json" },
                    });
                    if (resp.ok) {
                        const json = (await resp.json()) as {
                            Answer?: { data: string }[];
                        };
                        const address = json.Answer?.find(a => a.data)?.data;
                        if (address) {
                            return { resultCode: 0, address };
                        }
                    }
                } catch {}
                return { resultCode: 0, address: "0.0.0.0" };
            })();
            if (cb) p.then(cb).catch(() => cb({ resultCode: -1 }));
            return p;
        },
    };
}

const _COOKIES_KEY = "civil-ext-cookies";

interface VirtualCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    secure: boolean;
    httpOnly: boolean;
    session: boolean;
    hostOnly: boolean;
    sameSite: string;
    storeId: string;
    expirationDate?: number;
}

function _loadVirtualCookies(): VirtualCookie[] {
    try {
        const raw = sessionStorage.getItem(_COOKIES_KEY);
        if (raw) return JSON.parse(raw) as VirtualCookie[];
    } catch {}
    return [];
}

function _saveVirtualCookies(cookies: VirtualCookie[]): void {
    try {
        sessionStorage.setItem(_COOKIES_KEY, JSON.stringify(cookies));
    } catch {}
}

function _parseDomCookies(): chrome.cookies.Cookie[] {
    try {
        return document.cookie.split(";").flatMap(pair => {
            const [name, ...rest] = pair.split("=");
            const n = name?.trim();
            if (!n) return [];
            return [
                {
                    name: n,
                    value: rest.join("=").trim(),
                    domain: window.location.hostname,
                    path: "/",
                    secure: window.location.protocol === "https:",
                    httpOnly: false,
                    session: true,
                    hostOnly: true,
                    sameSite: "no_restriction",
                    storeId: "0",
                    expirationDate: undefined,
                } as chrome.cookies.Cookie,
            ];
        });
    } catch {
        return [];
    }
}

/** The domain a cookies.set or cookies.remove call names: its `domain`, else
 *  its `url`'s host, else this page's host. */
function cookieDomain(d: { domain?: string; url?: string }): string {
    if (d.domain != null) return d.domain;
    if (!d.url) return window.location.hostname;
    try {
        return new URL(d.url).hostname;
    } catch {
        return window.location.hostname;
    }
}

type Cookie = chrome.cookies.Cookie;
type CookieChange = chrome.cookies.CookieChangeInfo;

type CookieSetDetails = {
    name: string;
    value?: string;
    expirationDate?: number;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: string;
    domain?: string;
    url?: string;
    storeId?: string;
};

type CookieFilter = {
    name?: string;
    url?: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    storeId?: string;
};

const SAME_SITE: Record<string, string> = {
    strict: "Strict",
    lax: "Lax",
    no_restriction: "None",
    unspecified: "Lax",
};

/** Mirrors a set cookie into document.cookie, for same-origin pages. */
function writeDocumentCookie(d: CookieSetDetails): void {
    try {
        let cookieStr = `${d.name}=${d.value ?? ""}`;
        if (d.expirationDate) {
            cookieStr += `;expires=${new Date(d.expirationDate * 1000).toUTCString()}`;
        }
        if (d.path) cookieStr += `;path=${d.path}`;
        if (d.secure) cookieStr += ";secure";
        if (d.sameSite && d.sameSite !== "no_restriction") {
            cookieStr += `;samesite=${SAME_SITE[d.sameSite] ?? "Lax"}`;
        }
        document.cookie = cookieStr;
    } catch {}
}

function toVirtualCookie(d: CookieSetDetails, domain: string): VirtualCookie {
    return {
        name: d.name,
        value: d.value ?? "",
        domain,
        path: d.path ?? "/",
        secure: d.secure ?? false,
        httpOnly: d.httpOnly ?? false,
        session: d.expirationDate == null,
        hostOnly: !d.domain?.startsWith("."),
        sameSite: d.sameSite ?? "no_restriction",
        storeId: d.storeId ?? "0",
        expirationDate: d.expirationDate,
    };
}

function inDomain(c: Cookie, domain: string): boolean {
    return c.domain === domain || (c.domain?.endsWith(`.${domain}`) ?? false);
}

/** The cookies set through this API, persisted for the session, merged with
 *  the page's own document.cookie. */
class CookieJar {
    readonly cookies = _loadVirtualCookies();

    /** Merge: virtual takes precedence by name+domain. */
    all(): Cookie[] {
        const result = this.cookies.map(v => v as unknown as Cookie);
        const seen = new Set(result.map(c => `${c.name}::${c.domain}`));
        for (const c of _parseDomCookies()) {
            if (!seen.has(`${c.name}::${c.domain}`)) result.push(c);
        }
        return result;
    }

    filter(d: CookieFilter | undefined): Cookie[] {
        let all = this.all();
        if (d?.name) all = all.filter(c => c.name === d.name);
        if (d?.domain) all = all.filter(c => inDomain(c, d.domain as string));
        if (d?.path) all = all.filter(c => c.path === d.path);
        if (d?.secure != null) all = all.filter(c => c.secure === d.secure);
        return all;
    }

    put(cookie: VirtualCookie): void {
        const idx = this.indexOf(cookie.name, cookie.domain);
        if (idx >= 0) this.cookies[idx] = cookie;
        else this.cookies.push(cookie);
        _saveVirtualCookies(this.cookies);
    }

    take(name: string, domain: string): VirtualCookie | undefined {
        const idx = this.indexOf(name, domain);
        if (idx < 0) return undefined;
        const [removed] = this.cookies.splice(idx, 1);
        _saveVirtualCookies(this.cookies);
        return removed;
    }

    private indexOf(name: string, domain: string): number {
        return this.cookies.findIndex(
            c => c.name === name && c.domain === domain,
        );
    }
}

function changeInfo(removed: boolean, cookie: VirtualCookie): CookieChange {
    return {
        removed,
        cookie: cookie as unknown as Cookie,
        cause: "explicit",
    } as unknown as CookieChange;
}

export function buildCookiesAPI() {
    const jar = new CookieJar();
    const onChanged = new CivilEvent<(changeInfo: CookieChange) => void>();

    return {
        get(details: Cookie, cb?: (cookie: Cookie | null) => void) {
            const d = details as unknown as { name: string; domain?: string };
            const found =
                jar
                    .all()
                    .find(
                        c =>
                            c.name === d.name &&
                            (d.domain == null || inDomain(c, d.domain)),
                    ) ?? null;
            return resolved(found, cb);
        },
        getAll(
            details: chrome.cookies.GetAllDetails,
            cb?: (cookies: Cookie[]) => void,
        ) {
            return resolved(jar.filter(details as CookieFilter), cb);
        },
        set(
            details: chrome.cookies.SetDetails,
            cb?: (cookie: Cookie | null) => void,
        ) {
            const d = details as unknown as CookieSetDetails;
            const virtual = toVirtualCookie(d, cookieDomain(d));
            jar.put(virtual);
            writeDocumentCookie(d);
            onChanged.dispatch(changeInfo(false, virtual));
            return resolved(virtual as unknown as Cookie, cb);
        },
        remove(
            details: chrome.cookies.SetDetails,
            cb?: (details: chrome.cookies.SetDetails) => void,
        ) {
            const d = details as unknown as CookieSetDetails;
            const removed = jar.take(d.name, cookieDomain(d));
            if (removed) onChanged.dispatch(changeInfo(true, removed));
            // Also clear via document.cookie
            try {
                document.cookie = `${d.name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
            } catch {}
            return resolved(details, cb);
        },
        getAllCookieStores(
            cb?: (cookieStores: chrome.cookies.CookieStore[]) => void,
        ) {
            return resolved(
                [{ id: "0", tabIds: [] }] as chrome.cookies.CookieStore[],
                cb,
            );
        },
        onChanged,
    };
}

const _HISTORY_KEY = "civil-ext-history";

function _loadHistory(): chrome.history.HistoryItem[] {
    try {
        const raw = localStorage.getItem(_HISTORY_KEY);
        if (raw) return JSON.parse(raw) as chrome.history.HistoryItem[];
    } catch {}
    return [];
}

function _saveHistory(items: chrome.history.HistoryItem[]): void {
    try {
        localStorage.setItem(_HISTORY_KEY, JSON.stringify(items));
    } catch {}
}

type HistoryItem = chrome.history.HistoryItem;
type HistoryQuery = {
    text?: string;
    startTime?: number;
    endTime?: number;
    maxResults?: number;
};

function matchesHistoryQuery(item: HistoryItem, q: HistoryQuery): boolean {
    const text = q.text?.toLowerCase();
    if (
        text &&
        !item.url?.toLowerCase().includes(text) &&
        !item.title?.toLowerCase().includes(text)
    )
        return false;
    if (q.startTime != null && (item.lastVisitTime ?? 0) < q.startTime)
        return false;
    if (q.endTime != null && (item.lastVisitTime ?? 0) > q.endTime)
        return false;
    return true;
}

/** The page's own visits, kept in localStorage. */
class HistoryStore {
    readonly items: HistoryItem[] = _loadHistory();
    private visitIdCounter = this.items.length;
    readonly onVisited = new CivilEvent<(result: HistoryItem) => void>();
    readonly onVisitRemoved = new CivilEvent<
        (removed: chrome.history.RemovedResult) => void
    >();

    add(url: string, title: string): void {
        this.items.push({
            id: String(++this.visitIdCounter),
            url,
            title,
            lastVisitTime: Date.now(),
            visitCount: 1,
            typedCount: 0,
        });
    }

    visit(url: string): void {
        const existing = this.items.find(i => i.url === url);
        if (existing) {
            ++this.visitIdCounter;
            existing.lastVisitTime = Date.now();
            existing.visitCount = (existing.visitCount ?? 0) + 1;
        } else {
            this.add(
                url,
                typeof document !== "undefined" ? document.title : url,
            );
        }
        _saveHistory(this.items);
        const item = this.items.find(i => i.url === url);
        if (item) this.onVisited.dispatch(item);
    }

    removed(urls: string[], allHistory = false): void {
        this.onVisitRemoved.dispatch({
            allHistory,
            urls,
        } as chrome.history.RemovedResult);
    }

    deleteRange(startTime: number, endTime: number): string[] {
        const removed: string[] = [];
        for (let i = this.items.length - 1; i >= 0; i--) {
            const t = this.items[i]?.lastVisitTime ?? 0;
            if (t >= startTime && t <= endTime) {
                removed.push(this.items[i]?.url ?? "");
                this.items.splice(i, 1);
            }
        }
        return removed;
    }
}

/** Records a visit whenever the page navigates through the History API. */
function trackPageVisits(store: HistoryStore): void {
    if (typeof window === "undefined") return;
    const pushState = history.pushState.bind(history);
    const replaceState = history.replaceState.bind(history);
    history.pushState = (...args: Parameters<typeof history.pushState>) => {
        pushState(...args);
        store.visit(window.location.href);
    };
    history.replaceState = (
        ...args: Parameters<typeof history.replaceState>
    ) => {
        replaceState(...args);
        store.visit(window.location.href);
    };
    window.addEventListener("popstate", () =>
        store.visit(window.location.href),
    );
}

function visitsOf(item: HistoryItem): chrome.history.VisitItem[] {
    return [
        {
            id: item.id,
            visitId: item.id,
            visitTime: item.lastVisitTime,
            referringVisitId: "0",
            transition: "link",
        } as chrome.history.VisitItem,
    ];
}

function historyEdits(store: HistoryStore) {
    return {
        addUrl(details: chrome.history.UrlDetails, cb?: () => void) {
            const d = details as unknown as { url: string; title?: string };
            if (d.url) {
                store.add(d.url, d.title ?? d.url);
                _saveHistory(store.items);
            }
            return resolved(undefined, cb);
        },
        deleteUrl(details: chrome.history.UrlDetails, cb?: () => void) {
            const d = details as unknown as { url: string };
            const idx = store.items.findIndex(i => i.url === d.url);
            if (idx >= 0) {
                store.items.splice(idx, 1);
                _saveHistory(store.items);
                store.removed([d.url]);
            }
            return resolved(undefined, cb);
        },
        deleteRange(range: chrome.history.Range, cb?: () => void) {
            const r = range as unknown as {
                startTime: number;
                endTime: number;
            };
            const removed = store.deleteRange(r.startTime, r.endTime);
            if (removed.length > 0) {
                _saveHistory(store.items);
                store.removed(removed);
            }
            return resolved(undefined, cb);
        },
        deleteAll(cb?: () => void) {
            store.items.length = 0;
            try {
                localStorage.removeItem(_HISTORY_KEY);
            } catch {}
            store.removed([], true);
            return resolved(undefined, cb);
        },
    };
}

export function buildHistoryAPI() {
    const store = new HistoryStore();
    trackPageVisits(store);

    return {
        search(
            query: chrome.history.HistoryQuery,
            cb?: (results: HistoryItem[]) => void,
        ) {
            const q = query as unknown as HistoryQuery;
            let results = store.items.filter(item =>
                matchesHistoryQuery(item, q),
            );
            if (q.maxResults != null) results = results.slice(0, q.maxResults);
            return resolved(results, cb);
        },
        getVisits(
            details: chrome.history.UrlDetails,
            cb?: (results: chrome.history.VisitItem[]) => void,
        ) {
            const d = details as unknown as { url: string };
            const item = store.items.find(i => i.url === d.url);
            return resolved(item ? visitsOf(item) : [], cb);
        },
        ...historyEdits(store),
        onVisited: store.onVisited,
        onVisitRemoved: store.onVisitRemoved,
    };
}

const _BOOKMARKS_KEY = "civil-ext-bookmarks";

function _loadBookmarks(): Map<string, chrome.bookmarks.BookmarkTreeNode> {
    const flat = new Map<string, chrome.bookmarks.BookmarkTreeNode>();
    try {
        const raw = localStorage.getItem(_BOOKMARKS_KEY);
        if (raw) {
            const arr = JSON.parse(raw) as chrome.bookmarks.BookmarkTreeNode[];
            for (const node of arr) flat.set(node.id, node);
        }
    } catch {}
    if (flat.size === 0) {
        // Seed default root folders
        const _mkNode = (
            props: Partial<chrome.bookmarks.BookmarkTreeNode>,
        ): chrome.bookmarks.BookmarkTreeNode =>
            props as chrome.bookmarks.BookmarkTreeNode;
        const root = _mkNode({
            id: "0",
            title: "",
            children: [
                "1",
                "2",
                "3",
            ] as unknown as chrome.bookmarks.BookmarkTreeNode[],
        });
        const bar = _mkNode({
            id: "1",
            parentId: "0",
            index: 0,
            title: "Bookmarks bar",
            children: [] as chrome.bookmarks.BookmarkTreeNode[],
        });
        const other = _mkNode({
            id: "2",
            parentId: "0",
            index: 1,
            title: "Other bookmarks",
            children: [] as chrome.bookmarks.BookmarkTreeNode[],
        });
        const mobile = _mkNode({
            id: "3",
            parentId: "0",
            index: 2,
            title: "Mobile bookmarks",
            children: [] as chrome.bookmarks.BookmarkTreeNode[],
        });
        flat.set("0", root);
        flat.set("1", bar);
        flat.set("2", other);
        flat.set("3", mobile);
    }
    return flat;
}

function _saveBookmarks(
    flat: Map<string, chrome.bookmarks.BookmarkTreeNode>,
): void {
    try {
        localStorage.setItem(
            _BOOKMARKS_KEY,
            JSON.stringify([...flat.values()]),
        );
    } catch {}
}

function _buildSubTree(
    id: string,
    flat: Map<string, chrome.bookmarks.BookmarkTreeNode>,
): chrome.bookmarks.BookmarkTreeNode | undefined {
    const node = flat.get(id);
    if (!node) return undefined;
    const childIds = (
        node.children as unknown as
            | string[]
            | chrome.bookmarks.BookmarkTreeNode[]
    )?.filter(c => typeof c === "string") as string[] | undefined;
    if (!childIds || childIds.length === 0) {
        return { ...node, children: node.url ? undefined : [] };
    }
    const children = childIds
        .map(cid => _buildSubTree(cid, flat))
        .filter((c): c is chrome.bookmarks.BookmarkTreeNode => c !== undefined);
    return { ...node, children };
}

type BookmarkNode = chrome.bookmarks.BookmarkTreeNode;
type BookmarksCallback = (results: BookmarkNode[]) => void;
type BookmarkQuery = { query?: string; url?: string; title?: string };

/** Stored nodes keep their children as ids; this reads them back. */
function childIdsOf(node: BookmarkNode | undefined): string[] {
    return (
        (node?.children as unknown as string[] | undefined)?.filter(
            c => typeof c === "string",
        ) ?? []
    );
}

function setChildIds(node: BookmarkNode, ids: string[]): void {
    (node as unknown as Record<string, unknown>).children = ids;
}

function matchesBookmarkQuery(node: BookmarkNode, q: BookmarkQuery): boolean {
    if (node.id === "0") return false;
    if (q.url && node.url !== q.url) return false;
    if (q.title && !node.title.toLowerCase().includes(q.title.toLowerCase()))
        return false;
    if (
        q.query &&
        !node.url?.toLowerCase().includes(q.query.toLowerCase()) &&
        !node.title.toLowerCase().includes(q.query.toLowerCase())
    )
        return false;
    return true;
}

function bookmarkEvents() {
    return {
        onCreated: new CivilEvent<
            (id: string, bookmark: BookmarkNode) => void
        >(),
        onRemoved: new CivilEvent<
            (
                id: string,
                removeInfo: {
                    parentId: string;
                    index: number;
                    node: BookmarkNode;
                },
            ) => void
        >(),
        onChanged: new CivilEvent<
            (id: string, changeInfo: { title: string; url?: string }) => void
        >(),
        onMoved: new CivilEvent<
            (
                id: string,
                moveInfo: {
                    parentId: string;
                    index: number;
                    oldParentId: string;
                    oldIndex: number;
                },
            ) => void
        >(),
        onChildrenReordered: new CivilEvent<
            (id: string, reorderInfo: { childIds: string[] }) => void
        >(),
        onImportBegan: new CivilEvent<() => void>(),
        onImportEnded: new CivilEvent<() => void>(),
    };
}

/** The bookmark tree, stored flat in localStorage. */
class BookmarkStore {
    readonly flat = _loadBookmarks();
    private idCounter = this.flat.size + 10;
    readonly events = bookmarkEvents();

    save(): void {
        _saveBookmarks(this.flat);
    }

    subtree(id: string): BookmarkNode | undefined {
        return _buildSubTree(id, this.flat);
    }

    create(bookmark: {
        parentId?: string;
        index?: number;
        title?: string;
        url?: string;
    }): BookmarkNode {
        const id = String(++this.idCounter);
        const parentId = bookmark.parentId ?? "1";
        const parent = this.flat.get(parentId);
        const siblings = childIdsOf(parent);
        const index = bookmark.index ?? siblings.length;
        const node = {
            id,
            parentId,
            index,
            title: bookmark.title ?? "",
            url: bookmark.url,
            dateAdded: Date.now(),
            children: bookmark.url ? undefined : ([] as BookmarkNode[]),
        } as BookmarkNode;
        this.flat.set(id, node);
        if (parent) {
            const newChildren = [...siblings];
            newChildren.splice(index, 0, id);
            setChildIds(parent, newChildren);
        }
        this.save();
        this.events.onCreated.dispatch(id, node);
        return node;
    }

    move(
        node: BookmarkNode,
        dest: { parentId?: string; index?: number },
    ): void {
        const oldParentId = node.parentId ?? "0";
        const oldParent = this.flat.get(oldParentId);
        if (!oldParent) return;
        const newParentId = dest.parentId ?? oldParentId;
        const newParent = this.flat.get(newParentId);

        const children = childIdsOf(oldParent);
        const oldIndex = children.indexOf(node.id);
        setChildIds(
            oldParent,
            children.filter(c => c !== node.id),
        );
        if (!newParent) return;
        const newSiblings = childIdsOf(newParent);
        newSiblings.splice(dest.index ?? newSiblings.length, 0, node.id);
        setChildIds(newParent, newSiblings);
        node.parentId = newParentId;
        node.index = dest.index ?? newSiblings.length - 1;
        this.save();
        this.events.onMoved.dispatch(node.id, {
            parentId: newParentId,
            index: node.index,
            oldParentId,
            oldIndex,
        });
    }

    remove(id: string, recursive: boolean): void {
        const node = this.flat.get(id);
        if (!recursive && !node) return;
        const parentId = node?.parentId ?? "0";
        const parent = this.flat.get(parentId);
        if (!recursive && !parent) return;
        const children = childIdsOf(parent);
        const index = children.indexOf(id);
        if (recursive) this.removeRecursive(id);
        else this.flat.delete(id);
        if (parent)
            setChildIds(
                parent,
                children.filter(c => c !== id),
            );
        this.save();
        if (node) this.events.onRemoved.dispatch(id, { parentId, index, node });
    }

    private removeRecursive(id: string): void {
        if (!this.flat.has(id)) return;
        for (const cid of childIdsOf(this.flat.get(id))) {
            this.removeRecursive(cid);
        }
        this.flat.delete(id);
    }
}

function bookmarkReads(store: BookmarkStore) {
    const present = (n: BookmarkNode | undefined): n is BookmarkNode =>
        n !== undefined;
    return {
        get(ids: string | string[], cb?: BookmarksCallback) {
            const idArr = Array.isArray(ids) ? ids : [ids];
            return resolved(
                idArr.map(id => store.subtree(id)).filter(present),
                cb,
            );
        },
        getChildren(id: string, cb?: BookmarksCallback) {
            const node = store.flat.get(id);
            if (!node) return resolved([], cb);
            const results = childIdsOf(node)
                .map(cid => store.flat.get(cid))
                .filter(present);
            return resolved(results, cb);
        },
        getRecent(n: number, cb?: BookmarksCallback) {
            const leaves = [...store.flat.values()]
                .filter(node => node.url)
                .toSorted((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0))
                .slice(0, n);
            return resolved(leaves, cb);
        },
        getTree(cb?: BookmarksCallback) {
            const root = store.subtree("0");
            return resolved(root ? [root] : [], cb);
        },
        getSubTree(id: string, cb?: BookmarksCallback) {
            const node = store.subtree(id);
            return resolved(node ? [node] : [], cb);
        },
        search(query: string | BookmarkQuery, cb?: BookmarksCallback) {
            const q = typeof query === "string" ? { query } : query;
            const results = [...store.flat.values()].filter(node =>
                matchesBookmarkQuery(node, q),
            );
            return resolved(results, cb);
        },
    };
}

function bookmarkWrites(store: BookmarkStore) {
    type NodeCallback = (result: BookmarkNode) => void;
    return {
        create(
            bookmark: {
                parentId?: string;
                index?: number;
                title?: string;
                url?: string;
            },
            cb?: NodeCallback,
        ) {
            return resolved(store.create(bookmark), cb);
        },
        move(
            id: string,
            dest: { parentId?: string; index?: number },
            cb?: NodeCallback,
        ) {
            const node = store.flat.get(id);
            if (!node) return resolved({} as BookmarkNode, cb);
            store.move(node, dest);
            return resolved(node, cb);
        },
        update(
            id: string,
            changes: { title?: string; url?: string },
            cb?: NodeCallback,
        ) {
            const node = store.flat.get(id);
            if (!node) return resolved({} as BookmarkNode, cb);
            if (changes.title != null) node.title = changes.title;
            if (changes.url != null) node.url = changes.url;
            store.save();
            store.events.onChanged.dispatch(id, {
                title: node.title,
                url: node.url,
            });
            return resolved(node, cb);
        },
        remove(id: string, cb?: () => void) {
            store.remove(id, false);
            return resolved(undefined, cb);
        },
        removeTree(id: string, cb?: () => void) {
            store.remove(id, true);
            return resolved(undefined, cb);
        },
    };
}

export function buildBookmarksAPI() {
    const store = new BookmarkStore();
    return {
        ...bookmarkReads(store),
        ...bookmarkWrites(store),
        ...store.events,
        MAX_WRITE_OPERATIONS_PER_HOUR: 1_000_000,
        MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1_000_000,
    };
}

type ManifestCommands = Record<
    string,
    {
        description?: string;
        suggested_key?: {
            default?: string;
            mac?: string;
            windows?: string;
            linux?: string;
            chromeos?: string;
        };
    }
>;

function normalizeKey(e: KeyboardEvent): string {
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    if (e.metaKey) parts.push("command");
    parts.push(e.key.toUpperCase());
    return parts.join("+");
}

function commandsOf(commands: ManifestCommands): chrome.commands.Command[] {
    return Object.entries(commands).map(([name, def]) => ({
        name,
        description: def.description ?? "",
        shortcut:
            def.suggested_key?.default ??
            def.suggested_key?.windows ??
            def.suggested_key?.linux ??
            "",
    }));
}

export function buildCommandsAPI(manifest?: { commands?: ManifestCommands }) {
    const onCommand = new CivilEvent<
        (command: string, tab?: chrome.tabs.Tab) => void
    >();
    const commands = commandsOf(manifest?.commands ?? {});

    const shortcuts = new Map<string, string>();
    for (const cmd of commands) {
        if (cmd.shortcut) {
            shortcuts.set(cmd.shortcut.toLowerCase(), cmd.name ?? "");
        }
    }

    if (typeof document !== "undefined" && shortcuts.size > 0) {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            const cmdName = shortcuts.get(normalizeKey(e));
            if (cmdName) {
                e.preventDefault();
                onCommand.dispatch(cmdName);
            }
        });
    }

    return {
        getAll(cb?: (commands: chrome.commands.Command[]) => void) {
            return resolved(commands, cb);
        },
        onCommand,
    };
}

type DownloadItem = chrome.downloads.DownloadItem;
type DownloadEntry = { item: DownloadItem; url: string };

function downloadEvents() {
    return {
        onCreated: new CivilEvent<(item: DownloadItem) => void>(),
        onChanged: new CivilEvent<
            (delta: chrome.downloads.DownloadDelta) => void
        >(),
        onErased: new CivilEvent<(id: number) => void>(),
        onDeterminingFilename: new CivilEvent<
            (
                item: DownloadItem,
                suggest: (
                    suggestion?: chrome.downloads.FilenameSuggestion,
                ) => void,
            ) => void
        >(),
    };
}

function newDownloadItem(id: number, url: string, filename?: string) {
    return {
        id,
        url,
        filename: filename ?? "",
        state: "in_progress",
        exists: true,
        paused: false,
        canResume: false,
        bytesReceived: 0,
        totalBytes: -1,
        fileSize: -1,
        danger: "safe",
        mime: "",
        startTime: new Date().toISOString(),
        incognito: false,
        referrer: window.location.href,
    } as unknown as DownloadItem;
}

/** Starts the browser's own download through a clicked link. */
function clickDownloadLink(url: string, filename?: string): void {
    const a = document.createElement("a");
    a.href = url;
    if (filename) a.download = filename;
    a.rel = "noopener noreferrer";
    a.style.display = "none";
    document.body?.appendChild(a);
    a.click();
    document.body?.removeChild(a);
}

/** Reports the download complete after a moment, as the browser gives no word. */
function markCompleteSoon(
    items: Map<number, DownloadEntry>,
    id: number,
    onChanged: ReturnType<typeof downloadEvents>["onChanged"],
): void {
    setTimeout(() => {
        const entry = items.get(id);
        if (!entry) return;
        const previous = entry.item.state;
        (entry.item as unknown as Record<string, unknown>).state = "complete";
        onChanged.dispatch({
            id,
            state: { previous, current: "complete" },
        } as chrome.downloads.DownloadDelta);
    }, 500);
}

function downloadControls() {
    const done = (cb?: () => void) => resolved(undefined, cb);
    return {
        pause: (_id: number, cb?: () => void) => done(cb),
        resume: (_id: number, cb?: () => void) => done(cb),
        cancel: (_id: number, cb?: () => void) => done(cb),
        getFileIcon: (
            _id: number,
            _opts?: chrome.downloads.GetFileIconOptions,
            cb?: (url: string) => void,
        ) => resolved("", cb),
        show(_id: number) {},
        showDefaultFolder() {},
        removeFile: (_id: number, cb?: () => void) => done(cb),
        acceptDanger: (_id: number, cb?: () => void) => done(cb),
        setUiOptions: (_opts: { enabled: boolean }, cb?: () => void) =>
            done(cb),
    };
}

function downloadQueries(
    items: Map<number, DownloadEntry>,
    events: ReturnType<typeof downloadEvents>,
) {
    return {
        search(
            query: chrome.downloads.DownloadQuery,
            cb?: (results: DownloadItem[]) => void,
        ) {
            const q = query as unknown as { id?: number; state?: string };
            let results = [...items.values()].map(e => e.item);
            if (q.id != null) results = results.filter(i => i.id === q.id);
            if (q.state)
                results = results.filter(
                    i =>
                        (i as unknown as Record<string, unknown>).state ===
                        q.state,
                );
            return resolved(results, cb);
        },
        open(id: number) {
            const entry = items.get(id);
            if (!entry) return;
            try {
                window.open(entry.url, "_blank", "noopener,noreferrer");
            } catch {}
        },
        erase(
            query: chrome.downloads.DownloadQuery,
            cb?: (ids: number[]) => void,
        ) {
            const { id } = query as unknown as { id?: number };
            const erased: number[] = [];
            if (id != null && items.has(id)) {
                items.delete(id);
                erased.push(id);
                events.onErased.dispatch(id);
            }
            return resolved(erased, cb);
        },
    };
}

export function buildDownloadsAPI() {
    const items = new Map<number, DownloadEntry>();
    let idCounter = 1;
    const events = downloadEvents();

    return {
        download(
            options: chrome.downloads.DownloadOptions,
            cb?: (id: number) => void,
        ) {
            const { url, filename } = options as unknown as {
                url: string;
                filename?: string;
            };
            const id = idCounter++;
            const item = newDownloadItem(id, url, filename);
            items.set(id, { item, url });
            events.onCreated.dispatch(item);
            try {
                clickDownloadLink(url, filename);
                markCompleteSoon(items, id, events.onChanged);
            } catch {}
            return resolved(id, cb);
        },
        ...downloadQueries(items, events),
        ...downloadControls(),
        ...events,
    };
}

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

export function buildI18nAPI() {
    const _extra: Record<string, MessageEntry> = {};

    // Chrome's predefined messages
    const _PREDEFINED: Record<string, string> = {
        "@@ui_locale":
            (typeof navigator !== "undefined" && navigator.language) || "en",
        "@@bidi_dir": "ltr",
        "@@bidi_reversed_dir": "rtl",
        "@@bidi_start_edge": "left",
        "@@bidi_end_edge": "right",
    };

    function getMessage(
        messageName: string,
        substitutions?: string | string[],
    ): string {
        if (messageName in _PREDEFINED) return _PREDEFINED[messageName]!;
        const _messages = { ...getBiB().messages, ..._extra };
        const entry = _messages[messageName];
        if (!entry) return "";
        let msg = entry.message;
        const subs = Array.isArray(substitutions)
            ? substitutions
            : substitutions != null
              ? [substitutions]
              : [];
        if (entry.placeholders) {
            for (const [name, { content }] of Object.entries(
                entry.placeholders,
            )) {
                msg = msg.replace(new RegExp(`\\$${name}\\$`, "gi"), content);
            }
        }
        subs.forEach((s, i) => {
            msg = msg.replace(new RegExp(`\\$${i + 1}`, "g"), s);
        });
        return msg;
    }

    function getUILanguage(): string {
        return (typeof navigator !== "undefined" && navigator.language) || "en";
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
            {
                isReliable: false,
                languages: [{ language: lang, percentage: 100 }],
            },
            cb,
        );
    }

    function getAcceptLanguages(cb?: (languages: string[]) => void) {
        return resolved(
            typeof navigator !== "undefined" && navigator.languages
                ? [...navigator.languages]
                : ["en"],
            cb,
        );
    }

    function _seed(messages: Record<string, MessageEntry>): void {
        Object.assign(_extra, messages);
    }

    return {
        getMessage,
        getUILanguage,
        detectLanguage,
        getAcceptLanguages,
        _seed,
    };
}

export function buildPermissionsAPI() {
    const _granted = new Set<string>(["<all_urls>", "storage", "tabs"]);
    const onAdded = new CivilEvent<
        (permissions: chrome.permissions.Permissions) => void
    >();
    const onRemoved = new CivilEvent<
        (permissions: chrome.permissions.Permissions) => void
    >();

    const _permMap: Record<string, PermissionName> = {
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

    return {
        contains(
            perms: chrome.permissions.Permissions,
            cb?: (result: boolean) => void,
        ) {
            const p = (async () => {
                const chromePerms = perms.permissions ?? [];

                const nonMapped = chromePerms.filter(
                    name => !_permMap[name] && !_granted.has(name),
                );
                if (nonMapped.length > 0) return false;

                if (
                    typeof navigator !== "undefined" &&
                    navigator.permissions?.query
                ) {
                    for (const name of chromePerms) {
                        const webName = _permMap[name];
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
            })();
            if (cb) p.then(cb).catch(() => cb(false));
            return p;
        },
        request(
            perms: chrome.permissions.Permissions,
            cb?: (granted: boolean) => void,
        ) {
            const p = (async () => {
                const chromePerms = perms.permissions ?? [];
                let allGranted = true;

                for (const perm of chromePerms) {
                    _granted.add(perm);
                    const webName = _permMap[perm];
                    if (!webName) continue;

                    try {
                        if (webName === "geolocation") {
                            await new Promise<void>((res, rej) => {
                                navigator.geolocation.getCurrentPosition(
                                    () => res(),
                                    e =>
                                        e.code === e.PERMISSION_DENIED
                                            ? rej(e)
                                            : res(),
                                    { timeout: 0 },
                                );
                            });
                        } else if (
                            webName === ("notifications" as PermissionName)
                        ) {
                            const r = await Notification.requestPermission();
                            if (r === "denied") allGranted = false;
                        } else if (
                            webName === ("microphone" as PermissionName)
                        ) {
                            const s = await navigator.mediaDevices.getUserMedia(
                                {
                                    audio: true,
                                },
                            );
                            s.getTracks().forEach(t => {
                                t.stop();
                            });
                        } else if (webName === ("camera" as PermissionName)) {
                            const s = await navigator.mediaDevices.getUserMedia(
                                {
                                    video: true,
                                },
                            );
                            s.getTracks().forEach(t => {
                                t.stop();
                            });
                        }
                    } catch {}
                }
                onAdded.dispatch(perms);
                return allGranted;
            })();
            if (cb) p.then(cb).catch(() => cb(false));
            return p;
        },
        remove(
            perms: chrome.permissions.Permissions,
            cb?: (removed: boolean) => void,
        ) {
            (perms.permissions ?? []).forEach(p => {
                _granted.delete(p);
            });
            onRemoved.dispatch(perms);
            return resolved(true, cb);
        },
        getAll(cb?: (permissions: chrome.permissions.Permissions) => void) {
            return resolved(
                {
                    permissions: [
                        ..._granted,
                    ] as unknown as chrome.permissions.Permissions["permissions"],
                    origins: ["<all_urls>"],
                },
                cb,
            );
        },
        onAdded,
        onRemoved,
    };
}

export function buildContextMenusAPI() {
    const _items = new Map<string | number, Record<string, unknown>>();
    let _idCounter = 1;
    const onClicked = new CivilEvent<
        (info: chrome.contextMenus.OnClickData, tab?: chrome.tabs.Tab) => void
    >();

    if (typeof document !== "undefined") {
        document.addEventListener("contextmenu", (e: MouseEvent) => {
            if (_items.size === 0) return;
            const target = e.target as HTMLElement | null;
            for (const [, item] of _items) {
                const contexts = (item.contexts as string[] | undefined) ?? [
                    "page",
                ];
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
                if (!matches) continue;
                const info: chrome.contextMenus.OnClickData = {
                    menuItemId: item.id as string | number,
                    editable: isText,
                    pageUrl: window.location.href,
                    selectionText:
                        window.getSelection()?.toString() || undefined,
                    srcUrl: isImage
                        ? (target as HTMLImageElement).src
                        : undefined,
                    linkUrl: isLink
                        ? (target as HTMLAnchorElement).href
                        : undefined,
                };
                onClicked.dispatch(info);
            }
        });
    }

    return {
        create(
            props: chrome.contextMenus.CreateProperties,
            cb?: () => void,
        ): string | number {
            const id =
                (props.id as string | number | undefined) ?? _idCounter++;
            _items.set(id, { ...props, id });
            if (cb) cb();
            return id;
        },
        update(
            id: string | number,
            props: Record<string, unknown>,
            cb?: () => void,
        ) {
            _items.set(id, { ..._items.get(id), ...props });
            return resolved(undefined, cb);
        },
        remove(id: string | number, cb?: () => void) {
            _items.delete(id);
            return resolved(undefined, cb);
        },
        removeAll(cb?: () => void) {
            _items.clear();
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

export function buildNotificationsAPI() {
    const _notifications = new Map<
        string,
        {
            options: chrome.notifications.NotificationOptions;
            notif?: Notification;
        }
    >();
    const onClicked = new CivilEvent<(id: string) => void>();
    const onClosed = new CivilEvent<(id: string, byUser: boolean) => void>();
    const onButtonClicked = new CivilEvent<
        (id: string, buttonIndex: number) => void
    >();
    const onPermissionLevelChanged = new CivilEvent<(level: string) => void>();
    const onShowSettings = new CivilEvent<() => void>();

    if (
        typeof Notification !== "undefined" &&
        Notification.permission === "default"
    ) {
        Notification.requestPermission()
            .then(p => onPermissionLevelChanged.dispatch(p))
            .catch(() => {});
    }

    return {
        create(
            notificationIdOrOptions:
                | string
                | chrome.notifications.NotificationOptions,
            optionsOrCb?:
                | chrome.notifications.NotificationOptions
                | ((id: string) => void),
            maybeCb?: (id: string) => void,
        ) {
            const id =
                typeof notificationIdOrOptions === "string"
                    ? notificationIdOrOptions
                    : crypto.randomUUID();
            const options =
                typeof notificationIdOrOptions === "object"
                    ? notificationIdOrOptions
                    : (optionsOrCb as chrome.notifications.NotificationOptions);
            const cb =
                typeof optionsOrCb === "function" ? optionsOrCb : maybeCb;
            const opts = options as Record<string, unknown>;

            try {
                if (
                    typeof Notification !== "undefined" &&
                    Notification.permission === "granted"
                ) {
                    const notifOpts: NotificationOptions = {
                        body: (opts?.message as string) ?? "",
                        icon: (opts?.iconUrl as string) ?? undefined,
                        tag: id,
                        requireInteraction:
                            (opts?.requireInteraction as boolean) ?? false,
                    };
                    const n = new Notification(
                        (opts?.title as string) ?? "",
                        notifOpts,
                    );
                    n.onclick = () => onClicked.dispatch(id);
                    n.onclose = () => onClosed.dispatch(id, true);
                    _notifications.set(id, { options, notif: n });
                } else {
                    _notifications.set(id, { options });
                }
            } catch {
                _notifications.set(id, { options });
            }
            return resolved(id, cb);
        },
        clear(id: string, cb?: (wasCleared: boolean) => void) {
            const entry = _notifications.get(id);
            if (entry) {
                try {
                    entry.notif?.close();
                } catch {}
                _notifications.delete(id);
                onClosed.dispatch(id, false);
                return resolved(true, cb);
            }
            return resolved(false, cb);
        },
        getAll(
            cb?: (
                notifications: Record<
                    string,
                    chrome.notifications.NotificationOptions
                >,
            ) => void,
        ) {
            const result: Record<
                string,
                chrome.notifications.NotificationOptions
            > = {};
            for (const [id, entry] of _notifications) {
                result[id] = entry.options;
            }
            return resolved(result, cb);
        },
        getPermissionLevel(cb?: (level: string) => void) {
            const level =
                typeof Notification !== "undefined"
                    ? Notification.permission
                    : "denied";
            return resolved(level, cb);
        },
        update(
            id: string,
            options: chrome.notifications.NotificationOptions,
            cb?: (wasUpdated: boolean) => void,
        ) {
            const entry = _notifications.get(id);
            if (!entry) return resolved(false, cb);

            try {
                entry.notif?.close();
            } catch {}
            const merged = { ...entry.options, ...options };
            const opts = merged as Record<string, unknown>;
            try {
                if (
                    typeof Notification !== "undefined" &&
                    Notification.permission === "granted"
                ) {
                    const n = new Notification((opts?.title as string) ?? "", {
                        body: (opts?.message as string) ?? "",
                        icon: (opts?.iconUrl as string) ?? undefined,
                        tag: id,
                    });
                    n.onclick = () => onClicked.dispatch(id);
                    n.onclose = () => onClosed.dispatch(id, true);
                    _notifications.set(id, { options: merged, notif: n });
                } else {
                    _notifications.set(id, { options: merged });
                }
            } catch {
                _notifications.set(id, { options: merged });
            }
            return resolved(true, cb);
        },
        onClicked,
        onClosed,
        onButtonClicked,
        onPermissionLevelChanged,
        onShowSettings,
    };
}

export function buildBrowsingDataAPI() {
    async function _clearStorage(
        dataTypes: Record<string, boolean>,
    ): Promise<void> {
        try {
            if (dataTypes.localStorage || dataTypes.fileSystems) {
                localStorage.clear();
            }
        } catch {}
        try {
            if (dataTypes.sessionStorage) {
                sessionStorage.clear();
            }
        } catch {}
        try {
            if (dataTypes.indexedDB) {
                if ("databases" in indexedDB) {
                    const dbs = await (
                        indexedDB as IDBFactory & {
                            databases(): Promise<
                                { name?: string; version?: number }[]
                            >;
                        }
                    ).databases();
                    await Promise.all(
                        dbs.map(
                            db =>
                                new Promise<void>((res, rej) => {
                                    if (!db.name) return res();
                                    const req = indexedDB.deleteDatabase(
                                        db.name,
                                    );
                                    req.onsuccess = () => res();
                                    req.onerror = () => rej(req.error);
                                }),
                        ),
                    );
                }
            }
        } catch {}
        try {
            if (dataTypes.cacheStorage || dataTypes.appcache) {
                if (
                    typeof caches !== "undefined" &&
                    typeof caches.keys === "function"
                ) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map(k => caches.delete(k)));
                }
            }
        } catch {}
        try {
            if (dataTypes.cookies) {
                const cookies = document.cookie.split(";");
                for (const cookie of cookies) {
                    const name = cookie.split("=")[0]?.trim();
                    if (name) {
                        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
                    }
                }
            }
        } catch {}
    }

    function _makeRemoveFn(dataTypes: Record<string, boolean>) {
        return (
            _options?: unknown,
            _dataTypesOverride?: unknown,
            cb?: () => void,
        ) => {
            const p = _clearStorage(dataTypes).then(() => undefined);
            if (cb) p.then(cb).catch(() => cb());
            return p;
        };
    }

    return {
        remove: (
            _options: unknown,
            dataTypes: Record<string, boolean>,
            cb?: () => void,
        ) => {
            const p = _clearStorage(dataTypes ?? {}).then(() => undefined);
            if (cb) p.then(cb).catch(() => cb());
            return p;
        },
        removeAppcache: _makeRemoveFn({ appcache: true }),
        removeCache: _makeRemoveFn({ cacheStorage: true }),
        removeCacheStorage: _makeRemoveFn({ cacheStorage: true }),
        removeCookies: _makeRemoveFn({ cookies: true }),
        removeDownloads: _makeRemoveFn({}),
        removeFileSystems: _makeRemoveFn({ fileSystems: true }),
        removeFormData: _makeRemoveFn({}),
        removeHistory: _makeRemoveFn({}),
        removeIndexedDB: _makeRemoveFn({ indexedDB: true }),
        removeLocalStorage: _makeRemoveFn({ localStorage: true }),
        removePasswords: _makeRemoveFn({}),
        removePluginData: _makeRemoveFn({}),
        removeServiceWorkers: async (_options?: unknown, cb?: () => void) => {
            try {
                if (
                    typeof navigator !== "undefined" &&
                    navigator.serviceWorker
                ) {
                    const registrations =
                        await navigator.serviceWorker.getRegistrations();
                    await Promise.all(registrations.map(r => r.unregister()));
                }
            } catch {}
            if (cb) cb();
        },
        removeWebSQL: _makeRemoveFn({}),
        settings(
            cb?: (result: {
                options: chrome.browsingData.RemovalOptions;
                dataToRemove: chrome.browsingData.DataTypeSet;
            }) => void,
        ) {
            return resolved(
                {
                    options: { since: 0 },
                    dataToRemove: {},
                    dataRemovalPermitted: {},
                } as unknown as {
                    options: chrome.browsingData.RemovalOptions;
                    dataToRemove: chrome.browsingData.DataTypeSet;
                },
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
                    const existing = document.getElementById(
                        "__civil_offscreen__",
                    );
                    if (existing) existing.remove();
                    const iframe = document.createElement("iframe");
                    iframe.id = "__civil_offscreen__";
                    iframe.style.cssText =
                        "position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none";

                    // Inject the chrome shim into the offscreen document so that
                    // chrome.runtime.id (and all other APIs) are available there.
                    const shimSrc = (
                        window as unknown as Record<string, unknown>
                    ).__CIVIL_SHIM_SRC__ as string | undefined;

                    // chrome-extension:// URLs can't be fetched directly;
                    // rewrite to Civil's /civil-ext/ origin-relative form.
                    const bib = getBiB();
                    const civilUrl = params.url.replace(
                        /^chrome-extension:\/\/([^/]+)\//,
                        `${bib.origin}/civil-ext/$1/`,
                    );

                    if (shimSrc) {
                        try {
                            const resp = await fetch(civilUrl);
                            let html = await resp.text();
                            const shimOpts = JSON.stringify({
                                extId,
                                manifest,
                                contextType: "offscreen",
                                bib,
                            });
                            // Escape </script inside the injected source to avoid
                            // prematurely closing the script tag.
                            const safeSrc = shimSrc.replace(
                                /<\/script/gi,
                                "</script",
                            );
                            const shimInject = `<script>window.__CIVIL_SHIM_OPTIONS__=${shimOpts};${safeSrc}</script>`;
                            if (/<head[^>]*>/i.test(html)) {
                                html = html.replace(
                                    /<head([^>]*)>/i,
                                    (_m, a: string) =>
                                        `<head${a}>${shimInject}`,
                                );
                            } else {
                                html = shimInject + html;
                            }
                            iframe.srcdoc = html;
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
                        iframe.addEventListener("load", () => resolve(), {
                            once: true,
                        });
                        // Fallback: give up after 5 s even if load never fires
                        setTimeout(resolve, 5000);
                        document.body?.appendChild(iframe);
                    });
                } catch {}
            }
            if (cb) cb();
            return Promise.resolve(undefined);
        },
        closeDocument(cb?: () => void) {
            try {
                document.getElementById("__civil_offscreen__")?.remove();
            } catch {}
            return resolved(undefined, cb);
        },
        hasDocument(cb?: (result: boolean) => void) {
            const has = !!document.getElementById("__civil_offscreen__");
            return resolved(has, cb);
        },
        Reason: {
            TESTING: "TESTING",
            AUDIO_PLAYBACK: "AUDIO_PLAYBACK",
            IFRAME_SCRIPTING: "IFRAME_SCRIPTING",
            DOM_SCRAPING: "DOM_SCRAPING",
            BLOBS: "BLOBS",
            DOM_PARSER: "DOM_PARSER",
            USER_MEDIA: "USER_MEDIA",
            DISPLAY_MEDIA: "DISPLAY_MEDIA",
            WEB_RTC: "WEB_RTC",
            CLIPBOARD: "CLIPBOARD",
            LOCAL_STORAGE: "LOCAL_STORAGE",
            WORKERS: "WORKERS",
            BATTERY_STATUS: "BATTERY_STATUS",
            MATCH_MEDIA: "MATCH_MEDIA",
            GEOLOCATION: "GEOLOCATION",
        },
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

export function buildCookiesAPI() {
    const _jar = _loadVirtualCookies();
    const onChanged = new CivilEvent<
        (changeInfo: chrome.cookies.CookieChangeInfo) => void
    >();

    function _jarToCookie(v: VirtualCookie): chrome.cookies.Cookie {
        return v as unknown as chrome.cookies.Cookie;
    }

    function _getAllMerged(): chrome.cookies.Cookie[] {
        const domCookies = _parseDomCookies();
        const virtual = _jar.map(_jarToCookie);
        // Merge: virtual takes precedence by name+domain
        const seen = new Set<string>();
        const result: chrome.cookies.Cookie[] = [];
        for (const c of virtual) {
            seen.add(`${c.name}::${c.domain}`);
            result.push(c);
        }
        for (const c of domCookies) {
            if (!seen.has(`${c.name}::${c.domain}`)) {
                result.push(c);
            }
        }
        return result;
    }

    return {
        get(
            details: chrome.cookies.Cookie,
            cb?: (cookie: chrome.cookies.Cookie | null) => void,
        ) {
            const d = details as unknown as {
                name: string;
                url?: string;
                domain?: string;
            };
            const all = _getAllMerged();
            const found =
                all.find(
                    c =>
                        c.name === d.name &&
                        (d.domain == null ||
                            c.domain === d.domain ||
                            c.domain?.endsWith(`.${d.domain}`)),
                ) ?? null;
            return resolved(found, cb);
        },
        getAll(
            details: chrome.cookies.GetAllDetails,
            cb?: (cookies: chrome.cookies.Cookie[]) => void,
        ) {
            let all = _getAllMerged();
            const d = details as unknown as {
                name?: string;
                url?: string;
                domain?: string;
                path?: string;
                secure?: boolean;
                storeId?: string;
            };
            if (d?.name) all = all.filter(c => c.name === d.name);
            if (d?.domain)
                all = all.filter(
                    c =>
                        c.domain === d.domain ||
                        c.domain?.endsWith(`.${d.domain as string}`),
                );
            if (d?.path) all = all.filter(c => c.path === d.path);
            if (d?.secure != null) all = all.filter(c => c.secure === d.secure);
            return resolved(all, cb);
        },
        set(
            details: chrome.cookies.SetDetails,
            cb?: (cookie: chrome.cookies.Cookie | null) => void,
        ) {
            const d = details as unknown as {
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

            const domain =
                d.domain ??
                (d.url
                    ? (() => {
                          try {
                              return new URL(d.url as string).hostname;
                          } catch {
                              return window.location.hostname;
                          }
                      })()
                    : window.location.hostname);

            const virtual: VirtualCookie = {
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

            const idx = _jar.findIndex(
                c => c.name === d.name && c.domain === domain,
            );
            if (idx >= 0) {
                _jar[idx] = virtual;
            } else {
                _jar.push(virtual);
            }
            _saveVirtualCookies(_jar);

            // Also try to set via document.cookie for same-origin
            try {
                let cookieStr = `${d.name}=${d.value ?? ""}`;
                if (d.expirationDate) {
                    cookieStr += `;expires=${new Date(d.expirationDate * 1000).toUTCString()}`;
                }
                if (d.path) cookieStr += `;path=${d.path}`;
                if (d.secure) cookieStr += ";secure";
                if (d.sameSite && d.sameSite !== "no_restriction") {
                    const sameMap: Record<string, string> = {
                        strict: "Strict",
                        lax: "Lax",
                        no_restriction: "None",
                        unspecified: "Lax",
                    };
                    cookieStr += `;samesite=${sameMap[d.sameSite] ?? "Lax"}`;
                }
                document.cookie = cookieStr;
            } catch {}

            const result = _jarToCookie(virtual);
            onChanged.dispatch({
                removed: false,
                cookie: result,
                cause: "explicit",
            } as unknown as chrome.cookies.CookieChangeInfo);
            return resolved(result, cb);
        },
        remove(
            details: chrome.cookies.SetDetails,
            cb?: (details: chrome.cookies.SetDetails) => void,
        ) {
            const d = details as unknown as {
                name: string;
                url?: string;
                domain?: string;
            };
            const domain =
                d.domain ??
                (d.url
                    ? (() => {
                          try {
                              return new URL(d.url as string).hostname;
                          } catch {
                              return window.location.hostname;
                          }
                      })()
                    : window.location.hostname);
            const idx = _jar.findIndex(
                c => c.name === d.name && c.domain === domain,
            );
            if (idx >= 0) {
                const removed = _jar[idx];
                _jar.splice(idx, 1);
                _saveVirtualCookies(_jar);
                if (removed) {
                    onChanged.dispatch({
                        removed: true,
                        cookie: _jarToCookie(removed),
                        cause: "explicit",
                    } as unknown as chrome.cookies.CookieChangeInfo);
                }
            }
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

export function buildHistoryAPI() {
    const _items: chrome.history.HistoryItem[] = _loadHistory();
    let _visitIdCounter = _items.length;

    const onVisited = new CivilEvent<
        (result: chrome.history.HistoryItem) => void
    >();
    const onVisitRemoved = new CivilEvent<
        (removed: chrome.history.RemovedResult) => void
    >();

    const _emitVisit = (url: string) => {
        const id = String(++_visitIdCounter);
        const existing = _items.find(i => i.url === url);
        if (existing) {
            existing.lastVisitTime = Date.now();
            existing.visitCount = (existing.visitCount ?? 0) + 1;
        } else {
            _items.push({
                id,
                url,
                title: typeof document !== "undefined" ? document.title : url,
                lastVisitTime: Date.now(),
                visitCount: 1,
                typedCount: 0,
            });
        }
        _saveHistory(_items);
        const item = _items.find(i => i.url === url);
        if (item) onVisited.dispatch(item);
    };

    if (typeof window !== "undefined") {
        const _original_pushState = history.pushState.bind(history);
        const _original_replaceState = history.replaceState.bind(history);
        history.pushState = (...args: Parameters<typeof history.pushState>) => {
            _original_pushState(...args);
            _emitVisit(window.location.href);
        };
        history.replaceState = (
            ...args: Parameters<typeof history.replaceState>
        ) => {
            _original_replaceState(...args);
            _emitVisit(window.location.href);
        };
        window.addEventListener("popstate", () =>
            _emitVisit(window.location.href),
        );
    }

    return {
        search(
            query: chrome.history.HistoryQuery,
            cb?: (results: chrome.history.HistoryItem[]) => void,
        ) {
            const q = query as unknown as {
                text?: string;
                startTime?: number;
                endTime?: number;
                maxResults?: number;
            };
            const text = q.text?.toLowerCase();
            let results = _items.filter(item => {
                if (
                    text &&
                    !item.url?.toLowerCase().includes(text) &&
                    !item.title?.toLowerCase().includes(text)
                )
                    return false;
                if (
                    q.startTime != null &&
                    (item.lastVisitTime ?? 0) < q.startTime
                )
                    return false;
                if (q.endTime != null && (item.lastVisitTime ?? 0) > q.endTime)
                    return false;
                return true;
            });
            if (q.maxResults != null) results = results.slice(0, q.maxResults);
            return resolved(results, cb);
        },
        getVisits(
            details: chrome.history.UrlDetails,
            cb?: (results: chrome.history.VisitItem[]) => void,
        ) {
            const d = details as unknown as { url: string };
            const item = _items.find(i => i.url === d.url);
            if (!item) return resolved([], cb);
            const visits: chrome.history.VisitItem[] = [
                {
                    id: item.id,
                    visitId: item.id,
                    visitTime: item.lastVisitTime,
                    referringVisitId: "0",
                    transition: "link",
                } as chrome.history.VisitItem,
            ];
            return resolved(visits, cb);
        },
        addUrl(details: chrome.history.UrlDetails, cb?: () => void) {
            const d = details as unknown as { url: string; title?: string };
            if (d.url) {
                const id = String(++_visitIdCounter);
                _items.push({
                    id,
                    url: d.url,
                    title: d.title ?? d.url,
                    lastVisitTime: Date.now(),
                    visitCount: 1,
                    typedCount: 0,
                });
                _saveHistory(_items);
            }
            return resolved(undefined, cb);
        },
        deleteUrl(details: chrome.history.UrlDetails, cb?: () => void) {
            const d = details as unknown as { url: string };
            const idx = _items.findIndex(i => i.url === d.url);
            if (idx >= 0) {
                _items.splice(idx, 1);
                _saveHistory(_items);
                onVisitRemoved.dispatch({
                    allHistory: false,
                    urls: [d.url],
                } as chrome.history.RemovedResult);
            }
            return resolved(undefined, cb);
        },
        deleteRange(range: chrome.history.Range, cb?: () => void) {
            const r = range as unknown as {
                startTime: number;
                endTime: number;
            };
            const removed: string[] = [];
            for (let i = _items.length - 1; i >= 0; i--) {
                const t = _items[i]?.lastVisitTime ?? 0;
                if (t >= r.startTime && t <= r.endTime) {
                    removed.push(_items[i]?.url ?? "");
                    _items.splice(i, 1);
                }
            }
            if (removed.length > 0) {
                _saveHistory(_items);
                onVisitRemoved.dispatch({
                    allHistory: false,
                    urls: removed,
                } as chrome.history.RemovedResult);
            }
            return resolved(undefined, cb);
        },
        deleteAll(cb?: () => void) {
            _items.length = 0;
            try {
                localStorage.removeItem(_HISTORY_KEY);
            } catch {}
            onVisitRemoved.dispatch({
                allHistory: true,
                urls: [],
            } as chrome.history.RemovedResult);
            return resolved(undefined, cb);
        },
        onVisited,
        onVisitRemoved,
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

export function buildBookmarksAPI() {
    const _flat = _loadBookmarks();
    let _idCounter = _flat.size + 10;

    const onCreated = new CivilEvent<
        (id: string, bookmark: chrome.bookmarks.BookmarkTreeNode) => void
    >();
    const onRemoved = new CivilEvent<
        (
            id: string,
            removeInfo: {
                parentId: string;
                index: number;
                node: chrome.bookmarks.BookmarkTreeNode;
            },
        ) => void
    >();
    const onChanged = new CivilEvent<
        (id: string, changeInfo: { title: string; url?: string }) => void
    >();
    const onMoved = new CivilEvent<
        (
            id: string,
            moveInfo: {
                parentId: string;
                index: number;
                oldParentId: string;
                oldIndex: number;
            },
        ) => void
    >();
    const onChildrenReordered = new CivilEvent<
        (id: string, reorderInfo: { childIds: string[] }) => void
    >();
    const onImportBegan = new CivilEvent<() => void>();
    const onImportEnded = new CivilEvent<() => void>();

    return {
        get(
            ids: string | string[],
            cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void,
        ) {
            const idArr = Array.isArray(ids) ? ids : [ids];
            const results = idArr
                .map(id => _buildSubTree(id, _flat))
                .filter(
                    (n): n is chrome.bookmarks.BookmarkTreeNode =>
                        n !== undefined,
                );
            return resolved(results, cb);
        },
        getChildren(
            id: string,
            cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void,
        ) {
            const node = _flat.get(id);
            if (!node) return resolved([], cb);
            const childIds = (
                node.children as unknown as
                    | string[]
                    | chrome.bookmarks.BookmarkTreeNode[]
            )?.filter(c => typeof c === "string") as string[] | undefined;
            const results = (childIds ?? [])
                .map(cid => _flat.get(cid))
                .filter(
                    (n): n is chrome.bookmarks.BookmarkTreeNode =>
                        n !== undefined,
                );
            return resolved(results, cb);
        },
        getRecent(
            n: number,
            cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void,
        ) {
            const leaves = [..._flat.values()]
                .filter(node => node.url)
                .toSorted((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0))
                .slice(0, n);
            return resolved(leaves, cb);
        },
        getTree(cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void) {
            const root = _buildSubTree("0", _flat);
            return resolved(root ? [root] : [], cb);
        },
        getSubTree(
            id: string,
            cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void,
        ) {
            const node = _buildSubTree(id, _flat);
            return resolved(node ? [node] : [], cb);
        },
        search(
            query: string | { query?: string; url?: string; title?: string },
            cb?: (results: chrome.bookmarks.BookmarkTreeNode[]) => void,
        ) {
            const q =
                typeof query === "string"
                    ? { query }
                    : (query as {
                          query?: string;
                          url?: string;
                          title?: string;
                      });
            const results = [..._flat.values()].filter(node => {
                if (node.id === "0") return false;
                if (q.url && node.url !== q.url) return false;
                if (
                    q.title &&
                    !node.title.toLowerCase().includes(q.title.toLowerCase())
                )
                    return false;
                if (
                    q.query &&
                    !node.url?.toLowerCase().includes(q.query.toLowerCase()) &&
                    !node.title.toLowerCase().includes(q.query.toLowerCase())
                )
                    return false;
                return true;
            });
            return resolved(results, cb);
        },
        create(
            bookmark: {
                parentId?: string;
                index?: number;
                title?: string;
                url?: string;
            },
            cb?: (result: chrome.bookmarks.BookmarkTreeNode) => void,
        ) {
            const id = String(++_idCounter);
            const parentId = bookmark.parentId ?? "1";
            const parent = _flat.get(parentId);
            const parentChildren =
                (
                    parent?.children as unknown as
                        | string[]
                        | chrome.bookmarks.BookmarkTreeNode[]
                        | undefined
                )?.filter(c => typeof c === "string") ?? [];
            const index = bookmark.index ?? parentChildren.length;
            const node = {
                id,
                parentId,
                index,
                title: bookmark.title ?? "",
                url: bookmark.url,
                dateAdded: Date.now(),
                children: bookmark.url
                    ? undefined
                    : ([] as chrome.bookmarks.BookmarkTreeNode[]),
            } as chrome.bookmarks.BookmarkTreeNode;
            _flat.set(id, node);
            if (parent) {
                const newChildren = [...parentChildren];
                newChildren.splice(index, 0, id);
                (parent as unknown as Record<string, unknown>).children =
                    newChildren;
            }
            _saveBookmarks(_flat);
            onCreated.dispatch(id, node);
            return resolved(node, cb);
        },
        move(
            id: string,
            dest: { parentId?: string; index?: number },
            cb?: (result: chrome.bookmarks.BookmarkTreeNode) => void,
        ) {
            const node = _flat.get(id);
            if (!node)
                return resolved({} as chrome.bookmarks.BookmarkTreeNode, cb);
            const oldParentId = node.parentId ?? "0";
            const oldParent = _flat.get(oldParentId);
            const newParentId = dest.parentId ?? oldParentId;
            const newParent = _flat.get(newParentId);

            // Remove from old parent
            if (oldParent) {
                const children =
                    (
                        oldParent.children as unknown as string[] | undefined
                    )?.filter(c => typeof c === "string") ?? [];
                const oldIndex = children.indexOf(id);
                const newChildren = children.filter(c => c !== id);
                (oldParent as unknown as Record<string, unknown>).children =
                    newChildren;
                // Add to new parent
                if (newParent) {
                    const newSiblings =
                        (
                            newParent.children as unknown as
                                | string[]
                                | undefined
                        )?.filter(c => typeof c === "string") ?? [];
                    const newIndex = dest.index ?? newSiblings.length;
                    newSiblings.splice(newIndex, 0, id);
                    (newParent as unknown as Record<string, unknown>).children =
                        newSiblings;
                    node.parentId = newParentId;
                    node.index = dest.index ?? newSiblings.length - 1;
                    _saveBookmarks(_flat);
                    onMoved.dispatch(id, {
                        parentId: newParentId,
                        index: node.index,
                        oldParentId,
                        oldIndex,
                    });
                }
            }
            return resolved(node, cb);
        },
        update(
            id: string,
            changes: { title?: string; url?: string },
            cb?: (result: chrome.bookmarks.BookmarkTreeNode) => void,
        ) {
            const node = _flat.get(id);
            if (!node)
                return resolved({} as chrome.bookmarks.BookmarkTreeNode, cb);
            if (changes.title != null) node.title = changes.title;
            if (changes.url != null) node.url = changes.url;
            _saveBookmarks(_flat);
            onChanged.dispatch(id, {
                title: node.title,
                url: node.url,
            });
            return resolved(node, cb);
        },
        remove(id: string, cb?: () => void) {
            const node = _flat.get(id);
            if (node) {
                const parentId = node.parentId ?? "0";
                const parent = _flat.get(parentId);
                if (parent) {
                    const children =
                        (
                            parent.children as unknown as string[] | undefined
                        )?.filter(c => typeof c === "string") ?? [];
                    const index = children.indexOf(id);
                    (parent as unknown as Record<string, unknown>).children =
                        children.filter(c => c !== id);
                    _flat.delete(id);
                    _saveBookmarks(_flat);
                    onRemoved.dispatch(id, {
                        parentId,
                        index,
                        node,
                    });
                }
            }
            return resolved(undefined, cb);
        },
        removeTree(id: string, cb?: () => void) {
            const _removeRecursive = (nid: string) => {
                const n = _flat.get(nid);
                if (!n) return;
                const childIds =
                    (n.children as unknown as string[] | undefined)?.filter(
                        c => typeof c === "string",
                    ) ?? [];
                for (const cid of childIds) _removeRecursive(cid);
                _flat.delete(nid);
            };
            const node = _flat.get(id);
            const parentId = node?.parentId ?? "0";
            const parent = _flat.get(parentId);
            const children =
                (parent?.children as unknown as string[] | undefined)?.filter(
                    c => typeof c === "string",
                ) ?? [];
            const index = children.indexOf(id);
            _removeRecursive(id);
            if (parent) {
                (parent as unknown as Record<string, unknown>).children =
                    children.filter(c => c !== id);
            }
            _saveBookmarks(_flat);
            if (node) {
                onRemoved.dispatch(id, { parentId, index, node });
            }
            return resolved(undefined, cb);
        },
        onCreated,
        onRemoved,
        onChanged,
        onMoved,
        onChildrenReordered,
        onImportBegan,
        onImportEnded,
        MAX_WRITE_OPERATIONS_PER_HOUR: 1_000_000,
        MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE: 1_000_000,
    };
}

export function buildCommandsAPI(manifest?: {
    commands?: Record<
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
}) {
    const onCommand = new CivilEvent<
        (command: string, tab?: chrome.tabs.Tab) => void
    >();

    const _manifestCommands = manifest?.commands ?? {};
    const _commands: chrome.commands.Command[] = Object.entries(
        _manifestCommands,
    ).map(([name, def]) => ({
        name,
        description: def.description ?? "",
        shortcut:
            def.suggested_key?.default ??
            def.suggested_key?.windows ??
            def.suggested_key?.linux ??
            "",
    }));

    const _shortcuts = new Map<string, string>();
    for (const cmd of _commands) {
        if (cmd.shortcut) {
            _shortcuts.set(cmd.shortcut.toLowerCase(), cmd.name ?? "");
        }
    }

    function _normalizeKey(e: KeyboardEvent): string {
        const parts: string[] = [];
        if (e.ctrlKey) parts.push("ctrl");
        if (e.altKey) parts.push("alt");
        if (e.shiftKey) parts.push("shift");
        if (e.metaKey) parts.push("command");
        const key = e.key.toUpperCase();
        parts.push(key);
        return parts.join("+");
    }

    if (typeof document !== "undefined" && _shortcuts.size > 0) {
        document.addEventListener("keydown", (e: KeyboardEvent) => {
            const normalized = _normalizeKey(e);
            // Try various formats
            const candidates = [
                normalized,
                normalized.replace("ctrl+shift+", "ctrl+shift+"),
                normalized.replace("alt+shift+", "alt+shift+"),
            ];
            for (const candidate of candidates) {
                if (_shortcuts.has(candidate)) {
                    const cmdName = _shortcuts.get(candidate);
                    if (cmdName) {
                        e.preventDefault();
                        onCommand.dispatch(cmdName);
                        break;
                    }
                }
            }
        });
    }

    return {
        getAll(cb?: (commands: chrome.commands.Command[]) => void) {
            return resolved(_commands, cb);
        },
        onCommand,
    };
}

export function buildDownloadsAPI() {
    const _items = new Map<
        number,
        { item: chrome.downloads.DownloadItem; url: string }
    >();
    let _idCounter = 1;

    const onCreated = new CivilEvent<
        (item: chrome.downloads.DownloadItem) => void
    >();
    const onChanged = new CivilEvent<
        (delta: chrome.downloads.DownloadDelta) => void
    >();
    const onErased = new CivilEvent<(id: number) => void>();
    const onDeterminingFilename = new CivilEvent<
        (
            item: chrome.downloads.DownloadItem,
            suggest: (suggestion?: chrome.downloads.FilenameSuggestion) => void,
        ) => void
    >();
    return {
        download(
            options: chrome.downloads.DownloadOptions,
            cb?: (id: number) => void,
        ) {
            const opts = options as unknown as {
                url: string;
                filename?: string;
                saveAs?: boolean;
            };
            const id = _idCounter++;
            const item: chrome.downloads.DownloadItem = {
                id,
                url: opts.url,
                filename: opts.filename ?? "",
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
            } as unknown as chrome.downloads.DownloadItem;
            _items.set(id, { item, url: opts.url });
            onCreated.dispatch(item);

            try {
                const a = document.createElement("a");
                a.href = opts.url;
                if (opts.filename) a.download = opts.filename;
                a.rel = "noopener noreferrer";
                a.style.display = "none";
                document.body?.appendChild(a);
                a.click();
                document.body?.removeChild(a);

                setTimeout(() => {
                    const entry = _items.get(id);
                    if (entry) {
                        const prev = { ...entry.item };
                        (
                            entry.item as unknown as Record<string, unknown>
                        ).state = "complete";
                        onChanged.dispatch({
                            id,
                            state: {
                                previous: prev.state,
                                current: "complete",
                            },
                        } as chrome.downloads.DownloadDelta);
                    }
                }, 500);
            } catch {}

            return resolved(id, cb);
        },
        search(
            query: chrome.downloads.DownloadQuery,
            cb?: (results: chrome.downloads.DownloadItem[]) => void,
        ) {
            const q = query as unknown as { id?: number; state?: string };
            let results = [..._items.values()].map(e => e.item);
            if (q.id != null) results = results.filter(i => i.id === q.id);
            if (q.state)
                results = results.filter(
                    i =>
                        (i as unknown as Record<string, unknown>).state ===
                        q.state,
                );
            return resolved(results, cb);
        },
        pause(_id: number, cb?: () => void) {
            return resolved(undefined, cb);
        },
        resume(_id: number, cb?: () => void) {
            return resolved(undefined, cb);
        },
        cancel(_id: number, cb?: () => void) {
            return resolved(undefined, cb);
        },
        getFileIcon(
            _id: number,
            _opts?: chrome.downloads.GetFileIconOptions,
            cb?: (url: string) => void,
        ) {
            return resolved("", cb);
        },
        open(id: number) {
            const entry = _items.get(id);
            if (entry) {
                try {
                    window.open(entry.url, "_blank", "noopener,noreferrer");
                } catch {}
            }
        },
        show(_id: number) {},
        showDefaultFolder() {},
        erase(
            query: chrome.downloads.DownloadQuery,
            cb?: (ids: number[]) => void,
        ) {
            const q = query as unknown as { id?: number };
            const erased: number[] = [];
            if (q.id != null) {
                if (_items.has(q.id)) {
                    _items.delete(q.id);
                    erased.push(q.id);
                    onErased.dispatch(q.id);
                }
            }
            return resolved(erased, cb);
        },
        removeFile(_id: number, cb?: () => void) {
            return resolved(undefined, cb);
        },
        acceptDanger(_id: number, cb?: () => void) {
            return resolved(undefined, cb);
        },
        setUiOptions(_opts: { enabled: boolean }, cb?: () => void) {
            return resolved(undefined, cb);
        },
        onCreated,
        onChanged,
        onErased,
        onDeterminingFilename,
    };
}

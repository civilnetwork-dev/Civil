/**
 * The four namespaces vendor bundles read *values* out of during startup,
 * rather than merely calling.
 *
 * These would otherwise fall to the universal stub, which resolves every
 * call to `undefined` — correct for an API nobody reads the result of, and
 * fatal for these. Real bundles do `getProfileUserInfo(u => u.email)`,
 * `getPlatformInfo(i => i.os)`, `windows.getCurrent(w => w.id)`,
 * `management.getSelf(e => e.id)`, and each one dies on the property access.
 * Four of the twenty-eight tracked filters stopped there.
 *
 * What each returns is what Chrome returns on the device this host models: a
 * managed Chromebook, with a profile that has granted nothing. Empty strings
 * for identity, not invented addresses — `getProfileUserInfo` really does
 * return `{ email: "", id: "" }` when the extension lacks the identity
 * permission or nobody is signed in, so a bundle branching on "am I signed
 * in" takes a branch it would genuinely take.
 */

import type {
    ChromeManifest,
    SyntheticTab,
} from "../../browserApiEmulators/extensions/chrome/types";

export function buildWindows(getTab: () => SyntheticTab) {
    const synthetic = (populate?: boolean) => {
        const tab = getTab();
        return {
            id: tab.windowId,
            focused: true,
            alwaysOnTop: false,
            incognito: false,
            type: "normal",
            state: "normal",
            top: 0,
            left: 0,
            width: 1366,
            height: 768,
            ...(populate ? { tabs: [tab] } : {}),
        };
    };
    const populated = (info?: { populate?: boolean }) =>
        synthetic(info?.populate);

    return {
        WINDOW_ID_NONE: -1,
        WINDOW_ID_CURRENT: -2,
        get: async (_id: number, info?: { populate?: boolean }) =>
            populated(info),
        getCurrent: async (info?: { populate?: boolean }) => populated(info),
        getLastFocused: async (info?: { populate?: boolean }) =>
            populated(info),
        getAll: async (info?: { populate?: boolean }) => [populated(info)],
        create: async () => synthetic(false),
        update: async () => synthetic(false),
        remove: async () => {},
        onCreated: emptyEvent(),
        onRemoved: emptyEvent(),
        onFocusChanged: emptyEvent(),
        onBoundsChanged: emptyEvent(),
    };
}

export function buildIdentity() {
    return {
        // Empty, not invented: this is Chrome's own answer for a profile that
        // hasn't granted the identity permission, and it's the honest state
        // for a host that has no Google account behind it.
        getProfileUserInfo: async () => ({ email: "", id: "" }),
        getAuthToken: async () => ({ token: "" }),
        removeCachedAuthToken: async () => {},
        clearAllCachedAuthTokens: async () => {},
        getRedirectURL: (path = "") =>
            `https://extension-id.chromiumapp.org/${path.replace(/^\//, "")}`,
        launchWebAuthFlow: async () => undefined,
        onSignInChanged: emptyEvent(),
    };
}

export function buildManagement(extensionId: string, manifest: ChromeManifest) {
    const self = {
        id: extensionId,
        name: manifest.name,
        shortName: manifest.short_name ?? manifest.name,
        description: manifest.description ?? "",
        version: manifest.version,
        mayDisable: true,
        enabled: true,
        installType: "admin",
        type: "extension",
        permissions: manifest.permissions ?? [],
        hostPermissions: manifest.host_permissions ?? [],
        icons: [],
        offlineEnabled: false,
        optionsUrl: "",
    };
    return {
        getSelf: async () => self,
        get: async () => self,
        getAll: async () => [self],
        getPermissionWarningsById: async () => [],
        getPermissionWarningsByManifest: async () => [],
        setEnabled: async () => {},
        uninstallSelf: async () => {},
        onInstalled: emptyEvent(),
        onUninstalled: emptyEvent(),
        onEnabled: emptyEvent(),
        onDisabled: emptyEvent(),
    };
}

/**
 * `chrome.i18n`, reading the extension's own `_locales` when it ships them.
 * Chrome returns `""` for a key with no message, which is what a caller like
 * `getMessage("x").toUpperCase()` is written against — so an unknown key
 * yields an empty string rather than the key name or `undefined`.
 */
export function buildI18n(messages: Record<string, { message?: string }>) {
    return {
        getMessage: (key: string, substitutions?: string | string[]) => {
            const raw = messages[key]?.message;
            if (raw === undefined) return "";
            const values =
                substitutions === undefined
                    ? []
                    : Array.isArray(substitutions)
                      ? substitutions
                      : [substitutions];
            return raw.replace(/\$(\d)/g, (_match, index: string) =>
                String(values[Number(index) - 1] ?? ""),
            );
        },
        getUILanguage: () => "en-US",
        getAcceptLanguages: async () => ["en-US", "en"],
        detectLanguage: async (text: string) => ({
            isReliable: false,
            languages: [{ language: "en", percentage: 100 }],
            detectedLanguage: "en",
            ...(text ? {} : {}),
        }),
    };
}

/**
 * `chrome.extension` — MV2's alias for a handful of `chrome.runtime`
 * members, still present in MV3 and still used by eight of the tracked
 * filters.
 *
 * `getURL` is the one that matters. Left to the universal stub it returns a
 * *proxy*, not a string, and the caller happily passes that proxy to
 * `XMLHttpRequest.open()` — which stringifies it into a URL pointing
 * nowhere. goguardian loads its Avro schemas exactly this way and then
 * parsed the resulting empty response, failing with `invalid name: ""`,
 * about as far from the real cause as an error can land.
 */
export function buildExtensionAlias(getURL: (path: string) => string) {
    return {
        getURL,
        getBackgroundPage: () => undefined,
        getViews: () => [],
        isAllowedIncognitoAccess: async () => false,
        isAllowedFileSchemeAccess: async () => false,
        inIncognitoContext: false,
        lastError: undefined,
        onRequest: emptyEvent(),
        onRequestExternal: emptyEvent(),
    };
}

/**
 * `chrome.system.*` — the device inventory fourteen of the tracked filters
 * ask for, and read straight into property accesses (`info.archName`,
 * `info.capacity`). The numbers describe the Chromebook this host already
 * models everywhere else: see `buildNavigator` in api/platform.ts, which
 * reports the same four cores.
 */
export function buildSystem() {
    const processors = Array.from({ length: 4 }, () => ({
        usage: { kernel: 0, user: 0, idle: 100, total: 100 },
    }));
    return {
        cpu: {
            getInfo: async () => ({
                numOfProcessors: processors.length,
                archName: "x86-64",
                modelName: "Intel(R) Celeron(R) N4020 CPU @ 1.10GHz",
                features: [],
                processors,
                temperatures: [],
            }),
        },
        memory: {
            getInfo: async () => ({
                capacity: 4 * 1024 ** 3,
                availableCapacity: 2 * 1024 ** 3,
            }),
        },
        storage: {
            getInfo: async () => [
                {
                    id: "storage:0",
                    name: "Internal Storage",
                    type: "fixed",
                    capacity: 32 * 1024 ** 3,
                },
            ],
            getAvailableCapacity: async () => ({
                id: "storage:0",
                availableCapacity: 16 * 1024 ** 3,
            }),
            ejectDevice: async () => "success",
            onAttached: emptyEvent(),
            onDetached: emptyEvent(),
        },
        display: {
            getInfo: async () => [
                {
                    id: "display:0",
                    name: "Built-in display",
                    isPrimary: true,
                    isInternal: true,
                    isEnabled: true,
                    dpiX: 96,
                    dpiY: 96,
                    rotation: 0,
                    bounds: { left: 0, top: 0, width: 1366, height: 768 },
                    overscan: { left: 0, top: 0, right: 0, bottom: 0 },
                    workArea: { left: 0, top: 0, width: 1366, height: 720 },
                },
            ],
            getDisplayLayout: async () => [],
            setDisplayProperties: async () => {},
            onDisplayChanged: emptyEvent(),
        },
        network: {
            getNetworkInterfaces: async () => [
                { name: "eth0", address: "127.0.0.1", prefixLength: 8 },
            ],
        },
    };
}

/**
 * Namespaces whose methods return *lists* of things this host has none of:
 * no browsing history, no downloads, no cookie jar, no closed sessions.
 * Chrome answers those with an empty array; the universal stub answers with
 * `undefined`, and a bundle doing
 * `(await chrome.history.search({})).forEach(...)` dies on the difference —
 * impero and securly both did.
 *
 * An empty list is not a placeholder here, it is the truth: nothing has been
 * browsed or downloaded inside this host. Bookmarks graduated out of this
 * group into their own file (api/bookmarks.ts) once a real vendor
 * (impero) turned out to read a value out of one rather than just iterate
 * an empty list — the same reason storage/managed storage aren't here
 * either.
 */
export function buildEmptyCollections() {
    const none = async () => [];
    const listApi = (methods: string[], extra: Record<string, unknown> = {}) =>
        Object.fromEntries([
            ...methods.map(name => [name, none]),
            ...Object.entries(extra),
        ]);

    return {
        history: listApi(["search", "getVisits"], {
            addUrl: async () => {},
            deleteUrl: async () => {},
            deleteRange: async () => {},
            deleteAll: async () => {},
            onVisited: emptyEvent(),
            onVisitRemoved: emptyEvent(),
        }),
        downloads: listApi(["search"], {
            download: async () => 1,
            cancel: async () => {},
            pause: async () => {},
            resume: async () => {},
            erase: async () => [],
            removeFile: async () => {},
            onCreated: emptyEvent(),
            onChanged: emptyEvent(),
            onDeterminingFilename: emptyEvent(),
        }),
        cookies: listApi(["getAll", "getAllCookieStores"], {
            get: async () => null,
            set: async () => null,
            remove: async () => null,
            onChanged: emptyEvent(),
        }),
        sessions: listApi(["getRecentlyClosed", "getDevices"], {
            restore: async () => undefined,
            onChanged: emptyEvent(),
        }),
        topSites: { get: none },
        tabGroups: listApi(["query"], {
            get: async () => undefined,
            move: async () => undefined,
            update: async () => undefined,
            onCreated: emptyEvent(),
            onRemoved: emptyEvent(),
            onUpdated: emptyEvent(),
        }),
        contextMenus: {
            create: () => "1",
            update: async () => {},
            remove: async () => {},
            removeAll: async () => {},
            onClicked: emptyEvent(),
        },
        commands: {
            getAll: none,
            onCommand: emptyEvent(),
        },
        notifications: listApi(["getAll"], {
            create: async (id?: string) => id ?? "1",
            update: async () => false,
            clear: async () => false,
            getPermissionLevel: async () => "granted",
            onClicked: emptyEvent(),
            onClosed: emptyEvent(),
            onButtonClicked: emptyEvent(),
        }),
    };
}

function emptyEvent() {
    return {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false,
    };
}

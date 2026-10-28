import type { ShimOptions } from "../types";
import { buildActionAPI } from "./action";
import { buildAlarmsAPI } from "./alarms";
import {
    accessibilityFeatures,
    audio,
    certificateProvider,
    contentSettings,
    declarativeContent,
    declarativeWebRequest,
    desktopCapture,
    devtools,
    dom,
    enterprise,
    extensionTypes,
    fileBrowserHandler,
    fileSystemProvider,
    fontSettings,
    gcm,
    idle,
    input,
    instanceID,
    loginState,
    networking,
    omnibox,
    pageCapture,
    platformKeys,
    power,
    printerProvider,
    printing,
    printingMetrics,
    readingList,
    search,
    serial,
    sessions,
    socket,
    systemLog,
    tabCapture,
    tabGroups,
    topSites,
    tts,
    ttsEngine,
    userScripts,
    vpnProvider,
    wallpaper,
    webAuthenticationProxy,
} from "./apis";
import { buildDNRAPI } from "./declarativeNetRequest";
import {
    bluetooth,
    bluetoothLowEnergy,
    bluetoothSocket,
    chromeEvents,
    clipboard,
    debugger_ as debuggerAPI,
    documentScan,
    enterpriseHardwarePlatform,
    enterpriseKioskApps,
    enterpriseLogin,
    feedback,
    hid,
    mdns,
    networkingOnc,
    processes,
    sockets,
    usb,
    webstore,
} from "./extra";
import { buildIdentityAPI } from "./identity";
import {
    buildBookmarksAPI,
    buildBrowsingDataAPI,
    buildCommandsAPI,
    buildContextMenusAPI,
    buildCookiesAPI,
    buildDnsAPI,
    buildDownloadsAPI,
    buildHistoryAPI,
    buildI18nAPI,
    buildManagementAPI,
    buildNotificationsAPI,
    buildOffscreenAPI,
    buildPermissionsAPI,
    buildPrivacyAPI,
    buildProxyAPI,
    buildSidePanelAPI,
    buildWebRequestAPI,
} from "./misc";
import { buildRuntimeAPI } from "./runtime";
import { buildScriptingAPI } from "./scripting";
import { silentEvent } from "./silentEvent";
import { buildStorageAPI } from "./storage";
import { buildSystemAPI } from "./system";
import { buildTabsAPI } from "./tabs";
import { buildBackgroundUserScripts } from "./userScriptsBackground";
import { listenForUserScripts } from "./userScriptsContent";
import { dispatchBrowserEvent, extUrl, getBiB, initBiB } from "./util";
import { buildWebNavigationAPI } from "./webNavigation";
import { buildWindowsAPI } from "./windows";

declare const __CIVIL_SHIM_OPTIONS__: ShimOptions;

type ShimContext = {
    opts: ShimOptions;
    extId: string;
    contextType: NonNullable<ShimOptions["contextType"]>;
    bib: ReturnType<typeof getBiB>;
    features: NonNullable<ReturnType<typeof getBiB>["features"]>;
};

/** The namespace a feature flag allows, or an empty one when it's off. */
function gated<T>(flag: boolean | undefined, build: () => T) {
    return flag !== false ? build() : buildNoopNamespace();
}

/** Messaging, storage, tabs and the request rules that tabs consults. */
function buildCoreApis({ extId, opts, contextType, features }: ShimContext) {
    const runtime = buildRuntimeAPI(extId, opts.manifest, contextType);
    const storage = buildStorageAPI(opts.storageData ?? {}, extId);
    const dnr =
        features.declarativeNetRequest !== false
            ? buildDNRAPI(extId)
            : buildDNRStub();
    const getDNRRules = () =>
        "_getAllRules" in dnr && typeof dnr._getAllRules === "function"
            ? (dnr._getAllRules as () => import("../types").DNRRule[])()
            : [];
    const tabs = buildTabsAPI(
        extId,
        runtime._contextId,
        getDNRRules,
        contextType,
    );
    const windows = buildWindowsAPI();
    const action = buildActionAPI();
    const scripting = buildScriptingAPI(contextType, extId);
    const webNavigation = gated(features.webNavigation, () =>
        buildWebNavigationAPI(extId),
    );
    return {
        runtime,
        storage,
        tabs,
        windows,
        action,
        browserAction: action,
        pageAction: action,
        scripting,
        declarativeNetRequest: dnr,
        webNavigation,
        getDNRRules,
    };
}

function buildPageApis(
    { contextType, features }: ShimContext,
    getDNRRules: ReturnType<typeof buildCoreApis>["getDNRRules"],
) {
    const i18n = buildI18nAPI();
    const permissions = buildPermissionsAPI();
    const contextMenus = gated(features.contextMenus, buildContextMenusAPI);
    const webRequest = gated(features.webRequest, () =>
        buildWebRequestAPI(getDNRRules, contextType === "background"),
    );
    const notifications = gated(features.notifications, buildNotificationsAPI);
    return { i18n, permissions, contextMenus, webRequest, notifications };
}

function buildBrowserDataApis({
    extId,
    opts,
    contextType,
    features,
}: ShimContext) {
    const browsingData = buildBrowsingDataAPI();
    const management = buildManagementAPI();
    const offscreen = buildOffscreenAPI(
        extId,
        opts.manifest as Record<string, unknown>,
        contextType,
    );
    const sidePanel = buildSidePanelAPI();
    const privacy = gated(features.privacy, buildPrivacyAPI);
    const proxy = gated(features.proxy, buildProxyAPI);
    const dns = buildDnsAPI();
    const cookies = gated(features.cookies, buildCookiesAPI);
    const history = gated(features.history, buildHistoryAPI);
    const bookmarks = buildBookmarksAPI();
    const commands = buildCommandsAPI(
        opts.manifest as Parameters<typeof buildCommandsAPI>[0],
    );
    const downloads = gated(features.downloads, buildDownloadsAPI);
    const alarms = gated(features.alarms, buildAlarmsAPI);
    return {
        browsingData,
        management,
        offscreen,
        sidePanel,
        privacy,
        proxy,
        dns,
        cookies,
        history,
        bookmarks,
        commands,
        downloads,
        alarms,
    };
}

function buildExtensionAPI(
    extId: string,
    runtime: ReturnType<typeof buildRuntimeAPI>,
    incognito: boolean,
) {
    const deny = (cb?: (allowed: boolean) => void) => {
        if (cb) cb(false);
        return Promise.resolve(false);
    };
    return {
        getURL: (path: string) => extUrl(extId, path),
        getBackgroundPage: () => null as Window | null,
        getViews: (_fetchProperties?: unknown) => [] as Window[],
        isAllowedIncognitoAccess: deny,
        isAllowedFileSchemeAccess: deny,
        sendRequest: runtime.sendMessage,
        sendMessage: runtime.sendMessage,
        onRequest: runtime.onMessage,
        onMessage: runtime.onMessage,
        onRequestExternal: runtime.onMessageExternal,
        onMessageExternal: runtime.onMessageExternal,
        inIncognitoContext: incognito,
        lastError: null as { message: string } | null,
        getExtensionTabs: () => [] as unknown[],
    };
}

const notControllable = () => ({
    value: undefined,
    levelOfControl: "not_controllable",
});

class ChromeSetting {
    onChange = silentEvent();
    get(_d: unknown, cb?: (d: unknown) => void) {
        if (cb) cb(notControllable());
        return Promise.resolve(notControllable());
    }
    set(_d: unknown, cb?: () => void) {
        if (cb) cb();
        return Promise.resolve();
    }
    clear(_d: unknown, cb?: () => void) {
        if (cb) cb();
        return Promise.resolve();
    }
}

/** chrome.userScripts for this context: a registry in the background, the
 *  plain namespace elsewhere, nothing when the feature is off. */
function userScriptsFor({ extId, opts, features }: ShimContext) {
    if (features.userScripts === false) return buildNoopNamespace();
    return opts.contextType === "background"
        ? buildBackgroundUserScripts(extId)
        : userScripts;
}

function buildPlatformApis(ctx: ShimContext) {
    const { features } = ctx;
    return {
        accessibilityFeatures,
        audio,
        certificateProvider,
        contentSettings: gated(features.contentSettings, () => contentSettings),
        declarativeContent,
        declarativeWebRequest,
        desktopCapture,
        devtools: features.devtools !== false ? devtools : undefined,
        dom,
        enterprise: {
            ...enterprise,
            hardwarePlatform: enterpriseHardwarePlatform,
            kioskApps: enterpriseKioskApps,
            login: enterpriseLogin,
        },
        events: chromeEvents,
        extensionTypes,
        fileBrowserHandler,
        fileSystemProvider,
        fontSettings: gated(features.fontSettings, () => fontSettings),
        gcm,
        idle: gated(features.idle, () => idle),
        input,
        instanceID,
        loginState,
        networking: { ...networking, onc: networkingOnc },
        omnibox: gated(features.omnibox, () => omnibox),
        pageCapture: gated(features.pageCapture, () => pageCapture),
        platformKeys,
        power,
        printerProvider,
        printing,
        printingMetrics,
        readingList,
        search: gated(features.search, () => search),
        serial,
        sessions: gated(features.sessions, () => sessions),
        socket,
        sockets,
        systemLog,
        tabCapture,
        tabGroups: gated(features.tabGroups, () => tabGroups),
        topSites,
        tts: gated(features.tts, () => tts),
        ttsEngine,
        userScripts: userScriptsFor(ctx),
        vpnProvider,
        wallpaper,
        webAuthenticationProxy,
    };
}

const HARDWARE_APIS = {
    bluetooth,
    bluetoothLowEnergy,
    bluetoothSocket,
    clipboard,
    debugger: debuggerAPI,
    documentScan,
    feedback,
    hid,
    mdns,
    processes,
    usb,
    webstore,
    cast: undefined,
    app: {
        getDetails: () => null,
        getIsInstalled: () => false,
        InstallState: {},
        RunningState: {},
    },
};

function buildChrome(ctx: ShimContext) {
    const { getDNRRules, ...core } = buildCoreApis(ctx);
    return {
        ...core,
        ...buildPageApis(ctx, getDNRRules),
        ...buildBrowserDataApis(ctx),
        extension: buildExtensionAPI(
            ctx.extId,
            core.runtime,
            ctx.bib.incognito,
        ),
        types: { ChromeSetting },
        ...buildPlatformApis(ctx),
        ...HARDWARE_APIS,
        identity: buildIdentityAPI(ctx.extId),
        system: buildSystemAPI(),
    };
}

(() => {
    if ((window as unknown as Record<string, unknown>).__civil_chrome_injected)
        return;
    // NOTE: flag is set AFTER w.chrome = chrome so that if the IIFE crashes
    // mid-init, the next injection attempt can retry rather than being blocked
    // by a stuck flag on a context where chrome was never set.

    const opts: ShimOptions = __CIVIL_SHIM_OPTIONS__;
    initBiB(opts.bib, window.location.origin);
    const bib = getBiB();
    const chrome = buildChrome({
        opts,
        extId: opts.extId,
        contextType: opts.contextType ?? "content",
        bib,
        features: bib.features ?? {},
    });

    const w = window as unknown as Record<string, unknown>;
    w.chrome = chrome;
    w.browser = chrome;
    w.__civil_chrome_injected = true;

    // Intercept window.open and <a> clicks for chrome-extension:// URLs so
    // that popup/content pages that navigate via window.open or plain links
    // instead of chrome.tabs.create still open as Civil browser tabs.
    if (opts.contextType === "popup" || opts.contextType === "content") {
        interceptExtensionNavigation(bib.newTabEvent);
    }

    if (opts.contextType === "content") {
        listenForUserScripts(
            opts.extId,
            () => bib.currentTab?.url,
            message => chrome.runtime.sendMessage(message),
        );
    }
})();

/**
 * Opens `chrome-extension://` and `moz-extension://` URLs as Civil tabs when a
 * popup or content page reaches them through window.open or a plain link
 * rather than chrome.tabs.create.
 */
function interceptExtensionNavigation(newTabEvent: string): void {
    try {
        const _nativeOpen = window.open.bind(window);
        window.open = (
            url?: string | URL,
            target?: string,
            windowFeatures?: string,
        ) => {
            const urlStr = url ? String(url) : "";
            if (
                urlStr.startsWith("chrome-extension://") ||
                urlStr.startsWith("moz-extension://")
            ) {
                dispatchBrowserEvent(newTabEvent, { url: urlStr });
                return null;
            }
            return _nativeOpen(url as string, target, windowFeatures);
        };
    } catch {}

    try {
        document.addEventListener(
            "click",
            (e: MouseEvent) => {
                const a = (e.target as Element | null)?.closest?.("a");
                if (!a) return;
                const href = (a as HTMLAnchorElement).href ?? "";
                if (
                    href.startsWith("chrome-extension://") ||
                    href.startsWith("moz-extension://")
                ) {
                    e.preventDefault();
                    e.stopPropagation();
                    dispatchBrowserEvent(newTabEvent, { url: href });
                }
            },
            true, // capture phase: fires before page handlers
        );
    } catch {}
}

function buildNoopNamespace(): Record<string, unknown> {
    return {};
}

function buildDNRStub() {
    const noop2 = (_a?: unknown, _b?: unknown, cb?: () => void) => {
        if (cb) cb();
        return Promise.resolve();
    };
    return {
        updateDynamicRules: noop2,
        getDynamicRules: (_a?: unknown, cb?: (r: unknown[]) => void) => {
            if (cb) cb([]);
            return Promise.resolve([]);
        },
        updateSessionRules: noop2,
        getSessionRules: (_a?: unknown, cb?: (r: unknown[]) => void) => {
            if (cb) cb([]);
            return Promise.resolve([]);
        },
        updateEnabledRulesets: noop2,
        getEnabledRulesets: (cb?: (r: string[]) => void) => {
            if (cb) cb([]);
            return Promise.resolve([]);
        },
        getAvailableStaticRuleCount: (cb?: (n: number) => void) => {
            if (cb) cb(0);
            return Promise.resolve(0);
        },
        isRegexSupported: (
            _o: unknown,
            cb?: (r: { isSupported: boolean }) => void,
        ) => {
            if (cb) cb({ isSupported: true });
            return Promise.resolve({ isSupported: true });
        },
        onRuleMatchedDebug: silentEvent(),
    };
}

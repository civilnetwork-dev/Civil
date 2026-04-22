import { appsAdd, appsGetAll, appsRemove } from "./apps";
import {
    chromeBookmarks,
    chromeContextMenus,
    chromeCookies,
    chromeHistory,
    chromeI18n,
    chromeNotifications,
    chromePermissions,
    chromeRuntime,
    chromeStorageLocal,
    chromeStorageSync,
    chromeTabs,
    chromeWebNavigation,
    chromeWebRequest,
    chromeWindows,
} from "./chromeApis";
import {
    devtoolsGetInstance,
    devtoolsInit,
    devtoolsSetTheme,
} from "./devtools";
import {
    extensionsApplyToIframe,
    extensionsGetAll,
    extensionsGetById,
    extensionsInstallCrx,
    extensionsInstallFromUrl,
    extensionsInstallXpi,
    extensionsSetEnabled,
    extensionsUninstall,
} from "./extensions";
import { getTFS } from "./fs";
import {
    gamesGetAll,
    gamesGetBySlug,
    gamesInstallBySlug,
    gamesInstallFromUrl,
    gamesInstallSwf,
    gamesUninstall,
} from "./games";
import {
    historyAdd,
    historyClear,
    historyDelete,
    historyGetAll,
    historyGetMethod,
    historySetMethod,
} from "./history";
import { iframeGetCurrentSrc, iframeOnSrcChange } from "./iframe";
import { civilStorage, openCivilDB } from "./storage";
import {
    tabsActivate,
    tabsCreate,
    tabsGet,
    tabsGetActive,
    tabsGetAll,
    tabsMove,
    tabsOnActivated,
    tabsOnCreated,
    tabsOnRemoved,
    tabsOnUpdated,
    tabsQuery,
    tabsRemove,
    tabsUpdate,
} from "./tabs";

let _dbRef: IDBDatabase | null = null;

async function getIDB(): Promise<IDBDatabase> {
    if (!_dbRef) _dbRef = await openCivilDB("civil-main-db", "main");
    return _dbRef;
}

export const civil = {
    browser: {
        /**
         * Manage proxied app shortcuts pinned to the apps page.
         */
        apps: {
            /**
             * Add a new app by its URL. Fetches the favicon from the page's `<link rel="icon">` tag,
             * compresses it byte-by-byte, and registers the app.
             */
            add: appsAdd,
            /** Get all installed apps. */
            getAll: appsGetAll,
            /** Remove an app by ID. */
            remove: appsRemove,
        },

        /**
         * Interact with and programmatically control browser tabs, closely matching the chrome.tabs API.
         */
        tabs: {
            /** Get a single tab by its ID. */
            get: tabsGet,
            /** Query tabs by criteria (active, url, title). */
            query: tabsQuery,
            /** Create a new tab. */
            create: tabsCreate,
            /** Update an existing tab's URL or active state. */
            update: tabsUpdate,
            /** Close/remove a tab by ID. */
            remove: tabsRemove,
            /** Move a tab to a new index. */
            move: tabsMove,
            /** Activate (focus) a tab by ID. */
            activate: tabsActivate,
            /** Get the currently active tab. */
            getActive: tabsGetActive,
            /** Get all open tabs. */
            getAll: tabsGetAll,
            onCreated: { addListener: tabsOnCreated },
            onRemoved: { addListener: tabsOnRemoved },
            onUpdated: { addListener: tabsOnUpdated },
            onActivated: { addListener: tabsOnActivated },
        },

        /**
         * Iframe introspection API.
         */
        iframe: {
            /**
             * The current proxied src of the active browser iframe. Readonly.
             */
            get currentSrc(): string {
                return iframeGetCurrentSrc();
            },
            /**
             * Subscribe to src changes on the active iframe.
             */
            onSrcChange: iframeOnSrcChange,
        },

        /**
         * Devtools API powered by chii from liriliri. Call `.init()` first.
         */
        devtools: {
            /**
             * Initialize the chii devtools iframe overlay.
             * Must be called before any other devtools methods.
             * @param targetOrigin - The origin where chii is served. Defaults to window.location.origin.
             */
            init: devtoolsInit,

            /**
             * Extract CSS custom properties from a theme CSS URL and inject them into the chii devtools.
             * Supports `/* @name ThemeName *\/` comments for naming themes.
             * Pre-made themes: use `/themes/catppuccin-macchiato-devtools.css`
             * @param cssUrl - URL to a CSS file containing custom property definitions.
             */
            setTheme: devtoolsSetTheme,

            /**
             * The current chii instance (contains all chii methods: show, hide, toggle, reload, resize, destroy).
             * Returns null if `.init()` has not been called.
             */
            get chii() {
                return devtoolsGetInstance();
            },
        },

        /**
         * TFS (TerbiumOS File System) instance — OPFS-backed virtual filesystem.
         * All methods are from TerbiumOS/tfs. Requires async initialization.
         */
        get fs() {
            return getTFS();
        },

        /**
         * Browser extension API for installing and managing .crx and .xpi extensions.
         * Extensions are stored in TFS and their content scripts are injected into proxy iframes.
         */
        extensions: {
            /** Install a Chrome extension from a raw CRX Uint8Array or ArrayBuffer. */
            installCrx: extensionsInstallCrx,
            /** Install a Firefox extension from a raw XPI Uint8Array or ArrayBuffer. */
            installXpi: extensionsInstallXpi,
            /** Install an extension from a URL (auto-detects .crx or .xpi). */
            installFromUrl: extensionsInstallFromUrl,
            /** Get all installed extensions. */
            getAll: extensionsGetAll,
            /** Get an extension by its ID. */
            getById: extensionsGetById,
            /** Enable or disable an installed extension. */
            setEnabled: extensionsSetEnabled,
            /** Uninstall an extension by ID, removing it from TFS and the index. */
            uninstall: extensionsUninstall,
            /**
             * Inject all enabled extensions' content scripts into a given iframe.
             * Called automatically by the iframe manager for non-internal pages.
             */
            applyToIframe: extensionsApplyToIframe,
        },

        /**
         * Browser history API. Backed by localStorage or IndexedDB depending on user preference.
         */
        history: {
            /** Add a URL to history. */
            add: historyAdd,
            /** Get all history entries, sorted newest first. */
            getAll: historyGetAll,
            /** Delete a single history entry by ID. */
            delete: historyDelete,
            /** Clear all history. */
            clear: historyClear,
            /** Set the storage method: 'localstorage' or 'indexeddb'. */
            setMethod: historySetMethod,
            /** Get the current storage method. */
            getMethod: historyGetMethod,
        },

        /**
         * Games API for installing HTML5 and SWF games to TFS via the Civil games CDN.
         */
        games: {
            /**
             * Install a game by its slug from games.civil.quartinal.me.
             */
            installBySlug: gamesInstallBySlug,
            /**
             * Install a game from a direct HTML5 URL.
             */
            installFromUrl: gamesInstallFromUrl,
            /**
             * Install a game from a .swf file URL. Uses Ruffle for playback.
             */
            installSwf: gamesInstallSwf,
            /** Get all installed games. */
            getAll: gamesGetAll,
            /** Get a game by slug. */
            getBySlug: gamesGetBySlug,
            /** Uninstall a game by slug. */
            uninstall: gamesUninstall,
        },

        /**
         * localStorage access for civil extensions.
         */
        storage: civilStorage,

        /**
         * IndexedDB access for civil extensions.
         */
        get db(): Promise<IDBDatabase> {
            return getIDB();
        },
    },

    /**
     * Full chrome.* and browser.* compatible extension API surface.
     */
    chrome: {
        runtime: chromeRuntime,
        tabs: chromeTabs,
        storage: {
            local: chromeStorageLocal,
            sync: chromeStorageSync,
        },
        windows: chromeWindows,
        contextMenus: chromeContextMenus,
        i18n: chromeI18n,
        permissions: chromePermissions,
        notifications: chromeNotifications,
        cookies: chromeCookies,
        history: chromeHistory,
        bookmarks: chromeBookmarks,
        webNavigation: chromeWebNavigation,
        webRequest: chromeWebRequest,
    },
};

if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).civil = civil;
    (window as unknown as Record<string, unknown>).browser = civil.chrome;
    (window as unknown as Record<string, unknown>).chrome = civil.chrome;
}

export type CivilAPI = typeof civil;

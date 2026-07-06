export type StorageData = Record<string, unknown>;

export interface BiBConfig {
    extPrefix?: string;

    origin?: string;

    storagePersistence?:
        | "localStorage"
        | "sessionStorage"
        | "none"
        | "postMessage";

    storageKey?: string;

    newTabEvent?: string;

    navigateEvent?: string;

    closeTabEvent?: string;

    storagePostMessageType?: string;

    storageSyncMessageType?: string;

    platformInfo?: {
        os?:
            | "mac"
            | "win"
            | "android"
            | "cros"
            | "linux"
            | "openbsd"
            | "fuchsia";
        arch?: "arm" | "arm64" | "x86-32" | "x86-64" | "mips" | "mips64";
        nacl_arch?: string;
    };

    currentTab?: Partial<SyntheticTab>;

    currentWindow?: Partial<SyntheticWindow>;

    incognito?: boolean;

    messages?: Record<
        string,
        { message: string; placeholders?: Record<string, { content: string }> }
    >;

    features?: {
        alarms?: boolean;
        contentSettings?: boolean;
        contextMenus?: boolean;
        cookies?: boolean;
        declarativeNetRequest?: boolean;
        devtools?: boolean;
        downloads?: boolean;
        fontSettings?: boolean;
        history?: boolean;
        idle?: boolean;
        notifications?: boolean;
        omnibox?: boolean;
        pageCapture?: boolean;
        privacy?: boolean;
        proxy?: boolean;
        search?: boolean;
        sessions?: boolean;
        tabGroups?: boolean;
        tts?: boolean;
        userScripts?: boolean;
        webNavigation?: boolean;
        webRequest?: boolean;
    };
}

export interface SyntheticTab {
    id: number;
    index: number;
    windowId: number;
    url: string;
    title: string;
    favIconUrl: string;
    status: "loading" | "complete" | "unloaded";
    active: boolean;
    pinned: boolean;
    incognito: boolean;
    groupId: number;
}

export interface SyntheticWindow {
    id: number;
    focused: boolean;
    state:
        | "normal"
        | "minimized"
        | "maximized"
        | "fullscreen"
        | "locked-fullscreen";
    type: "normal" | "popup" | "panel" | "app" | "devtools";
    width: number;
    height: number;
    top: number;
    left: number;
    incognito: boolean;
}

export interface ShimOptions {
    extId: string;
    manifest: ChromeManifest;

    storageData?: StorageData;
    bib?: BiBConfig;

    origin?: string;
    contextType?: "background" | "content" | "popup" | "offscreen";
}

export interface ChromeManifest {
    manifest_version: 2 | 3;
    name: string;
    version: string;
    description?: string;
    icons?: Record<string, string>;
    permissions?: string[];
    optional_permissions?: string[];
    host_permissions?: string[];
    optional_host_permissions?: string[];
    content_scripts?: ContentScript[];
    background?: {
        service_worker?: string;
        scripts?: string[];
        page?: string;
        persistent?: boolean;
        type?: "module" | "classic";
    };
    action?: ActionDef;
    browser_action?: ActionDef;
    page_action?: ActionDef;
    options_page?: string;
    options_ui?: { page: string; open_in_tab?: boolean };
    web_accessible_resources?:
        | string[]
        | Array<{
              resources: string[];
              matches: string[];
              extension_ids?: string[];
          }>;
    content_security_policy?:
        | string
        | { extension_pages?: string; sandbox?: string };
    minimum_chrome_version?: string;
    key?: string;
    short_name?: string;
    default_locale?: string;
    externally_connectable?: {
        matches?: string[];
        ids?: string[];
        accepts_tls_channel_id?: boolean;
    };
    omnibox?: { keyword: string };
    tts_engine?: {
        voices: Array<{
            voice_name: string;
            lang?: string;
            gender?: string;
            event_types?: string[];
        }>;
    };
    user_scripts?: { api_root?: string };
    declarative_net_request?: {
        rule_resources?: Array<{ id: string; enabled: boolean; path: string }>;
    };
    [key: string]: unknown;
}

export interface FirefoxManifest extends ChromeManifest {
    browser_specific_settings?: {
        gecko?: { id?: string; strict_min_version?: string };
    };
}

export interface ContentScript {
    matches?: string[];
    exclude_matches?: string[];
    css?: string[];
    js?: string[];
    run_at?: "document_start" | "document_end" | "document_idle";
    all_frames?: boolean;
    world?: "MAIN" | "ISOLATED";
}

export interface ActionDef {
    default_icon?: string | Record<string, string>;
    default_title?: string;
    default_popup?: string;
}

export interface Port {
    name: string;
    disconnect(): void;
    postMessage(message: unknown): void;
    onMessage: ChromeEvent<(message: unknown, port: Port) => void>;
    onDisconnect: ChromeEvent<(port: Port) => void>;
    sender?: MessageSender;
    error?: { message: string };
}

export interface MessageSender {
    tab?: chrome.tabs.Tab;
    frameId?: number;
    id?: string;
    url?: string;
    origin?: string;
    tlsChannelId?: string;
    documentId?: string;
    documentLifecycle?: string;
}

export interface ChromeEvent<TCallback extends (...args: never[]) => unknown> {
    addListener(callback: TCallback): void;
    removeListener(callback: TCallback): void;
    hasListener(callback: TCallback): boolean;
    hasListeners(): boolean;
}

export interface Alarm {
    name: string;
    scheduledTime: number;
    periodInMinutes?: number;
}

export interface AlarmCreateInfo {
    when?: number;
    delayInMinutes?: number;
    periodInMinutes?: number;
}

export interface DNRRule {
    id: number;
    priority?: number;
    action: { type: string; [k: string]: unknown };
    condition: { [k: string]: unknown };
}

export interface TabInfo {
    id: string;
    index: number;
    windowId: number;
    highlighted: boolean;
    active: boolean;
    pinned: boolean;
    audible?: boolean;
    discarded: boolean;
    autoDiscardable: boolean;
    mutedInfo?: { muted: boolean };
    url?: string;
    pendingUrl?: string;
    title?: string;
    favIconUrl?: string;
    status?: "loading" | "complete" | "unloaded";
    incognito: boolean;
    width?: number;
    height?: number;
    sessionId?: string;
    groupId: number;
    openerTabId?: string;
}

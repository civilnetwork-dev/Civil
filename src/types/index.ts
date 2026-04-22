export interface CivilApp {
    id: string;
    name: string;
    url: string;
    icon: string | null;
    addedAt: number;
}

export interface CivilBookmark {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    addedAt: number;
}

export interface CivilHistoryEntry {
    id: string;
    url: string;
    title: string;
    visitedAt: number;
    favicon?: string;
}

export type HistoryStorageMethod = "localstorage" | "indexeddb";

export interface CivilExtension {
    id: string;
    name: string;
    version: string;
    manifest: ChromeManifest | FirefoxManifest;
    type: "crx" | "xpi";
    files: Map<string, Uint8Array>;
    enabled: boolean;
}

export interface ChromeManifest {
    manifest_version: 2 | 3;
    name: string;
    version: string;
    description?: string;
    icons?: Record<string, string>;
    background?: {
        service_worker?: string;
        scripts?: string[];
        page?: string;
    };
    content_scripts?: {
        matches: string[];
        js?: string[];
        css?: string[];
        run_at?: string;
    }[];
    permissions?: string[];
    browser_action?: {
        default_icon?: string;
        default_popup?: string;
        default_title?: string;
    };
    action?: {
        default_icon?: string;
        default_popup?: string;
        default_title?: string;
    };
    web_accessible_resources?:
        | string[]
        | { resources: string[]; matches: string[] }[];
}

export interface FirefoxManifest extends ChromeManifest {
    browser_specific_settings?: {
        gecko?: { id?: string; strict_min_version?: string };
    };
}

export interface CivilGame {
    slug: string;
    title: string;
    type: "html5" | "swf";
    url: string;
    installedAt: number;
}

export interface DevtoolsTheme {
    name: string;
    cssUrl: string;
    variables: Record<string, string>;
}

export interface CivilTabInfo {
    id: string;
    url: string;
    title: string;
    favicon?: string;
    active: boolean;
    index: number;
}

export interface CivilTabQueryInfo {
    active?: boolean;
    url?: string;
    title?: string;
}

export interface CivilTabUpdateProperties {
    url?: string;
    active?: boolean;
}

export interface CivilTabCreateProperties {
    url?: string;
    active?: boolean;
}

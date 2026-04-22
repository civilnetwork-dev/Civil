import type { DevtoolsTheme } from "~/types";

let _chiiInstance: ChiiInstance | null = null;
let _iframe: HTMLIFrameElement | null = null;
let _currentThemeStyle: HTMLStyleElement | null = null;

export interface ChiiInstance {
    /** The underlying iframe element hosting the chii devtools UI. */
    element: HTMLIFrameElement;
    /** Show the devtools panel. */
    show: () => void;
    /** Hide the devtools panel. */
    hide: () => void;
    /** Toggle the devtools panel visibility. */
    toggle: () => void;
    /** Reload the devtools panel. */
    reload: () => void;
    /** Resize the devtools panel to a given height (px). */
    resize: (height: number) => void;
    /** Destroy the devtools instance and remove it from DOM. */
    destroy: () => void;
}

/**
 * Initialize the chii devtools instance, embedding it as an iframe overlay.
 * Must be called before any other devtools methods.
 */
export function devtoolsInit(
    targetOrigin: string = window.location.origin,
): ChiiInstance {
    if (_chiiInstance) return _chiiInstance;

    const iframe = document.createElement("iframe");
    iframe.src = `${targetOrigin}/chii/`;
    iframe.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 300px;
        z-index: 99999;
        border: none;
        border-top: 1px solid rgba(255,255,255,0.08);
        display: block;
        background: transparent;
    `;
    document.body.appendChild(iframe);
    _iframe = iframe;

    _chiiInstance = {
        element: iframe,
        show: () => {
            iframe.style.display = "block";
        },
        hide: () => {
            iframe.style.display = "none";
        },
        toggle: () => {
            iframe.style.display =
                iframe.style.display === "none" ? "block" : "none";
        },
        reload: () => {
            if (iframe.contentWindow) {
                iframe.contentWindow.location.reload();
            } else {
                const currentSrc = iframe.src;
                iframe.src = "";
                iframe.src = currentSrc;
            }
        },
        resize: (h: number) => {
            iframe.style.height = `${h}px`;
        },
        destroy: () => {
            iframe.remove();
            _chiiInstance = null;
            _iframe = null;
            if (_currentThemeStyle) {
                _currentThemeStyle.remove();
                _currentThemeStyle = null;
            }
        },
    };

    return _chiiInstance;
}

/**
 * Extract CSS custom properties from a remote theme CSS URL and inject them
 * into the chii iframe at load time.
 */
export async function devtoolsSetTheme(cssUrl: string): Promise<DevtoolsTheme> {
    if (!_iframe)
        throw new Error("civil.browser.devtools.init() must be called first");

    const res = await fetch(cssUrl);
    const css = await res.text();

    const varRegex = /--([\w-]+)\s*:\s*([^;}\n]+)/g;
    const variables: Record<string, string> = {};
    let match: RegExpExecArray | null = varRegex.exec(css);
    while (match !== null) {
        variables[`--${match[1].trim()}`] = match[2].trim();
        match = varRegex.exec(css);
    }

    const nameMatch = css.match(/\/\*\s*@name\s+(.+?)\s*\*\//);
    const name =
        nameMatch?.[1] ??
        cssUrl.split("/").pop()?.replace(".css", "") ??
        "Custom Theme";

    const injected = `:root { ${Object.entries(variables)
        .map(([k, v]) => `${k}: ${v};`)
        .join(" ")} }`;

    if (_currentThemeStyle) _currentThemeStyle.remove();

    const style = document.createElement("style");
    style.textContent = injected;

    if (_iframe.contentDocument?.head) {
        _iframe.contentDocument.head.appendChild(style);
        _currentThemeStyle = style;
    } else {
        _iframe.addEventListener(
            "load",
            () => {
                _iframe!.contentDocument?.head?.appendChild(style);
            },
            { once: true },
        );
        _currentThemeStyle = style;
    }

    return { name, cssUrl, variables };
}

export function devtoolsGetInstance(): ChiiInstance | null {
    return _chiiInstance;
}

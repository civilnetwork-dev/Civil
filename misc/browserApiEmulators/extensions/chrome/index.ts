export type {
    Alarm,
    AlarmCreateInfo,
    BiBConfig,
    ChromeEvent,
    ChromeManifest,
    ContentScript,
    DNRRule,
    FirefoxManifest,
    MessageSender,
    Port,
    ShimOptions,
    StorageData,
    SyntheticTab,
    SyntheticWindow,
    TabInfo,
} from "./types";

import SHIM_SOURCE from "virtual:civil-ext-shim-source";

/** The raw (un-substituted) shim IIFE compiled by rolldown. Exported so callers
 *  can store it for runtime injection (e.g. offscreen documents) where options
 *  are provided via window.__CIVIL_SHIM_OPTIONS__ instead of being baked in. */
export { SHIM_SOURCE as RAW_SHIM_SOURCE };

const DEV_SHIM_PATH = "/civil-ext-shim.js";

export function buildChromeShim(opts: import("./types").ShimOptions): string {
    const { extId, manifest, storageData = {} } = opts;

    const optsJson = JSON.stringify(
        {
            extId,
            manifest,
            storageData,
            bib: opts.bib,
            contextType: opts.contextType ?? "content",
        } satisfies import("./types").ShimOptions,
        (_key, value) => {
            if (typeof value === "function") return undefined;
            return value as unknown;
        },
    );

    if (SHIM_SOURCE) {
        // The compiled shim contains TWO occurrences of "__CIVIL_SHIM_OPTIONS__":
        //   1. Inside buildOffscreenAPI's template string: window.__CIVIL_SHIM_OPTIONS__=
        //   2. The actual identifier reference:           const opts = __CIVIL_SHIM_OPTIONS__
        // We must replace only occurrence #2. Match the full assignment context so we
        // never accidentally hit the template-string occurrence.
        // Use a function replacer to prevent $ in optsJson from being
        // interpreted as special replacement patterns ($&, $', $`, $n, $$).
        const marker = "const opts = __CIVIL_SHIM_OPTIONS__";
        const idx = SHIM_SOURCE.lastIndexOf(marker);
        if (idx !== -1) {
            return (
                SHIM_SOURCE.slice(0, idx) +
                `const opts = ${optsJson}` +
                SHIM_SOURCE.slice(idx + marker.length)
            );
        }
        // Fallback: generic replace (shouldn't be reached)
        return SHIM_SOURCE.replace("__CIVIL_SHIM_OPTIONS__", () => optsJson);
    }

    return `
(function() {
  if (window.__civil_chrome_injected) return;
  var s = document.createElement('script');
  s.src = ${JSON.stringify(DEV_SHIM_PATH)};
  s.onload = function() {
    if (typeof window.__civilInstallShim === 'function') {
      window.__civilInstallShim(${optsJson});
    }
  };
  document.head.prepend(s);
})();
`.trim();
}

export function resolveExtIcon(
    extId: string,
    manifest: import("./types").ChromeManifest,
    preferredSize = 48,
): string | null {
    const icons =
        manifest.icons ??
        (
            manifest.browser_action as
                | { default_icon?: Record<string, string> }
                | undefined
        )?.default_icon ??
        (
            manifest.action as
                | { default_icon?: Record<string, string> }
                | undefined
        )?.default_icon;

    if (!icons) return null;
    if (typeof icons === "string") return `/civil-ext/${extId}/${icons}`;

    const sizes = Object.keys(icons)
        .map(Number)
        .filter(n => !Number.isNaN(n))
        .toSorted((a, b) => a - b);
    if (sizes.length === 0) return null;

    const best =
        sizes.find(s => s >= preferredSize) ?? sizes[sizes.length - 1]!;
    const path = (icons as Record<string, string>)[String(best)];
    return path ? `/civil-ext/${extId}/${path}` : null;
}

export function resolveExtPopupUrl(
    extId: string,
    manifest: import("./types").ChromeManifest,
): string | null {
    const popup =
        (manifest.action as { default_popup?: string } | undefined)
            ?.default_popup ??
        (manifest.browser_action as { default_popup?: string } | undefined)
            ?.default_popup ??
        null;
    return popup ? `/civil-ext/${extId}/${popup}` : null;
}

export function buildBackgroundShim(
    opts: import("./types").ShimOptions,
): string {
    return buildChromeShim({ ...opts, contextType: "background" });
}

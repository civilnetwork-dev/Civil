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

export function buildBackgroundShim(
    opts: import("./types").ShimOptions,
): string {
    return buildChromeShim({ ...opts, contextType: "background" });
}

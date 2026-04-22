// biome-ignore-all lint: chrome apis

import { buildChromeShim } from "@quartinal/extension-shim";
import type { ChromeManifest } from "~/types";
import { extensionsGetAll, extensionsReadText } from "./extensions";

export { buildChromeShim };

export async function injectExtensionShimsIntoIframe(
    iframe: HTMLIFrameElement,
): Promise<void> {
    const enabled = extensionsGetAll().filter(e => e.enabled);
    for (const ext of enabled) {
        try {
            const manifest = ext.manifest as ChromeManifest;
            const shim = buildChromeShim({
                extId: ext.id,
                manifest: manifest as any,
            });
            const iframeDoc = iframe.contentDocument;
            if (!iframeDoc) continue;

            const script = iframeDoc.createElement("script");
            script.textContent = shim;
            (iframeDoc.head ?? iframeDoc.documentElement)?.prepend(script);

            const cs = manifest.content_scripts ?? [];
            for (const rule of cs) {
                for (const cssPath of rule.css ?? []) {
                    try {
                        const raw = await extensionsReadText(ext.id, cssPath);
                        const el = iframeDoc.createElement("style");
                        el.textContent = raw;
                        iframeDoc.head?.appendChild(el);
                    } catch {}
                }
                for (const jsPath of rule.js ?? []) {
                    try {
                        const raw = await extensionsReadText(ext.id, jsPath);
                        const el = iframeDoc.createElement("script");
                        el.textContent = raw;
                        (iframeDoc.head ?? iframeDoc.body)?.appendChild(el);
                    } catch {}
                }
            }
        } catch (e) {
            console.error("[extensionRuntime] inject failed for", ext.id, e);
        }
    }
}

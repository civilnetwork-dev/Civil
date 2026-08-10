import { gstaticFavicon } from "~/lib/browserHelpers";
import { createReactiveJSON, lsSetJSON } from "~/lib/reactiveStorage";
import type { CivilApp } from "~/types";

const LS_KEY = "civil-apps";

/** Live, reactive list of installed apps. Updates on any add/remove. */
export const apps = createReactiveJSON<CivilApp[]>(LS_KEY, []);

function load(): CivilApp[] {
    return apps();
}

function save(list: CivilApp[]): void {
    try {
        lsSetJSON(LS_KEY, list);
    } catch (e) {
        console.error("[civil/apps] save() failed:", e);
    }
}

async function fetchWithCors(url: string): Promise<Response> {
    try {
        const direct = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (direct.ok) return direct;
    } catch {}
    return fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(6000),
    });
}

async function fetchIcon(pageUrl: string): Promise<string | null> {
    try {
        return await compressIcon(gstaticFavicon(pageUrl, 64));
    } catch (e) {
        console.warn("[civil/apps] fetchIcon() failed:", e);
        return null;
    }
}

async function compressIcon(iconUrl: string): Promise<string> {
    try {
        const res = await fetchWithCors(iconUrl);
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = 32;
                canvas.height = 32;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(img, 0, 0, 32, 32);
                resolve(canvas.toDataURL("image/png"));
            };
            img.onerror = e => {
                console.warn("[civil/apps] compressIcon() img load failed:", e);
                reject(e);
            };
            img.src = URL.createObjectURL(blob);
        });
    } catch (e) {
        console.warn("[civil/apps] compressIcon() fell back to raw url:", e);
        return iconUrl;
    }
}

// URL percent-encodes anything unusual in the host, so a bare `hostname` can
// reach the tile label as "not%20a%20valid". Decode it, and drop the "www."
// that otherwise takes up a third of the tile's one line of text.
function hostnameLabel(pageUrl: string): string {
    try {
        return decodeURIComponent(new URL(pageUrl).hostname).replace(
            /^www\./,
            "",
        );
    } catch {
        return pageUrl;
    }
}

async function fetchTitle(pageUrl: string): Promise<string> {
    console.log("[civil/apps] fetchTitle() for:", pageUrl);
    try {
        const res = await fetchWithCors(pageUrl);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.title.trim() || hostnameLabel(pageUrl);
    } catch (e) {
        console.warn("[civil/apps] fetchTitle() failed, using hostname:", e);
        return hostnameLabel(pageUrl);
    }
}

export async function appsAdd(url: string): Promise<CivilApp> {
    let normalized = url;
    try {
        new URL(url);
    } catch {
        normalized = `https://${url}`;
    }
    console.log("[civil/apps] appsAdd():", normalized);

    const [icon, title] = await Promise.all([
        fetchIcon(normalized),
        fetchTitle(normalized),
    ]);

    console.log(
        "[civil/apps] appsAdd() resolved - title:",
        title,
        "icon length:",
        icon?.length ?? 0,
    );

    const app: CivilApp = {
        id: crypto.randomUUID(),
        name: title,
        url: normalized,
        icon,
        addedAt: Date.now(),
    };

    const all = load();
    all.push(app);
    save(all);
    return app;
}

export function appsGetAll(): CivilApp[] {
    return load();
}

export function appsRemove(id: string): void {
    console.log("[civil/apps] appsRemove():", id);
    save(load().filter(a => a.id !== id));
}

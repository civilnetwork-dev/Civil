import type { CivilApp } from "~/types";

const LS_KEY = "civil-apps";

function load(): CivilApp[] {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch (e) {
        console.error("[civil/apps] load() parse failed:", e);
        return [];
    }
}

function save(apps: CivilApp[]): void {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(apps));
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
    console.log("[civil/apps] fetchIcon() for:", pageUrl);
    try {
        const res = await fetchWithCors(pageUrl);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const iconEl = doc.querySelector<HTMLLinkElement>(
            'link[rel~="icon"], link[rel~="apple-touch-icon"], link[rel~="shortcut"]',
        );
        const href = iconEl?.getAttribute("href");
        const iconUrl = href
            ? new URL(href, pageUrl).href
            : `${new URL(pageUrl).origin}/favicon.ico`;

        console.log("[civil/apps] fetchIcon(): raw icon url:", iconUrl);
        return await compressIcon(iconUrl);
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

async function fetchTitle(pageUrl: string): Promise<string> {
    console.log("[civil/apps] fetchTitle() for:", pageUrl);
    try {
        const res = await fetchWithCors(pageUrl);
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.title || new URL(pageUrl).hostname;
    } catch (e) {
        console.warn("[civil/apps] fetchTitle() failed, using hostname:", e);
        return new URL(pageUrl).hostname;
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
        "[civil/apps] appsAdd() resolved — title:",
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

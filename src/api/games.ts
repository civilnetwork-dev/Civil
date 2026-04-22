import type { CivilGame } from "~/types";
import { getTFS } from "./fs";

const GAMES_API = "https://games.civil.quartinal.me";
const LS_KEY = "civil-games";

function load(): CivilGame[] {
    try {
        return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]");
    } catch {
        return [];
    }
}

function save(games: CivilGame[]): void {
    localStorage.setItem(LS_KEY, JSON.stringify(games));
}

/**
 * Install a game by its slug from the Civil games API (HTML5).
 */
export async function gamesInstallBySlug(slug: string): Promise<CivilGame> {
    const res = await fetch(`${GAMES_API}/api/games/${slug}`);
    if (!res.ok) throw new Error(`Game "${slug}" not found on games API`);
    const data = await res.json();
    const game: CivilGame = {
        slug,
        title: data.title ?? slug,
        type: "html5",
        url: data.url ?? `${GAMES_API}/games/${slug}/index.html`,
        installedAt: Date.now(),
    };
    try {
        const tfs = await getTFS();
        try {
            await tfs.fs.promises.mkdir(`/games/${slug}`);
        } catch {}
        await tfs.fs.promises.writeFile(
            `/games/${slug}/meta.json`,
            JSON.stringify(game),
            "utf8",
        );
    } catch {}
    const all = load();
    if (!all.find(g => g.slug === slug)) all.push(game);
    save(all);
    return game;
}

/**
 * Install a game from a direct HTML5 game URL.
 */
export async function gamesInstallFromUrl(
    url: string,
    title?: string,
): Promise<CivilGame> {
    const slug = crypto.randomUUID();
    const game: CivilGame = {
        slug,
        title: title ?? new URL(url).hostname,
        type: "html5",
        url,
        installedAt: Date.now(),
    };
    try {
        const tfs = await getTFS();
        try {
            await tfs.fs.promises.mkdir(`/games/${slug}`);
        } catch {}
        await tfs.fs.promises.writeFile(
            `/games/${slug}/meta.json`,
            JSON.stringify(game),
            "utf8",
        );
    } catch {}
    const all = load();
    all.push(game);
    save(all);
    return game;
}

/**
 * Install a game from a .swf file URL. Uses Ruffle for playback.
 */
export async function gamesInstallSwf(
    swfUrl: string,
    title?: string,
): Promise<CivilGame> {
    const slug = crypto.randomUUID();
    const res = await fetch(swfUrl);
    const swfBytes = new Uint8Array(await res.arrayBuffer());
    const ruffleHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title ?? "SWF Game"}</title><script src="https://unpkg.com/@ruffle-rs/ruffle"></script></head><body style="margin:0;background:#000"><ruffle-player src="game.swf" width="100%" height="100vh"></ruffle-player></body></html>`;
    const game: CivilGame = {
        slug,
        title:
            title ?? swfUrl.split("/").pop()?.replace(".swf", "") ?? "SWF Game",
        type: "swf",
        url: swfUrl,
        installedAt: Date.now(),
    };
    try {
        const tfs = await getTFS();
        try {
            await tfs.fs.promises.mkdir(`/games/${slug}`);
        } catch {}
        await tfs.fs.promises.writeFile(
            `/games/${slug}/game.swf`,
            swfBytes.buffer as ArrayBuffer,
            "arraybuffer",
        );
        await tfs.fs.promises.writeFile(
            `/games/${slug}/index.html`,
            ruffleHtml,
            "utf8",
        );
        await tfs.fs.promises.writeFile(
            `/games/${slug}/meta.json`,
            JSON.stringify(game),
            "utf8",
        );
    } catch {}
    const all = load();
    all.push(game);
    save(all);
    return game;
}

export function gamesGetAll(): CivilGame[] {
    return load();
}

export function gamesGetBySlug(slug: string): CivilGame | null {
    return load().find(g => g.slug === slug) ?? null;
}

/**
 * Uninstall a game by its slug.
 */
export async function gamesUninstall(slug: string): Promise<void> {
    try {
        const tfs = await getTFS();
        await tfs.shell.promises.rm(`/games/${slug}`, { recursive: true });
    } catch {}
    save(load().filter(g => g.slug !== slug));
}

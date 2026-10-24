import { createReactiveJSON, lsSetJSON } from "~/lib/reactiveStorage";
import type { CivilGame } from "~/types";

import { getTFS } from "./fs";

const GAMES_API = "https://games.civil.quartinal.me";
const LS_KEY = "civil-games";

/** Live, reactive list of installed games. Updates on any install/uninstall. */
const games = createReactiveJSON<CivilGame[]>(LS_KEY, []);

function load(): CivilGame[] {
    return games();
}

function save(list: CivilGame[]): void {
    lsSetJSON(LS_KEY, list);
}

type GameFs = Awaited<ReturnType<typeof getTFS>>["fs"]["promises"];

/**
 * Stores a game under `/games/<slug>` (its assets, then `meta.json`) and adds
 * it to the installed list. A storage failure still installs the game; it only
 * loses its stored copy.
 */
async function saveGame(
    game: CivilGame,
    writeAssets?: (fs: GameFs, dir: string) => Promise<void>,
): Promise<CivilGame> {
    try {
        const { fs } = await getTFS();
        const dir = `/games/${game.slug}`;
        try {
            await fs.promises.mkdir(dir);
        } catch {}
        await writeAssets?.(fs.promises, dir);
        await fs.promises.writeFile(
            `${dir}/meta.json`,
            JSON.stringify(game),
            "utf8",
        );
    } catch {}
    const all = load();
    if (!all.some(g => g.slug === game.slug)) all.push(game);
    save(all);
    return game;
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
    return saveGame(game);
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
    return saveGame(game);
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
    return saveGame(game, async (fs, dir) => {
        await fs.writeFile(
            `${dir}/game.swf`,
            swfBytes.buffer as ArrayBuffer,
            "arraybuffer",
        );
        await fs.writeFile(`${dir}/index.html`, ruffleHtml, "utf8");
    });
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

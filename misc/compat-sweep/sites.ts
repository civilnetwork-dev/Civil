/**
 * Sites to sweep, skewed toward the teen / young-adult audience Civil targets.
 *
 * Hand-curated. The Similarweb MCP server's demographics endpoints (industry
 * age distribution, per-domain demographics, lead enrichment) all return 401
 * on the current plan, so a data-derived ranking was not available. Similarweb
 * also buckets ages starting at 18, so it could not have identified under-18
 * usage directly even with access.
 *
 * Ordering is roughly by how much it would hurt for the site to be broken.
 */

export const SITES: string[] = [
    // --- search / reference -------------------------------------------------
    "google.com",
    "bing.com",
    "duckduckgo.com",
    "wikipedia.org",
    "quizlet.com",
    "brainly.com",
    "chegg.com",
    "wolframalpha.com",
    "britannica.com",
    "sparknotes.com",

    // --- social -------------------------------------------------------------
    "reddit.com",
    "x.com",
    "instagram.com",
    "tiktok.com",
    "snapchat.com",
    "facebook.com",
    "pinterest.com",
    "tumblr.com",
    "discord.com",
    "bsky.app",
    "threads.net",
    "vsco.co",

    // --- video / streaming --------------------------------------------------
    "youtube.com",
    "twitch.tv",
    "netflix.com",
    "hulu.com",
    "disneyplus.com",
    "max.com",
    "primevideo.com",
    "vimeo.com",
    "dailymotion.com",
    "crunchyroll.com",

    // --- music --------------------------------------------------------------
    "spotify.com",
    "soundcloud.com",
    "music.apple.com",
    "bandcamp.com",
    "genius.com",
    "last.fm",

    // --- gaming -------------------------------------------------------------
    "roblox.com",
    "minecraft.net",
    "steampowered.com",
    "epicgames.com",
    "itch.io",
    "chess.com",
    "lichess.org",
    "coolmathgames.com",
    "poki.com",
    "crazygames.com",
    "geometrydash.io",
    "kahoot.it",
    "gartic.io",
    "skribbl.io",
    "agar.io",
    "krunker.io",

    // --- school / productivity ---------------------------------------------
    "classroom.google.com",
    "docs.google.com",
    "drive.google.com",
    "canvas.instructure.com",
    "schoology.com",
    "clever.com",
    "khanacademy.org",
    "desmos.com",
    "notion.so",
    "canva.com",
    "grammarly.com",
    "office.com",
    "onedrive.live.com",
    "zoom.us",
    "padlet.com",
    "edpuzzle.com",
    "ixl.com",
    "duolingo.com",
    "codecademy.com",
    "replit.com",
    "scratch.mit.edu",

    // --- ai tools -----------------------------------------------------------
    "chatgpt.com",
    "claude.ai",
    "gemini.google.com",
    "perplexity.ai",
    "character.ai",

    // --- shopping / food ----------------------------------------------------
    "amazon.com",
    "ebay.com",
    "shein.com",
    "temu.com",
    "depop.com",
    "etsy.com",
    "doordash.com",
    "target.com",
    "walmart.com",

    // --- news / sports / misc ----------------------------------------------
    "espn.com",
    "nytimes.com",
    "bbc.com",
    "imdb.com",
    "goodreads.com",
    "archiveofourown.org",
    "wattpad.com",
    "deviantart.com",
    "pixiv.net",
    "myanimelist.net",
    "github.com",
    "stackoverflow.com",
    "codepen.io",
    "weather.com",
    "speedtest.net",
];

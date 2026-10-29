/**
 * The Apps page's built-in shelf: well-known sites a student is likely to
 * want, grouped the way the chips filter them. Owner's call (2026-10-25): the
 * Apps page is a small store as well as the reader's own pins, so this list is
 * Civil's to keep current. Every entry is a public front page, nothing behind
 * a login wall that Civil can't load.
 */
export const CATEGORIES = [
    "Games",
    "Video",
    "Social",
    "Music",
    "Learning",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type CatalogApp = {
    name: string;
    url: string;
    category: Category;
    /** One short line saying what it is. */
    note: string;
};

export const CATALOG: readonly CatalogApp[] = [
    {
        name: "Poki",
        url: "https://poki.com/",
        category: "Games",
        note: "Free browser games",
    },
    {
        name: "CrazyGames",
        url: "https://www.crazygames.com/",
        category: "Games",
        note: "Thousands of web games",
    },
    {
        name: "Coolmath Games",
        url: "https://www.coolmathgames.com/",
        category: "Games",
        note: "Logic and puzzle games",
    },
    {
        name: "Krunker",
        url: "https://krunker.io/",
        category: "Games",
        note: "Fast browser shooter",
    },
    {
        name: "Slither.io",
        url: "https://slither.io/",
        category: "Games",
        note: "Grow the longest snake",
    },
    {
        name: "Chess.com",
        url: "https://www.chess.com/",
        category: "Games",
        note: "Play chess online",
    },
    {
        name: "Lichess",
        url: "https://lichess.org/",
        category: "Games",
        note: "Free, open source chess",
    },
    {
        name: "YouTube",
        url: "https://www.youtube.com/",
        category: "Video",
        note: "Videos and live streams",
    },
    {
        name: "Twitch",
        url: "https://www.twitch.tv/",
        category: "Video",
        note: "Live streams",
    },
    {
        name: "Vimeo",
        url: "https://vimeo.com/",
        category: "Video",
        note: "Films and creators",
    },
    {
        name: "Discord",
        url: "https://discord.com/app",
        category: "Social",
        note: "Chat with your friends",
    },
    {
        name: "Reddit",
        url: "https://www.reddit.com/",
        category: "Social",
        note: "Communities and threads",
    },
    {
        name: "Instagram",
        url: "https://www.instagram.com/",
        category: "Social",
        note: "Photos and reels",
    },
    {
        name: "TikTok",
        url: "https://www.tiktok.com/",
        category: "Social",
        note: "Short videos",
    },
    {
        name: "Pinterest",
        url: "https://www.pinterest.com/",
        category: "Social",
        note: "Ideas and boards",
    },
    {
        name: "Spotify",
        url: "https://open.spotify.com/",
        category: "Music",
        note: "Music and podcasts",
    },
    {
        name: "SoundCloud",
        url: "https://soundcloud.com/",
        category: "Music",
        note: "Tracks from creators",
    },
    {
        name: "YouTube Music",
        url: "https://music.youtube.com/",
        category: "Music",
        note: "Songs and playlists",
    },
    {
        name: "Wikipedia",
        url: "https://www.wikipedia.org/",
        category: "Learning",
        note: "The free encyclopedia",
    },
    {
        name: "Khan Academy",
        url: "https://www.khanacademy.org/",
        category: "Learning",
        note: "Free lessons",
    },
    {
        name: "Duolingo",
        url: "https://www.duolingo.com/",
        category: "Learning",
        note: "Learn a language",
    },
    {
        name: "Desmos",
        url: "https://www.desmos.com/calculator",
        category: "Learning",
        note: "Graphing calculator",
    },
];

const META_URL =
    "https://raw.githubusercontent.com/Bon-Appetit/porn-domains/refs/heads/main/meta.json";
const BLOCKLIST_BASE =
    "https://raw.githubusercontent.com/Bon-Appetit/porn-domains/refs/heads/main/";

const BANNED_DOMAINS = new Set<string>();

export async function initBannedDomains(): Promise<void> {
    const meta = await fetch(META_URL).then(r => r.json());
    const filename: string = meta.blocklist.name;
    const text = await fetch(BLOCKLIST_BASE + filename).then(r => r.text());
    for (const raw of text.split("\n")) {
        const line = raw.trim();
        if (!line || line.startsWith("#")) continue;
        const domain = line.includes(" ") ? line.split(/\s+/)[1] : line;
        if (domain)
            BANNED_DOMAINS.add(domain.toLowerCase().replace(/^www\./, ""));
    }
}

export function matchBannedDomain(url: string): string | null {
    try {
        const hostname = new URL(url).hostname
            .toLowerCase()
            .replace(/^www\./, "");
        return BANNED_DOMAINS.has(hostname) ? hostname : null;
    } catch {
        return null;
    }
}

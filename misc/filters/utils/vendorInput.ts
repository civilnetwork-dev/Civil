/** The host part of a domain or URL a vendor checker was handed. */
export const toHost = (domain: string): string =>
    domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .trim();

/** An environment override for a vendor setting, else its default. */
export const env = (name: string, fallback: string): string =>
    process.env[name] || fallback;

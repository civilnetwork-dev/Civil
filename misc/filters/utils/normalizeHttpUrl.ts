import { err, ok, type Result } from "neverthrow";

export type InvalidUrlError = {
    type: "INVALID_URL";
    message: string;
    input: string;
};

/** Parses the URL a filter check targets, assuming `https://` when the input
 *  names no scheme. Only HTTP(S) URLs are accepted. */
export function normalizeHttpUrl(input: string): Result<URL, InvalidUrlError> {
    try {
        const value = /^https?:\/\//i.test(input) ? input : `https://${input}`;

        const url = new URL(value);

        if (!["http:", "https:"].includes(url.protocol)) {
            return err({
                type: "INVALID_URL",
                input,
                message: "Only HTTP(S) URLs are supported.",
            });
        }

        return ok(url);
    } catch {
        return err({
            type: "INVALID_URL",
            input,
            message: "Invalid URL.",
        });
    }
}

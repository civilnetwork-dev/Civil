import { createSignal, onSettled } from "solid-js";

/** What `/api/banStatus` (run.ts) reports about the visitor. */
type BanStatus = {
    banned: boolean;
    banReason: string | null;
    bannedAt: string | null;
};

/**
 * Whether an administrator banned the visitor, fetched once the calling
 * component settles. Null until it arrives, and when the request fails.
 */
export function createBanStatus() {
    const [status, setStatus] = createSignal<BanStatus | null>(null);

    onSettled(() => {
        void fetch("/api/banStatus")
            .then(r => r.json())
            .then((data: BanStatus) => setStatus(data))
            .catch(() => {});
    });

    return status;
}

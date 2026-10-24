import { createSignal, onSettled } from "solid-js";

/** What `/api/violations` (run.ts) reports about the visitor. */
type ViolationsStatus = {
    authenticated: boolean;
    banned: boolean;
    banReason: string | null;
    bannedAt?: string | null;
    violations: number;
    maxViolations: number;
};

/**
 * The visitor's strike and ban status, fetched once the calling component
 * settles. Null until it arrives, and when the request fails.
 */
export function createViolationsStatus() {
    const [status, setStatus] = createSignal<ViolationsStatus | null>(null);

    onSettled(() => {
        void fetch("/api/violations")
            .then(r => r.json())
            .then((data: ViolationsStatus) => setStatus(data))
            .catch(() => {});
    });

    return status;
}

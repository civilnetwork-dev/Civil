import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterAll, expect, it } from "vitest";

import { loadExtension } from "../extensionHost";
import { detectFlagging } from "./detect";
import { observeRoute } from "./sandbox";

const root = mkdtempSync(join(tmpdir(), "civil-async-background-"));
const cases = [
    ["returned", "Promise.reject(new Error('Background startup rejected'))"],
    [
        "timer",
        "setTimeout(async () => { throw new Error('Background startup rejected'); }, 0)",
    ],
    [
        "sync-timer",
        "setTimeout(() => { throw new Error('Background startup rejected'); }, 0)",
    ],
    [
        "microtask",
        "queueMicrotask(async () => { throw new Error('Background startup rejected'); })",
    ],
    [
        "sync-event",
        "addEventListener('audit', () => { throw new Error('Background startup rejected'); }); dispatchEvent(new Event('audit'))",
    ],
    [
        "async-event",
        "addEventListener('audit', async () => { throw new Error('Background startup rejected'); }); dispatchEvent(new Event('audit'))",
    ],
    ["pending", "new Promise(() => {})"],
    [
        "events",
        `
        let calls = 0;
        const listener = () => calls++;
        globalThis.addEventListener('audit', listener);
        globalThis.dispatchEvent(new Event('audit'));
        globalThis.removeEventListener('audit', listener);
        globalThis.dispatchEvent(new Event('audit'));
        globalThis.addEventListener('cancel', event => event.preventDefault());
        const accepted = globalThis.dispatchEvent(new Event('cancel', { cancelable: true }));
        chrome.storage.local.set({ calls, accepted });
    `,
    ],
] as const;

for (const [name, code] of cases) {
    const dir = join(root, name);
    mkdirSync(dir);
    writeFileSync(
        join(dir, "manifest.json"),
        JSON.stringify({
            manifest_version: 3,
            name,
            version: "1.0.0",
            background: { service_worker: "background.js" },
        }),
    );
    writeFileSync(join(dir, "background.js"), code);
}

afterAll(() => {
    expect(dirname(root)).toBe(resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
});

it.each(cases.slice(0, 6))(
    "keeps %s background rejection contained and inconclusive",
    async name => {
        const observation = await observeRoute({
            extensionDir: join(root, name),
            baseUrl: "https://probe.invalid",
            route: "/newTab",
            waitMs: 30,
            fetchImpl: (async () =>
                new Response(
                    "<body>Benign page</body>",
                )) as unknown as typeof fetch,
        });
        expect(observation.backgroundError).toContain(
            "Background startup rejected",
        );
        expect(detectFlagging(observation, "securly").inconclusive).toContain(
            "Background startup rejected",
        );
    },
);

it("does not wait for an unresolved startup promise", async () => {
    const extension = await loadExtension({ dir: join(root, "pending") });
    expect(extension.runtimeError).toBeUndefined();
    extension.dispose();
});

it("supports real worker event registration, removal and cancellation", async () => {
    const extension = await loadExtension({ dir: join(root, "events") });
    expect(extension.getStorage()).toEqual({ calls: 1, accepted: false });
    extension.dispose();
});

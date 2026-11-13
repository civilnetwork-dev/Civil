import { join } from "node:path";

import { expect, it } from "vitest";

import { detectFlagging } from "./detect";
import { observeRoute } from "./sandbox";

it.each(["returned", "timer"])(
    "keeps %s content startup rejection contained and inconclusive",
    async route => {
        const observation = await observeRoute({
            extensionDir: join(import.meta.dirname, "fixtures/async-content"),
            baseUrl: "https://probe.invalid",
            route: `/${route}`,
            waitMs: 30,
            fetchImpl: (async () =>
                new Response(
                    "<body>Benign page</body>",
                )) as unknown as typeof fetch,
        });
        expect(observation.backgroundError).toBeUndefined();
        expect(observation.contentScriptError).toContain(
            "Content startup rejected",
        );
        expect(detectFlagging(observation, "securly").inconclusive).toContain(
            "Content startup rejected",
        );
    },
);

it("skips dependent content startup after the background fails", async () => {
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures/failed-content-host"),
        baseUrl: "https://probe.invalid",
        route: "/newTab",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response(
                "<body>Benign page</body>",
            )) as unknown as typeof fetch,
    });
    expect(observation.pageText).toBe("Benign page");
    expect(observation.backgroundError).toContain("missing.js");
    expect(observation.contentScriptError).toBeUndefined();
    expect(detectFlagging(observation, "securly").inconclusive).toContain(
        "missing.js",
    );
});

it("reports a detached startup rejection even with no extra wait", async () => {
    const observation = await observeRoute({
        extensionDir: join(import.meta.dirname, "fixtures/async-content"),
        baseUrl: "https://probe.invalid",
        route: "/detached",
        waitMs: 0,
        fetchImpl: (async () =>
            new Response(
                "<body>Benign page</body>",
            )) as unknown as typeof fetch,
    });
    expect(detectFlagging(observation, "securly").inconclusive).toContain(
        "Content startup rejected",
    );
});

it("keeps missing async containment incomplete without discarding proven blocks", () => {
    const observation = {
        route: "/newTab",
        finalUrl: "https://probe.invalid/newTab",
        pageText: "Benign page",
        originalLength: 11,
        asyncContainmentIncomplete:
            "VM detached rejection containment is unavailable in this runtime",
    };
    expect(detectFlagging(observation, "securly").inconclusive).toBe(
        observation.asyncContainmentIncomplete,
    );
    expect(
        detectFlagging({ ...observation, webRequestCancelled: true }, "securly")
            .flagged,
    ).toBe(true);
});

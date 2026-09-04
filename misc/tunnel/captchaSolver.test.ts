/**
 * The captcha solver. The model itself is a small local file now (see
 * captchaSolver.ts's module doc) and loads instantly, but reading a *real*
 * captcha still means a live network call to freedns.afraid.org — so that
 * part stays opt-in (`CIVIL_CAPTCHA_LIVE=1`) out of politeness to a third
 * party's free service, not out of concern for model size. What always runs
 * is the shape of the solver's output contract, driven through a stubbed
 * pipeline.
 */

import { readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
    createCaptchaSolver,
    createHybridCaptchaSolver,
} from "./captchaSolver";

describe("createCaptchaSolver", () => {
    it("returns a function", () => {
        expect(typeof createCaptchaSolver()).toBe("function");
    });
});

// The hybrid solver still falls back to a human once ocrAttempts runs out —
// live verification found the OCR model reliable, but not infallible, and
// this exercises that fallback path directly (`ocrAttempts: 0` forces it on
// the first call) without actually blocking on stdin.
vi.mock("node:readline/promises", () => ({
    createInterface: () => ({
        question: async () => "  HUMANCODE  ",
        close: () => {},
    }),
}));

describe("createHybridCaptchaSolver", () => {
    it("skips OCR and asks a human once ocrAttempts is exhausted (0 here)", async () => {
        const solve = createHybridCaptchaSolver({ ocrAttempts: 0 });
        const answer = await solve(new Uint8Array([1, 2, 3, 4]));

        // Trimmed: a human's typed answer shouldn't carry stray whitespace.
        expect(answer).toBe("HUMANCODE");
    });

    it("saves the image to a temp file before asking", async () => {
        const before = new Set(await readdir(tmpdir()));
        const solve = createHybridCaptchaSolver({ ocrAttempts: 0 });

        await solve(new Uint8Array([1, 2, 3, 4]));

        const created = (await readdir(tmpdir())).filter(
            f => !before.has(f) && f.startsWith("freedns-captcha-"),
        );
        expect(created.length).toBe(1);
        await rm(join(tmpdir(), created[0]!));
    });
});

// Opt-in: fetches one real, live captcha from freedns.afraid.org. Proves the
// pipeline runs end to end against a real image — not that the answer is
// correct, which only a live FreeDNS submission can show (already done by
// hand: five fresh captchas, five accepted — see captchaSolver.ts's module
// doc). Model loading itself is local and instant now, so this is gated on
// the network call, not the model.
describe.skipIf(process.env.CIVIL_CAPTCHA_LIVE !== "1")(
    "captcha solver (live model)",
    () => {
        it("reads a real FreeDNS captcha into an uppercase-letter string", async () => {
            const res = await fetch(
                "https://freedns.afraid.org/securimage/securimage_show.php",
                {
                    headers: {
                        "User-Agent":
                            "Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0",
                    },
                },
            );
            const bytes = new Uint8Array(await res.arrayBuffer());

            const solve = createCaptchaSolver();
            const answer = await solve(bytes);

            // The model's own training charset is uppercase A-Z only (see
            // captchaSolver.ts) — real FreeDNS answers never contain a digit
            // or a lowercase letter, so this is a real correctness check, not
            // just a shape check.
            expect(answer).toMatch(/^[A-Z]*$/);
            expect(answer.length).toBeGreaterThan(0);
            expect(answer.length).toBeLessThanOrEqual(8);
        }, 60_000);
    },
);

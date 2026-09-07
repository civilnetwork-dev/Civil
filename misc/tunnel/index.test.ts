/**
 * The tunnel orchestration's own logic, kept to the parts that don't need a
 * real cloudflared binary or a network. `startTunnel` downloads and runs
 * cloudflared, so the paths that reach it are left to manual/integration use;
 * what's tested here is the guard that must fire *before* it.
 */

import { describe, expect, it } from "vitest";

import { FreeDnsClient, FreeDnsError } from "./freedns";
import { createSubdomainWithCaptcha, openTunnel } from "./index";

describe("openTunnel", () => {
    it("refuses to start without a captcha, before touching cloudflared", async () => {
        // A stub client so no login/network happens; the point is that the
        // captcha guard rejects before `startTunnel` is ever called. If it
        // didn't, this would try to download cloudflared and hang.
        const client = Object.assign(new FreeDnsClient(), {
            login: async () => {},
        });

        await expect(
            openTunnel({
                port: 3000,
                domain: { name: "mooo.com", id: 42 },
                client,
            }),
        ).rejects.toThrow(/captcha/i);
    });

    it("exports the FreeDNS client alongside the tunnel opener", () => {
        expect(typeof openTunnel).toBe("function");
        expect(typeof FreeDnsClient).toBe("function");
    });
});

describe("createSubdomainWithCaptcha", () => {
    /** FreeDNS's real wording for a wrong guess — it never says "captcha". */
    const wrongCodeError = () =>
        new FreeDnsError(
            "Failed to create subdomain: The security code was incorrect, please try again.",
        );

    const record = {
        recordType: "CNAME" as const,
        subdomain: "abc123",
        domainId: 1,
        destination: "tunnel.trycloudflare.com",
    };

    /** A stub client whose `createSubdomain` behavior is driven by `attempt`
     *  (1-indexed), so a test can fail the first N calls and succeed after. */
    function stubClient(onAttempt: (attempt: number) => void): FreeDnsClient {
        let attempt = 0;
        return Object.assign(new FreeDnsClient(), {
            getCaptcha: async () => new Uint8Array(),
            createSubdomain: async () => {
                attempt++;
                onAttempt(attempt);
            },
        });
    }

    it("retries a wrong security code with a fresh guess, and stops once one lands", async () => {
        const client = stubClient(attempt => {
            if (attempt < 3) throw wrongCodeError();
        });
        let solves = 0;

        await createSubdomainWithCaptcha(
            client,
            {
                port: 3000,
                domain: { name: "mooo.com", id: 1 },
                solveCaptcha: async () => {
                    solves++;
                    return "guess";
                },
                captchaAttempts: 5,
            },
            record,
        );

        expect(solves).toBe(3);
    });

    it("gives up after captchaAttempts wrong guesses", async () => {
        const client = stubClient(() => {
            throw wrongCodeError();
        });
        let solves = 0;

        await expect(
            createSubdomainWithCaptcha(
                client,
                {
                    port: 3000,
                    domain: { name: "mooo.com", id: 1 },
                    solveCaptcha: async () => {
                        solves++;
                        return "guess";
                    },
                    captchaAttempts: 5,
                },
                record,
            ),
        ).rejects.toThrow(/security code/i);
        expect(solves).toBe(5);
    });
});

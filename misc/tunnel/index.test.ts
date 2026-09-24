/**
 * The tunnel orchestration's own logic, kept to the parts that don't need a
 * real cloudflared binary or a network. `startTunnel` downloads and runs
 * cloudflared, so the paths that reach it are left to manual/integration use;
 * what's tested here is the guard that must fire *before* it.
 */

import { describe, expect, it } from "vitest";

import { FreeDnsClient, FreeDnsError, type Subdomain } from "./freedns";
import {
    createSubdomainWithCaptcha,
    findSubdomainWithRetry,
    openTunnel,
    sweepTunnelOrphans,
} from "./index";

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

describe("sweepTunnelOrphans", () => {
    /** A logged-in account's records: one real leaked tunnel orphan among the
     *  kinds of records a person legitimately keeps and must never lose. */
    const accountRecords: Subdomain[] = [
        // The orphan: random 12-char label, CNAME to a dead trycloudflare host.
        {
            id: "26630865",
            type: "CNAME",
            subdomain: "tpv47fuc8cg4.rbarkersw.com",
            destination: "oem-appears-spin-yeah.trycloudflare.com",
        },
        // A user's own A records — different type, must be spared.
        {
            id: "24903100",
            type: "A",
            subdomain: "quartinal.developer.li",
            destination: "77.37.62.243",
        },
        {
            id: "22926828",
            type: "A",
            subdomain: "kahoot.v0id.nl",
            destination: "76.76.21.21",
        },
        // A CNAME the user parked on a real host — trycloudflare check spares it.
        {
            id: "30000001",
            type: "CNAME",
            subdomain: "www.example.org",
            destination: "cdn.example.net",
        },
        // A trycloudflare CNAME whose label isn't the random tunnel format —
        // someone named it by hand, so it isn't ours to delete.
        {
            id: "30000002",
            type: "CNAME",
            subdomain: "demo.example.org",
            destination: "my-quick-tunnel.trycloudflare.com",
        },
        // A second real orphan, with FreeDNS's own subdomain-list page
        // truncation applied to its destination (a real captured value —
        // the exact way this bug was found live): still a match.
        {
            id: "26632056",
            type: "CNAME",
            subdomain: "xrsutqkvk229.gap-peace.org",
            destination: "karl-atmospheric-belly-pad.trycloudflare...",
        },
        // A third real orphan whose truncation cut *inside* "trycloudflare"
        // (another real captured value). No substring of what the list page
        // shows identifies this as a tunnel, so the sweep has to read the
        // details page — this one went unswept and wedged the next run at
        // "no more subdomain capacity".
        {
            id: "26658004",
            type: "CNAME",
            subdomain: "ho32y39nq9ar.fourvirtues.net",
            destination: "guitar-usgs-bangkok-planets.trycloudflar...",
        },
    ];

    /** What the details page reports, against which the sweep confirms: the
     *  whole destination, never the list page's truncation of it. */
    const fullDestinations: Record<string, string> = {
        "26630865": "oem-appears-spin-yeah.trycloudflare.com",
        "30000001": "cdn.example.net",
        "30000002": "my-quick-tunnel.trycloudflare.com",
        "26632056": "karl-atmospheric-belly-pad.trycloudflare.com",
        "26658004": "guitar-usgs-bangkok-planets.trycloudflare.com",
    };

    function stubClient(records: Subdomain[]): {
        client: FreeDnsClient;
        deleted: string[];
    } {
        const deleted: string[] = [];
        const client = Object.assign(new FreeDnsClient(), {
            getSubdomains: async () => records,
            getSubdomainDetails: async (id: string) => ({
                destination: fullDestinations[id] ?? "",
            }),
            deleteSubdomain: async (id: string) => {
                deleted.push(id);
            },
        });
        return { client, deleted };
    }

    it("deletes only the random-labelled CNAMEs to trycloudflare, sparing everything else", async () => {
        const { client, deleted } = stubClient(accountRecords);
        const count = await sweepTunnelOrphans(client);
        expect(count).toBe(3);
        expect(deleted.toSorted()).toEqual([
            "26630865",
            "26632056",
            "26658004",
        ]);
    });

    it("is a no-op on an account with no tunnel orphans", async () => {
        const orphanIds = new Set(["26630865", "26632056", "26658004"]);
        const { client, deleted } = stubClient(
            accountRecords.filter(r => !orphanIds.has(r.id)),
        );
        expect(await sweepTunnelOrphans(client)).toBe(0);
        expect(deleted).toEqual([]);
    });
});

describe("findSubdomainWithRetry", () => {
    /** A stub whose `getSubdomains` returns empty for the first
     *  `emptyReads` calls, then the real record forever after — modelling
     *  FreeDNS's own list API lagging behind a record it just reported
     *  creating successfully. */
    function stubClient(
        emptyReads: number,
        record: Subdomain,
    ): { client: FreeDnsClient } {
        let calls = 0;
        const client = Object.assign(new FreeDnsClient(), {
            getSubdomains: async () => {
                calls++;
                return calls > emptyReads ? [record] : [];
            },
        });
        return { client };
    }

    const record: Subdomain = {
        id: "999",
        type: "CNAME",
        subdomain: "abc123.mooo.com",
        destination: "quick-tunnel.trycloudflare.com",
    };

    it("finds a record that only shows up after the list API catches up", async () => {
        const { client } = stubClient(2, record);
        const found = await findSubdomainWithRetry(
            client,
            "abc123.mooo.com",
            4,
            0,
        );
        expect(found).toEqual(record);
    });

    it("gives up and returns undefined once attempts are exhausted", async () => {
        const { client } = stubClient(10, record); // never catches up in time
        const found = await findSubdomainWithRetry(
            client,
            "abc123.mooo.com",
            3,
            0,
        );
        expect(found).toBeUndefined();
    });

    it("returns immediately when the record is already there", async () => {
        const { client } = stubClient(0, record);
        const found = await findSubdomainWithRetry(
            client,
            "abc123.mooo.com",
            4,
            0,
        );
        expect(found).toEqual(record);
    });
});

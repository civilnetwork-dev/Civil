// How each vendor's raw answer maps to a BLOCK/ALLOW/UNKNOWN verdict — the
// layer that let meatballmanor.com through: Securly rated it a proxy but one
// district's policy said ALLOW, and three other checkers reported "no data"
// as ALLOW. Vendor clients are mocked; nothing here touches the network.
import { ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

const securly = vi.hoisted(() => ({
    decision: "ALLOW" as string,
    categoryId: undefined as string | undefined,
}));
const cisco = vi.hoisted(() => ({ authoritative: false, blocked: false }));
const lightspeed = vi.hoisted(() => ({
    verdict: "UNKNOWN" as string,
    blocked: false,
    categories: [] as string[],
}));
const linewize = vi.hoisted(() => ({
    method: "fallback" as string | undefined,
    blocked: false,
    categories: [] as string[],
}));

vi.mock("./securly/broker", () => ({
    checkStatus: async () => ok({ ...securly }),
}));
vi.mock("./cisco/security/checker", () => ({
    createCiscoSecurityChecker: () => ({ checkUrl: async () => ok({ ...cisco }) }),
}));
vi.mock("./lightspeed/checker", () => ({
    checkLightspeedFilter: async () => ok({ ...lightspeed }),
}));
vi.mock("./linewize/checker", () => ({
    createLinewizeFilterChecker: () => ({
        checkUrl: async () => ok({ ...linewize }),
    }),
}));

import { DOMAIN_CHECKERS } from "./domainReputation";

const check = (vendor: string) =>
    DOMAIN_CHECKERS.find(c => c.vendor === vendor)!.check("meatballmanor.com");

describe("securly", () => {
    it("blocks on a school-blocked category even when the probed policy allows", async () => {
        // 256 = bit 8, "Anonymizers / Proxy / VPN" — the live rating.
        Object.assign(securly, { decision: "ALLOW", categoryId: "256" });
        expect(await check("securly")).toBe("BLOCK");
    });

    it("allows a benign category the policy allows", async () => {
        // bit 2, "Educational / reference"
        Object.assign(securly, { decision: "ALLOW", categoryId: "4" });
        expect(await check("securly")).toBe("ALLOW");
    });

    it("abstains on UNKNOWN_SCHOOL (no decision, no category)", async () => {
        Object.assign(securly, { decision: "UNKNOWN", categoryId: "-1" });
        expect(await check("securly")).toBe("UNKNOWN");
    });
});

describe("no data is not ALLOW", () => {
    it("cisco: a non-authoritative DoH resolve abstains", async () => {
        expect(await check("cisco")).toBe("UNKNOWN");
        Object.assign(cisco, { authoritative: true, blocked: true });
        expect(await check("cisco")).toBe("BLOCK");
    });

    it("lightspeed: an UNKNOWN relay verdict abstains", async () => {
        expect(await check("lightspeed")).toBe("UNKNOWN");
        Object.assign(lightspeed, {
            verdict: "ALLOW",
            categories: ["Proxy Avoidance"],
        });
        expect(await check("lightspeed")).toBe("BLOCK");
    });

    it("linewize: a fallback-method verdict abstains", async () => {
        expect(await check("linewize")).toBe("UNKNOWN");
        Object.assign(linewize, { method: "signature", blocked: false });
        expect(await check("linewize")).toBe("ALLOW");
    });
});

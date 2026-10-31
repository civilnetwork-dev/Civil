// How a vendor's answer becomes a BLOCK/ALLOW/UNKNOWN reputation. The layer
// that let meatballmanor.com through: Securly rated it a proxy but one
// district's policy said ALLOW, and three other checkers reported "no data"
// as ALLOW. Vendor clients are mocked; nothing here touches the network.
import { okAsync } from "neverthrow";
import { describe, expect, it, vi } from "vitest";

import type { FilterVerdict } from "./verdict";

const securly = vi.hoisted(() => ({
    decision: "ALLOW" as string,
    categoryId: undefined as string | undefined,
}));
const verdicts = vi.hoisted(() => {
    const unknown = (): FilterVerdict => ({
        status: "unknown",
        categories: [],
        detail: "",
        matched: [],
    });
    return { cisco: unknown(), lightspeed: unknown(), linewize: unknown() };
});

// The real securly/checker.ts maps the broker's raw answer, bits included.
vi.mock("./securly/broker", () => ({
    checkStatus: () => okAsync({ kind: "standard", ...securly }),
}));
vi.mock("./cisco/security/checker", () => ({
    createCiscoSecurityChecker: () => ({
        checkUrl: () => okAsync(verdicts.cisco),
    }),
}));
vi.mock("./lightspeed/checker", () => ({
    checkLightspeedFilter: () => okAsync(verdicts.lightspeed),
}));
vi.mock("./linewize/checker", () => ({
    createLinewizeFilterChecker: () => ({
        checkUrl: () => okAsync(verdicts.linewize),
    }),
}));

import { DOMAIN_CHECKERS } from "./domainReputation";

const check = (vendor: string) =>
    DOMAIN_CHECKERS.find(c => c.vendor === vendor)!.check("meatballmanor.com");

describe("securly", () => {
    it("blocks on a school-blocked category even when the probed policy allows", async () => {
        // 256 = bit 8, "Anonymizers / Proxy / VPN": the live rating.
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
    it("an unknown verdict abstains, a blocked one blocks", async () => {
        expect(await check("cisco")).toBe("UNKNOWN");
        verdicts.cisco.status = "blocked";
        expect(await check("cisco")).toBe("BLOCK");
    });

    it("an allowed page in a school-blocked category is still a block", async () => {
        expect(await check("lightspeed")).toBe("UNKNOWN");
        Object.assign(verdicts.lightspeed, {
            status: "allowed",
            categories: ["Proxy & VPN"],
        });
        expect(await check("lightspeed")).toBe("BLOCK");
    });

    it("an allowed page in a benign category is an allow", async () => {
        Object.assign(verdicts.linewize, {
            status: "allowed",
            categories: ["Education"],
        });
        expect(await check("linewize")).toBe("ALLOW");
    });
});

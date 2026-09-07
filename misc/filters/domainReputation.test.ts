import { describe, expect, it } from "vitest";

import {
    APPLICABLE_VENDORS,
    classifyDomain,
    DOMAIN_CHECKERS,
    type DomainVerdict,
    type VendorDomainChecker,
} from "./domainReputation";

const EXPECTED_VENDORS = [
    "aristotle",
    "blocksi",
    "cisco",
    "fortiguard",
    "iboss",
    "lanschool",
    "lightspeed",
    "linewize",
    "securly",
].toSorted();

const stub = (vendor: string, verdict: DomainVerdict): VendorDomainChecker => ({
    vendor,
    check: async () => verdict,
});

describe("classifyDomain", () => {
    it("blocks when any checker says BLOCK, and names them", async () => {
        const r = await classifyDomain("x.com", [
            stub("a", "ALLOW"),
            stub("b", "BLOCK"),
            stub("c", "UNKNOWN"),
            stub("d", "BLOCK"),
        ]);
        expect(r.blocked).toBe(true);
        expect(r.by).toEqual(["b", "d"]);
    });

    it("survives when nothing blocks (ALLOW/UNKNOWN only)", async () => {
        const r = await classifyDomain("x.com", [
            stub("a", "ALLOW"),
            stub("b", "UNKNOWN"),
        ]);
        expect(r.blocked).toBe(false);
        expect(r.by).toEqual([]);
    });

    it("treats a throwing checker as UNKNOWN, not a block", async () => {
        const boom: VendorDomainChecker = {
            vendor: "boom",
            check: async () => {
                throw new Error("network");
            },
        };
        const r = await classifyDomain("x.com", [boom, stub("a", "ALLOW")]);
        expect(r.blocked).toBe(false);
    });
});

describe("DOMAIN_CHECKERS registry", () => {
    it("has one reputation checker per gate-capable filter", () => {
        expect(DOMAIN_CHECKERS.map(c => c.vendor).toSorted()).toEqual(
            EXPECTED_VENDORS,
        );
        for (const c of DOMAIN_CHECKERS)
            expect(typeof c.check).toBe("function");
    });

    it("APPLICABLE_VENDORS matches the registry", () => {
        expect(APPLICABLE_VENDORS).toEqual(EXPECTED_VENDORS);
    });

    it("iboss abstains instead of guessing when IBOSS_SECURITY_KEY is unset", async () => {
        // tests/setup.ts seeds a fake key for other suites; unset it here to
        // exercise the documented behavior — no key, no request, never a
        // fabricated verdict.
        const saved = process.env.IBOSS_SECURITY_KEY;
        delete process.env.IBOSS_SECURITY_KEY;
        try {
            const iboss = DOMAIN_CHECKERS.find(c => c.vendor === "iboss")!;
            expect(await iboss.check("example.com")).toBe("UNKNOWN");
        } finally {
            if (saved !== undefined) process.env.IBOSS_SECURITY_KEY = saved;
        }
    });
});

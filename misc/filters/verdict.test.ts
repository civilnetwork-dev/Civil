// Every checker answers one shape; these pin the vendor answers that are
// easiest to misread, without the network: each checker here takes its
// transport as an argument.
import { okAsync } from "neverthrow";
import { describe, expect, it } from "vitest";

import { checkLightspeedFilter } from "./lightspeed/checker";
import { createLinewizeFilterChecker } from "./linewize/checker";
import { toFilterError } from "./verdict";

const lightspeed = (categories: string[]) =>
    checkLightspeedFilter(
        { url: "https://example.com" },
        { categorize: () => okAsync({ categories, categoryId: null }) },
    );

const linewize = (data: unknown) =>
    createLinewizeFilterChecker(
        {
            verdictServerUrl: "https://verdict.example",
            identity: "student@example.org",
            deviceId: "device",
        },
        { get: async () => ({ data }) } as never,
    ).checkUrl({ url: "https://example.com" });

describe("toFilterError", () => {
    it("sorts every vendor's error names into the four kinds", () => {
        expect(toFilterError({ type: "PARSE_ERROR", message: "m" })).toEqual({
            type: "PARSE",
            message: "m",
        });
        expect(
            toFilterError({ type: "MISSING_CREDENTIALS", message: "m" }).type,
        ).toBe("CONFIG");
        expect(toFilterError({ type: "TIMEOUT", message: "m" }).type).toBe(
            "NETWORK",
        );
    });
});

describe("a vendor saying nothing reads as unknown, never allowed", () => {
    it("lightspeed: a relay with no category", async () => {
        expect((await lightspeed([]))._unsafeUnwrap().status).toBe("unknown");
    });

    it("linewize: the verdict server declining to classify", async () => {
        expect(
            (await linewize({ verdict: 1, method: "fallback" }))._unsafeUnwrap()
                .status,
        ).toBe("unknown");
    });
});

describe("a vendor's own words reach the shared vocabulary", () => {
    it("lightspeed: a blocked branch", async () => {
        expect((await lightspeed(["security.proxy"]))._unsafeUnwrap()).toEqual({
            status: "blocked",
            categories: ["Proxy & VPN"],
            detail: "Blocked category: security.proxy.",
            matched: ["security.proxy"],
        });
    });

    it("linewize: a numeric verdict and a free-text category", async () => {
        expect(
            (
                await linewize({ verdict: 0, category: "Pornography" })
            )._unsafeUnwrap(),
        ).toMatchObject({ status: "blocked", categories: ["Pornography"] });
    });
});

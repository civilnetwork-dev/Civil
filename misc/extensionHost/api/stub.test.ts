import { describe, expect, it } from "vitest";
import { universalStub, withFallback } from "./stub";

describe("universalStub", () => {
    it("resolves any call to undefined instead of throwing", async () => {
        const stub = universalStub() as (
            ...args: unknown[]
        ) => Promise<unknown>;
        await expect(stub("anything", 1, 2)).resolves.toBeUndefined();
    });

    it("is infinitely indexable, so deep chains never hit undefined", () => {
        const stub = universalStub() as Record<string, unknown>;
        expect(typeof stub.onFocusChanged).toBe("function");
        expect(
            typeof (stub.onFocusChanged as Record<string, unknown>).addListener,
        ).toBe("function");
    });

    it("does not hang when awaited directly (no thenable trap)", async () => {
        const stub = universalStub();
        // If `.then` returned another stub instead of undefined, `await`
        // would call it as `stub.then(resolve, reject)` and hang forever,
        // since a called stub resolves its OWN promise rather than invoking
        // the resolver it was handed. This is exactly that failure mode,
        // asserted directly rather than trusted from the implementation.
        await expect(
            Promise.race([Promise.resolve(stub), timeout(50)]),
        ).resolves.not.toBe("timeout");
    });
});

function timeout(ms: number): Promise<"timeout"> {
    return new Promise(resolve => setTimeout(() => resolve("timeout"), ms));
}

describe("withFallback", () => {
    it("passes through implemented members untouched", () => {
        const api = withFallback({ runtime: { id: "abc" } });
        expect(api.runtime.id).toBe("abc");
    });

    it("stubs any namespace the real implementation doesn't have", async () => {
        const api = withFallback({ runtime: { id: "abc" } }) as Record<
            string,
            any
        >;
        expect(api.windows).toBeDefined();
        await expect(api.windows.getCurrent()).resolves.toBeUndefined();
        expect(() =>
            api.webRequest.onBeforeRequest.addListener(() => {}),
        ).not.toThrow();
    });
});

// @vitest-environment happy-dom
//
// A DOM is required, not merely convenient: src/lib/TabManager.ts (pulled in via
// browserHelpers) reads `window.location.origin` at MODULE SCOPE to build
// BROWSER_URLS, so the import itself throws without a window. See the SSR note
// in MAINTENANCE.md section 7.
import { createRoot } from "solid-js";
import { describe, expect, it } from "vitest";
import {
    createTabHistory,
    displayUrl,
    isProbablyUrl,
    normalizeNav,
} from "../src/lib/browserHelpers";

/**
 * `isProbablyUrl` / `normalizeNav` decide whether what you typed is a place to
 * go or something to search for. Get it wrong in one direction and "hello world"
 * becomes a failed navigation; wrong in the other and "github.com" runs a Google
 * search. It's the single most user-visible decision in the address bar.
 *
 * `createTabHistory` is back/forward cursor arithmetic — the classic source of
 * off-by-one bugs that only show up after a specific click sequence.
 */

describe("isProbablyUrl", () => {
    it("accepts anything with a scheme", () => {
        expect(isProbablyUrl("https://example.com")).toBe(true);
        expect(isProbablyUrl("http://example.com")).toBe(true);
        expect(isProbablyUrl("about:blank")).toBe(true);
    });

    it("accepts a bare domain", () => {
        expect(isProbablyUrl("example.com")).toBe(true);
        expect(isProbablyUrl("sub.example.co.uk")).toBe(true);
        expect(isProbablyUrl("my-site.io")).toBe(true);
    });

    it("accepts a bare domain with a path", () => {
        expect(isProbablyUrl("example.com/some/path")).toBe(true);
    });

    it("rejects plain search queries", () => {
        expect(isProbablyUrl("hello world")).toBe(false);
        expect(isProbablyUrl("how to tie a tie")).toBe(false);
        expect(isProbablyUrl("weather")).toBe(false);
        expect(isProbablyUrl("")).toBe(false);
    });

    it("rejects a query that merely contains a dot", () => {
        expect(isProbablyUrl("what is 3.5 in fractions")).toBe(false);
    });

    it("rejects a bare word with too short a TLD", () => {
        expect(isProbablyUrl("file.a")).toBe(false);
    });

    /**
     * Documented quirk, not an endorsement: the regex is unanchored at the end
     * and only checks the leading token, so a query that *starts* with something
     * domain-shaped is treated as a URL.
     */
    it("treats a query starting with a domain-like token as a URL", () => {
        expect(isProbablyUrl("example.com is down")).toBe(true);
    });
});

describe("normalizeNav", () => {
    it("leaves a full URL untouched", () => {
        expect(normalizeNav("https://example.com/a")).toBe(
            "https://example.com/a",
        );
    });

    it("adds https:// to a bare domain", () => {
        expect(normalizeNav("example.com")).toBe("https://example.com");
        expect(normalizeNav("example.com/path")).toBe(
            "https://example.com/path",
        );
    });

    it("returns a search query unchanged, for the caller to route to a search engine", () => {
        expect(normalizeNav("hello world")).toBe("hello world");
    });

    it("agrees with isProbablyUrl about what is navigable", () => {
        for (const input of [
            "https://example.com",
            "example.com",
            "hello world",
            "weather",
            "my-site.io",
        ]) {
            const changed = normalizeNav(input) !== input;
            // It only ever rewrites inputs it considers navigable-but-schemeless.
            if (changed) expect(isProbablyUrl(input)).toBe(true);
        }
    });
});

describe("displayUrl", () => {
    it("strips the scheme for display", () => {
        expect(displayUrl("https://example.com/path")).toBe("example.com/path");
    });

    it("keeps the query string", () => {
        expect(displayUrl("https://example.com/s?q=1")).toBe(
            "example.com/s?q=1",
        );
    });

    it("drops the fragment", () => {
        expect(displayUrl("https://example.com/p#frag")).toBe("example.com/p");
    });

    it("returns the input unchanged when it isn't a URL", () => {
        expect(displayUrl("not a url")).toBe("not a url");
    });
});

describe("createTabHistory", () => {
    /** createSignal needs an owner, so each case runs inside a root. */
    function withHistory(fn: (h: ReturnType<typeof createTabHistory>) => void) {
        createRoot(dispose => {
            fn(createTabHistory());
            dispose();
        });
    }

    it("starts with no navigation available", () => {
        withHistory(h => {
            expect(h.canBack("t1")).toBe(false);
            expect(h.canForward("t1")).toBe(false);
            expect(h.back("t1")).toBeNull();
            expect(h.forward("t1")).toBeNull();
        });
    });

    it("cannot go back from a single entry", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            expect(h.canBack("t1")).toBe(false);
        });
    });

    it("walks back and forward through a stack", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "b");
            h.pushHistory("t1", "c");

            expect(h.canBack("t1")).toBe(true);
            expect(h.back("t1")).toBe("b");
            expect(h.back("t1")).toBe("a");
            expect(h.back("t1")).toBeNull(); // at the start
            expect(h.canBack("t1")).toBe(false);

            expect(h.forward("t1")).toBe("b");
            expect(h.forward("t1")).toBe("c");
            expect(h.forward("t1")).toBeNull(); // at the end
            expect(h.canForward("t1")).toBe(false);
        });
    });

    it("truncates forward history when navigating after going back", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "b");
            h.pushHistory("t1", "c");
            h.back("t1"); // at "b"
            h.pushHistory("t1", "d"); // new branch

            expect(h.canForward("t1")).toBe(false);
            expect(h.getHistory("t1").stack).toEqual(["a", "b", "d"]);
        });
    });

    it("dedupes a push of the URL already at the cursor", () => {
        // Load events fire for the same URL during back/forward; without this
        // the stack would grow and the cursor would drift.
        withHistory(h => {
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "a");
            expect(h.getHistory("t1").stack).toEqual(["a"]);
            expect(h.canBack("t1")).toBe(false);
        });
    });

    it("does not corrupt the stack when back re-fires a push", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "b");
            const target = h.back("t1"); // "a"
            h.pushHistory("t1", target as string); // iframe load handler
            expect(h.getHistory("t1").stack).toEqual(["a", "b"]);
            expect(h.canForward("t1")).toBe(true);
            expect(h.forward("t1")).toBe("b");
        });
    });

    it("allows revisiting a URL that is not at the cursor", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "b");
            h.pushHistory("t1", "a");
            expect(h.getHistory("t1").stack).toEqual(["a", "b", "a"]);
        });
    });

    it("keeps tabs independent", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "b");
            h.pushHistory("t2", "x");

            expect(h.canBack("t1")).toBe(true);
            expect(h.canBack("t2")).toBe(false);
            expect(h.back("t1")).toBe("a");
            expect(h.getHistory("t2").stack).toEqual(["x"]);
        });
    });

    it("treats a null tab id as having no history", () => {
        withHistory(h => {
            expect(h.back(null)).toBeNull();
            expect(h.forward(null)).toBeNull();
            expect(h.canBack(null)).toBe(false);
            expect(h.canForward(null)).toBe(false);
        });
    });

    it("bumps the reactive version on every mutation", () => {
        withHistory(h => {
            const before = h.version();
            h.pushHistory("t1", "a");
            h.pushHistory("t1", "b");
            expect(h.version()).toBeGreaterThan(before);

            const afterPush = h.version();
            h.back("t1");
            expect(h.version()).toBeGreaterThan(afterPush);
        });
    });

    it("does not bump the version on a deduped push", () => {
        withHistory(h => {
            h.pushHistory("t1", "a");
            const v = h.version();
            h.pushHistory("t1", "a");
            expect(h.version()).toBe(v);
        });
    });
});

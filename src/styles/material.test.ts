import { describe, expect, it } from "vitest";

import { blend, edge } from "./material.css";

describe("blend", () => {
    it("merges selector and media entries key by key instead of replacing them", () => {
        const out = blend(
            {
                color: "red",
                selectors: {
                    "&:hover": { color: "blue" },
                    "&::before": { content: '""' },
                },
                "@media": { "(hover: none)": { opacity: 1 } },
            },
            {
                padding: 0,
                selectors: { "&:hover": { background: "none" } },
            },
        );
        expect(out).toEqual({
            color: "red",
            padding: 0,
            selectors: {
                "&:hover": { color: "blue", background: "none" },
                "&::before": { content: '""' },
            },
            "@media": { "(hover: none)": { opacity: 1 } },
        });
    });
});

describe("edge", () => {
    it("alternates its two band tones, one pixel each, then drops a shadow", () => {
        expect(edge(3, "L", "D", "S")).toBe(
            "0 1px 0 L, 0 2px 0 D, 0 3px 0 L, S",
        );
    });

    // Rest and hover must be the same length, or the browser pairs a soft
    // drop with a hard band and morphs one into the other mid-transition.
    it("pads to a fixed slot count by tucking spare bands under the last one", () => {
        expect(edge(1, "L", "D", "S", 3)).toBe(
            "0 1px 0 L, 0 1px 0 D, 0 1px 0 L, S",
        );
        expect(edge(0, "L", "D", "S", 2)).toBe("0 0px 0 L, 0 0px 0 D, S");
    });
});

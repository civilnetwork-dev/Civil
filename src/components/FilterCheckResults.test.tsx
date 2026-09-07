import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { flush } from "solid-js";
import { describe, expect, it } from "vitest";

import type { FilterResult } from "~/lib/filterCheckVendors";

import FilterCheckResults from "./FilterCheckResults";

import * as s from "~/styles/FilterCheckPage.css";
import * as schematic from "~/styles/schematic.css";

/**
 * Every simulated event is followed by `flush()`. Solid 2.0 batches writes
 * made outside a computation, so a signal set inside a click handler has not
 * reached the DOM when the dispatch call returns.
 */

const RESULTS: FilterResult[] = [
    {
        filterKey: "securly",
        filterName: "Securly",
        status: "allowed",
        detail: "Access allowed",
        categories: ["Education"],
    },
    {
        filterKey: "goguardian",
        filterName: "GoGuardian",
        status: "blocked",
        detail: "Blocked - Gaming",
        categories: [],
    },
    {
        filterKey: "linewize",
        filterName: "Linewize",
        status: "unknown",
        detail: "Verdict unknown",
    },
];

function mount(results: FilterResult[]) {
    return renderSolid(() => <FilterCheckResults results={results} />);
}

const rows = (c: HTMLElement) => Array.from(c.querySelectorAll("li"));
const trigger = (li: HTMLElement) =>
    li.querySelector("button") as HTMLButtonElement;
const region = (li: HTMLElement) =>
    li.querySelector(`.${schematic.unfoldRegion}`) as HTMLElement;

describe("FilterCheckResults", () => {
    it("renders one li per result", () => {
        const { container, unmount } = mount(RESULTS);
        expect(rows(container).length).toBe(3);
        unmount();
    });

    it("shows each vendor's name and verdict text", () => {
        const { container, unmount } = mount(RESULTS);
        for (const result of RESULTS) {
            expect(container.textContent).toContain(result.filterName);
            expect(container.textContent).toContain(result.status);
        }
        unmount();
    });

    it("shows the category count in the row", () => {
        const { container, unmount } = mount(RESULTS);
        const found = rows(container).map(
            li => li.querySelector(`.${s.rowCat}`) as HTMLElement,
        );
        expect(found[0].textContent).toBe("1");
        expect(found[1].textContent).toBe("0");
        expect(found[2].textContent).toBe("0");
        unmount();
    });

    it("keeps detail text in the DOM but hides its region while collapsed", () => {
        const { container, unmount } = mount(RESULTS);
        const li = rows(container)[1];
        expect(li.textContent).toContain("Blocked - Gaming");
        expect(region(li).getAttribute("aria-hidden")).toBe("true");
        unmount();
    });

    it("sets aria-expanded to true when a row's trigger is clicked", () => {
        const { container, unmount } = mount(RESULTS);
        const li = rows(container)[0];
        expect(trigger(li).getAttribute("aria-expanded")).toBe("false");
        trigger(li).click();
        flush();
        expect(trigger(li).getAttribute("aria-expanded")).toBe("true");
        expect(region(li).getAttribute("aria-hidden")).toBe("false");
        unmount();
    });

    it("renders a column header row naming vendor and verdict", () => {
        const { container, unmount } = mount(RESULTS);
        const head = container.querySelector(`.${s.ledgerHead}`) as HTMLElement;
        expect(head.textContent).toContain("vendor");
        expect(head.textContent).toContain("verdict");
        unmount();
    });

    it("renders no li when results is empty", () => {
        const { container, unmount } = mount([]);
        expect(rows(container).length).toBe(0);
        unmount();
    });

    it("renders a distinct glyph for allowed, unknown and blocked", () => {
        const { container, unmount } = mount(RESULTS);
        const found = rows(container).map(
            li => li.querySelector(`.${s.rowVendor} svg`) as SVGElement,
        );
        const [allowedIcon, blockedIcon, unknownIcon] = found;

        expect(allowedIcon).toBeTruthy();
        expect(blockedIcon).toBeTruthy();
        expect(unknownIcon).toBeTruthy();

        // Structural: the markup each icon component renders (its <svg>
        // contents, e.g. path data) must differ, not merely the colour class.
        expect(allowedIcon.outerHTML).not.toBe(blockedIcon.outerHTML);
        expect(allowedIcon.outerHTML).not.toBe(unknownIcon.outerHTML);
        expect(blockedIcon.outerHTML).not.toBe(unknownIcon.outerHTML);

        // The colour channel (s.markIcon[status]) is also required to differ,
        // per the Redundant-Channel Rule, but structural difference above is
        // what actually proves distinct glyphs.
        expect(allowedIcon.getAttribute("class")).not.toBe(
            blockedIcon.getAttribute("class"),
        );
        expect(allowedIcon.getAttribute("class")).not.toBe(
            unknownIcon.getAttribute("class"),
        );
        expect(blockedIcon.getAttribute("class")).not.toBe(
            unknownIcon.getAttribute("class"),
        );

        unmount();
    });
});

describe("StatusMark glyph coverage", () => {
    /**
     * All five verdicts, not just the three the earlier test samples. A shared
     * glyph between any pair drops that pair to two redundant channels, and
     * colour is the channel a deuteranopic user trusts least. `error` and
     * `unknown` shared IconSpinnerFilled until this was pinned.
     */
    it("gives every status its own glyph", () => {
        const statuses: FilterResult["status"][] = [
            "allowed",
            "blocked",
            "warned",
            "error",
            "unknown",
        ];
        const shapes = new Map<string, string>();
        for (const status of statuses) {
            const { container, unmount } = mount([
                {
                    filterKey: status,
                    filterName: status,
                    status,
                    detail: "d",
                },
            ]);
            const svg = container.querySelector(
                `.${s.rowVendor} svg`,
            ) as SVGElement;
            const shape = svg.innerHTML;
            for (const [other, otherShape] of shapes) {
                expect(
                    shape,
                    `${status} and ${other} render the same glyph`,
                ).not.toBe(otherShape);
            }
            shapes.set(status, shape);
            unmount();
        }
        expect(shapes.size).toBe(5);
    });
});

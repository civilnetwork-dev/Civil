import { renderSolid } from "$tests/helpers/renderSolid";
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import * as icons from "./index";

/**
 * Geometry checks on what the glyphs actually render.
 *
 * These read the mounted DOM rather than the source text, so they test the
 * paths the browser gets rather than a regex's opinion of them.
 *
 * ## Why this file exists
 *
 * `IconArrowLeft` and `IconArrowRight` were once perfect mirrors of each other
 * and *both wrong*: one spanned x 3→13.5 and the other 2.5→13, so each sat a
 * quarter-unit off centre in its own 16-unit box, in opposite directions. Back
 * and forward therefore rendered at visibly different optical positions in the
 * chrome. Checking one arrow against the other would have passed. Checking each
 * against its own box is what catches it.
 */

/**
 * Glyphs allowed to sit off centre, each with the reason.
 *
 * The list is the point. Anything on it is a decision; anything off it is a
 * defect. Keep it as short as the drawings allow — `IconSearch` was on it until
 * shifting the lens and its handle a quarter-unit up and left cost nothing and
 * removed the exemption.
 */
const OFF_CENTRE_BY_DESIGN: Record<string, string> = {
    // Someone else's brand mark, deliberately not on our grid. Its bowl is
    // heavier than its stem and centring it would be redrawing the logo.
    IconPatreon: "third-party mark",
};

/** The drawing grid. Ink should centre on 8,8. */
const BOX = 16;
/** Half a stroke's worth of slack, in grid units. */
const TOLERANCE = 0.25;

type Point = { x: number; y: number };

/**
 * A path-data reader covering the subset these icons use: M/L/H/V and their
 * relative forms, C for the one curved glyph, and Z.
 *
 * Curve control points are folded into the bounds rather than solved for the
 * true extrema. That overestimates a curve's box, which is the safe direction
 * for a centring check — and the only curved glyph is allow-listed anyway.
 */
function pointsOf(d: string): Point[] {
    const out: Point[] = [];
    let x = 0;
    let y = 0;
    let startX = 0;
    let startY = 0;

    for (const [, cmd, rawArgs] of d.matchAll(
        /([MmLlHhVvCcZz])([^MmLlHhVvCcZz]*)/g,
    )) {
        const n = (rawArgs.match(/-?\d*\.?\d+/g) ?? []).map(Number);
        const rel = cmd === cmd.toLowerCase();
        const push = () => out.push({ x, y });

        switch (cmd.toUpperCase()) {
            case "M":
            case "L": {
                for (let i = 0; i + 1 < n.length; i += 2) {
                    x = rel ? x + n[i] : n[i];
                    y = rel ? y + n[i + 1] : n[i + 1];
                    push();
                    // A second coordinate pair after M is an implicit lineto,
                    // but the subpath still starts at the first one.
                    if (cmd.toUpperCase() === "M" && i === 0) {
                        startX = x;
                        startY = y;
                    }
                }
                break;
            }
            case "H": {
                for (const v of n) {
                    x = rel ? x + v : v;
                    push();
                }
                break;
            }
            case "V": {
                for (const v of n) {
                    y = rel ? y + v : v;
                    push();
                }
                break;
            }
            case "C": {
                for (let i = 0; i + 5 < n.length; i += 6) {
                    for (let k = 0; k < 6; k += 2) {
                        out.push({
                            x: rel ? x + n[i + k] : n[i + k],
                            y: rel ? y + n[i + k + 1] : n[i + k + 1],
                        });
                    }
                    x = rel ? x + n[i + 4] : n[i + 4];
                    y = rel ? y + n[i + 5] : n[i + 5];
                }
                break;
            }
            case "Z": {
                x = startX;
                y = startY;
                break;
            }
        }
    }
    return out;
}

/** Mount a glyph and collect every point in every path it draws. */
function inkOf(Glyph: (props: Record<string, never>) => unknown): Point[] {
    const { container, unmount } = renderSolid(
        () => Glyph({} as Record<string, never>) as never,
    );
    const pts = [...container.querySelectorAll("path")].flatMap(p =>
        pointsOf(p.getAttribute("d") ?? ""),
    );
    unmount();
    return pts;
}

const glyphs = Object.entries(icons).filter(
    ([name]) => !name.startsWith("$$"),
) as [string, (props: Record<string, never>) => unknown][];

describe("icon geometry", () => {
    it("draws every glyph from path data alone", () => {
        for (const [name, Glyph] of glyphs) {
            expect(
                inkOf(Glyph).length,
                `${name} renders no path points`,
            ).toBeGreaterThan(0);
        }
    });

    it("centres each glyph's ink in its own 16-unit box", () => {
        const offenders: string[] = [];

        for (const [name, Glyph] of glyphs) {
            if (name in OFF_CENTRE_BY_DESIGN) continue;

            const pts = inkOf(Glyph);
            const xs = pts.map(p => p.x);
            const ys = pts.map(p => p.y);
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

            if (
                Math.abs(cx - BOX / 2) > TOLERANCE ||
                Math.abs(cy - BOX / 2) > TOLERANCE
            ) {
                offenders.push(
                    `${name}: centre (${cx.toFixed(3)}, ${cy.toFixed(3)})`,
                );
            }
        }

        expect(offenders).toEqual([]);
    });

    /**
     * Back and forward are the same drawing reflected. Anything else — a
     * different shaft length, a barb at a different angle — reads as two
     * unrelated controls sitting next to each other in the chrome.
     */
    it("draws the back and forward arrows as exact mirrors", () => {
        const left = inkOf(icons.IconArrowLeft as never);
        const right = inkOf(icons.IconArrowRight as never);

        const key = (pts: Point[]) =>
            pts
                .map(p => `${p.x.toFixed(3)},${p.y.toFixed(3)}`)
                .toSorted()
                .join(" ");

        expect(key(left)).toBe(key(right.map(p => ({ x: BOX - p.x, y: p.y }))));
    });
});

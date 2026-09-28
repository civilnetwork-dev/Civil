import { describe, expect, it } from "vitest";

import * as icons from "./index";

const EXPECTED = [
    "IconAlert",
    "IconApps",
    "IconArrowLeft",
    "IconArrowRight",
    "IconArrowUpRight",
    "IconBan",
    "IconBookmark",
    "IconBookmarkFilled",
    "IconBookmarkOutline",
    "IconCheck",
    "IconChevronDown",
    "IconClock",
    "IconClose",
    "IconForward",
    "IconLayoutBottom",
    "IconLayoutNavbar",
    "IconLayoutSidebar",
    "IconLayoutSidebarRight",
    "IconLink",
    "IconLoader",
    "IconLoaderDots",
    "IconLock",
    "IconPatreon",
    "IconPlus",
    "IconPuzzle",
    "IconRefresh",
    "IconSearch",
    "IconSliders",
    "IconSpinner",
    "IconSpinnerFilled",
    "IconTrash",
    "IconUpload",
    "IconWorld",
] as const;

/**
 * The barrel is a `.tsx` module now that the icons are drawn here rather than
 * re-exported from `solid-icons`, and `@solidjs/vite-plugin` injects a
 * `$$moduleUrl` constant into every module it transforms. That is build-tool
 * metadata, not one of our exports, so the checks below look at what we
 * actually declare.
 */
const ours = Object.entries(icons).filter(([name]) => !name.startsWith("$$"));

describe("icon indirection layer", () => {
    it("exports every semantic name the app uses", () => {
        for (const name of EXPECTED) {
            expect(icons, `missing export: ${name}`).toHaveProperty(name);
        }
    });

    it("exports only functions", () => {
        for (const [name, value] of ours) {
            expect(typeof value, `${name} is not a component`).toBe("function");
        }
    });

    it("exports nothing vendor-shaped, so call sites stay portable", () => {
        for (const [name] of ours) {
            expect(name).toMatch(/^Icon[A-Z]/);
        }
    });

    it("has no duplicate underlying components under different names", () => {
        const seen = new Map<unknown, string>();
        const aliases: string[] = [];
        for (const [name, value] of ours) {
            const prior = seen.get(value);
            if (prior) aliases.push(`${name} === ${prior}`);
            else seen.set(value, name);
        }
        expect(aliases).toEqual([]);
    });
});

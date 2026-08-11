import { describe, expect, it } from "vitest";
import * as icons from "./index";

const EXPECTED = [
    "IconAlert",
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
    "IconSpinner",
    "IconSpinnerFilled",
    "IconTrash",
    "IconUpload",
    "IconWorld",
] as const;

describe("icon indirection layer", () => {
    it("exports every semantic name the app uses", () => {
        for (const name of EXPECTED) {
            expect(icons, `missing export: ${name}`).toHaveProperty(name);
        }
    });

    it("exports only functions", () => {
        for (const [name, value] of Object.entries(icons)) {
            expect(typeof value, `${name} is not a component`).toBe("function");
        }
    });

    it("exports nothing vendor-shaped, so call sites stay portable", () => {
        for (const name of Object.keys(icons)) {
            expect(name).toMatch(/^Icon[A-Z]/);
        }
    });

    it("has no duplicate underlying components under different names", () => {
        const seen = new Map<unknown, string>();
        const aliases: string[] = [];
        for (const [name, value] of Object.entries(icons)) {
            const prior = seen.get(value);
            if (prior) aliases.push(`${name} === ${prior}`);
            else seen.set(value, name);
        }
        expect(aliases).toEqual([]);
    });
});

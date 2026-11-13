import { afterEach, expect, it, vi } from "vitest";

import { getFilters } from "./filterDetect";

const cases = [
    ["prismaBrowser", "dbpnkcjkchadgbgihmmolkjcgjkodoaf", "block.html"],
    ["classlinkOneClick", "jgfbgkjjlonelmpenhpfeeljjlcgnkpe", "images/128x128.png"],
    ["iboss", "mkhjobnjhllkhekbbedlkmgcglgaeidc", "restricted.html"],
    ["iboss", "kmffehbidlalibfeklaefnckpidbodff", "restricted.html"],
    [
        "goguardian",
        "haldlgldplgnggkjaafhelgiaglafanh",
        "icons/enabled-light-128.png",
    ],
    [
        "goguardian",
        "haldlgldplgnggkjaafhelgiaglafanh",
        "icons/enabled-dark-128.png",
    ],
    ["imtLazarus", "cgigopjakkeclhggchgnhmpmhghcbnaf", "css/blocked_overlay.css"],
    ["imtLazarus", "cgigopjakkeclhggchgnhmpmhghcbnaf", "models/model.json"],
    ["securlyClassroom", "hkobaiihndnbfhbkmjjfbdimfbdcppdh", "disconnected.html"],
    ["securlyClassroom", "hkobaiihndnbfhbkmjjfbdimfbdcppdh", "notfound.html"],
] as const;

afterEach(() => vi.unstubAllGlobals());

it.each(cases)("detects %s through %s/%s", async (vendor, id, path) => {
    const resource = `chrome-extension://${id}/${path}`;
    vi.stubGlobal("fetch", async (url: string) =>
        new Response(null, { status: url === resource ? 200 : 404 }),
    );

    await expect(getFilters()).resolves.toEqual([vendor]);
});

it("reports no filters when all resource requests fail", async () => {
    vi.stubGlobal("fetch", async () => new Response(null, { status: 404 }));

    await expect(getFilters()).resolves.toEqual([]);
});

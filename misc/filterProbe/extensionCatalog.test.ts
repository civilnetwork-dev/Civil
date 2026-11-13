import { expect, it } from "vitest";

import { extensionEntries } from "./extensionCatalog";

it("adds the five authenticated identities without replacing legacy Gopher", () => {
    const legacy = {
        folder: "gopherbuddy",
        id: "cgbbbjmgdpnifijconhamggjehlamcif",
        updateUrl: "https://clients2.google.com/service/update2/crx",
    };
    const entries = extensionEntries([legacy]);
    expect(entries).toHaveLength(6);
    expect(entries[0]).toBe(legacy);
    expect(new Set(entries.map(entry => entry.id)).size).toBe(6);
    expect(
        entries.find(entry => entry.folder === "prismaBrowser"),
    ).toMatchObject({
        id: "dbpnkcjkchadgbgihmmolkjcgjkodoaf",
        source: "crx",
        updateUrl: expect.stringContaining("?prodchannel=stable"),
    });
    expect(entries.find(entry => entry.folder === "dyknowCloud")?.source).toBe(
        "manifest",
    );
});

it("keeps Civil's verified identity when the upstream entry conflicts", () => {
    const entries = extensionEntries([
        {
            folder: "prismaBrowser",
            id: "a".repeat(32),
            updateUrl: "https://example.com/wrong.crx",
        },
    ]);
    expect(
        entries.filter(entry => entry.folder === "prismaBrowser"),
    ).toHaveLength(1);
    expect(entries[0]?.id).toBe("dbpnkcjkchadgbgihmmolkjcgjkodoaf");
});

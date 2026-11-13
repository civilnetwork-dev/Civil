export interface ExtensionEntry {
    folder: string;
    id: string;
    updateUrl: string;
    source?: "crx" | "manifest" | "omaha";
}

const GOOGLE_UPDATE = "https://clients2.google.com/service/update2/crx";

const ADDITIONAL_EXTENSIONS: ExtensionEntry[] = [
    {
        folder: "prismaBrowser",
        id: "dbpnkcjkchadgbgihmmolkjcgjkodoaf",
        updateUrl:
            "https://hawkeye-extensions.talon-sec.com/crx/iopqrweunlsadkfcmvkfdhsja?prodchannel=stable",
        source: "crx",
    },
    {
        folder: "dyknowCloud",
        id: "ehldjdeaoebgafllfobddbfbfpmammmc",
        updateUrl:
            "https://crextnaut.securly.com/subscribers/defaultfrommanifest@securly.com/update-manifest.xml",
        source: "manifest",
    },
    {
        folder: "gopherBuddyPremium",
        id: "becdplfalooflanipjoblcmpaekkbbhe",
        updateUrl: GOOGLE_UPDATE,
        source: "omaha",
    },
    {
        folder: "classlinkAnalyticsPlus",
        id: "ihidolefpgnimlmgfljonacidpkmbhcl",
        updateUrl: GOOGLE_UPDATE,
        source: "omaha",
    },
    {
        folder: "classlinkOneClick",
        id: "jgfbgkjjlonelmpenhpfeeljjlcgnkpe",
        updateUrl: GOOGLE_UPDATE,
        source: "omaha",
    },
];

/** Civil additions remain available before the upstream catalog adopts them. */
export function extensionEntries(base: ExtensionEntry[]): ExtensionEntry[] {
    const entries = new Map(base.map(entry => [entry.folder, entry]));
    for (const entry of ADDITIONAL_EXTENSIONS) entries.set(entry.folder, entry);
    return [...entries.values()];
}

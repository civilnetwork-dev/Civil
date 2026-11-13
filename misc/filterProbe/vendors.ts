/**
 * The tracked filters, keyed by *vendor* rather than by extension id.
 *
 * Several vendors ship more than one extension against related backends:
 * Cisco's Security and Umbrella, Lightspeed's Filter and Insight, Securly's
 * core and Classroom, LanSchool's three, and Aristotle's two. Gopher Buddy
 * retains its own group despite its historical GoGuardian branding; its
 * premium successor keeps a separate catalog and detection identity.
 * The route test suite runs each vendor once. This map assigns the original
 * twenty-eight catalog folders and additional authenticated extensions to
 * the twenty-two groups used by the probe. A group does not establish
 * protocol equivalence or permit reusing a live classifier.
 *
 * The same twenty-two keys appear in `filterVendorDomains`
 * (misc/filters/filterBlockerMiddleware.ts) and in `probeData.json`; this file
 * is the one place the id→vendor collapse is written down.
 */

/** Extension folder (under `~/extensions` and in Filter-Sources) → vendor. */
export const FOLDER_TO_VENDOR: Record<string, string> = {
    aristotleEducator: "aristotle",
    aristotleStudent: "aristotle",
    blocksi: "blocksi",
    ciscoSecurity: "cisco",
    ciscoUmbrellaApp: "cisco",
    ciscoUmbrellaExtension: "cisco",
    ckauthenticatorg3: "contentkeeper",
    contentkeeper: "contentkeeper",
    classroomcloud: "netsupport",
    netsupport: "netsupport",
    fortiguard: "fortiguard",
    goguardian: "goguardian",
    gopherbuddy: "gopherbuddy",
    gopherBuddyPremium: "gopherbuddy",
    prismaBrowser: "prisma",
    dyknowCloud: "dyknow",
    classlinkAnalyticsPlus: "classlink",
    classlinkOneClick: "classlink",
    haparahighlights: "hapara",
    iboss: "iboss",
    impero: "impero",
    imtlazarus: "imtlazarus",
    interclass: "interclass",
    lanschoolAir: "lanschool",
    lanschoolStudent: "lanschool",
    lanschoolWebHelper: "lanschool",
    lightspeedFilterAgent: "lightspeed",
    lightspeedInsightAgent: "lightspeed",
    linewizeConnect: "linewize",
    loilo: "loilo",
    mobileguardian: "mobileguardian",
    securly: "securly",
    securlyClassroom: "securly",
};

/** Human-readable vendor names, used to build block-page markers and to read
 *  the harness's output. */
export const VENDOR_DISPLAY_NAMES: Record<string, string> = {
    aristotle: "Aristotle K12",
    blocksi: "Blocksi",
    cisco: "Cisco Umbrella",
    contentkeeper: "ContentKeeper",
    fortiguard: "FortiGuard",
    goguardian: "GoGuardian",
    gopherbuddy: "Gopher Buddy",
    prisma: "Prisma Browser",
    dyknow: "Dyknow Cloud",
    classlink: "ClassLink",
    hapara: "Hāpara",
    iboss: "iboss",
    impero: "Impero",
    imtlazarus: "IMTLazarus",
    interclass: "InterCLASS",
    lanschool: "LanSchool",
    lightspeed: "Lightspeed",
    linewize: "Linewize",
    loilo: "LoiLo",
    mobileguardian: "Mobile Guardian",
    netsupport: "NetSupport",
    securly: "Securly",
};

/** For a vendor that ships several extensions, the one to load into the
 *  sandbox as this vendor's representative: chosen by which one actually
 *  watches and blocks browsing, the thing this suite tests against, not by
 *  which folder name sounds most "student"-flavored. LanSchool is the
 *  cautionary case: `lanschoolStudent` is the classroom remote-control agent
 *  (no content scripts, a managed schema with zero filtering fields);
 *  `lanschoolWebHelper` is the real filter: it ships `blocked.html` as a
 *  web-accessible resource and calls `chrome.tabs.update(tabId, {url:
 *  blocked.html})` from several sites in its background. Verified against
 *  each bundle's actual manifest/background, not assumed from its name. */
export const VENDOR_PRIMARY_FOLDER: Record<string, string> = {
    aristotle: "aristotleStudent",
    blocksi: "blocksi",
    cisco: "ciscoSecurity",
    contentkeeper: "ckauthenticatorg3",
    fortiguard: "fortiguard",
    goguardian: "goguardian",
    gopherbuddy: "gopherBuddyPremium",
    prisma: "prismaBrowser",
    dyknow: "dyknowCloud",
    classlink: "classlinkAnalyticsPlus",
    hapara: "haparahighlights",
    iboss: "iboss",
    impero: "impero",
    imtlazarus: "imtlazarus",
    interclass: "interclass",
    lanschool: "lanschoolWebHelper",
    lightspeed: "lightspeedFilterAgent",
    linewize: "linewizeConnect",
    loilo: "loilo",
    mobileguardian: "mobileguardian",
    netsupport: "classroomcloud",
    securly: "securly",
};

/** Every distinct vendor, sorted. */
export const VENDORS: string[] = [
    ...new Set(Object.values(FOLDER_TO_VENDOR)),
].toSorted();

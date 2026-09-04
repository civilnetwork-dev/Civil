/**
 * The tracked filters, keyed by *vendor* rather than by extension id.
 *
 * Several vendors ship more than one extension against the same backend —
 * Cisco's Security and Umbrella, Lightspeed's Filter and Insight, Securly's
 * core and Classroom, LanSchool's three, Aristotle's two, GoGuardian's
 * GoGuardian + Gopher Buddy. The filter route test suite tests each *vendor*
 * once (the task's "every filter, not every id"), so this map — folder →
 * vendor — is what collapses the twenty-eight `~/extensions` folders and the
 * twenty-eight `Filter-Sources` entries down to the eighteen vendors that
 * actually differ.
 *
 * The same eighteen keys appear in `filterVendorDomains`
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
    gopherbuddy: "goguardian",
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
 *  sandbox as this vendor's representative — chosen by which one actually
 *  watches and blocks browsing, the thing this suite tests against, not by
 *  which folder name sounds most "student"-flavored. LanSchool is the
 *  cautionary case: `lanschoolStudent` is the classroom remote-control agent
 *  (no content scripts, a managed schema with zero filtering fields);
 *  `lanschoolWebHelper` is the real filter — it ships `blocked.html` as a
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
].sort();

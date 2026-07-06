export const FILTER_ID_MAP = new Map<string, string[]>([
    [
        "securly",
        [
            "kfiocjonplkilcjfgabfngiddebalkod",
            "lcgajdcbmhepemmlpemkkpgagieehmjp",
            "ckecmkbnoanpgplccmnoikfmpcdladkc",
            "joflmkccibkooplaeoinecjbmdebglab",
            "iheobagjkfklnlikgihanlhcddjoihkg",
        ],
    ],
    ["goguardian", ["haldlgldplgnggkjaafhelgiaglafanh"]],
    ["lanschool", ["baleiojnjpgeojohhhfbichcodgljmnj"]],
    ["linewize", ["ddfbkhpmcdbciejenfcolaaiebnjcbfc"]],
    ["blocksi", ["ghlpmldmjjhmdgmneoaibbegkjjbonbk"]],
    ["fortiguard", ["igbgpehnbmhgdgjbhkkpedommgmfbeao"]],
    ["ciscoSecurity", ["jgnjaoilojahgagddnkeankieagghabk"]],
    ["ciscoUmbrella", ["jcdhmojfecjfmbdpchihbeilohgnbdci"]],
    ["contentkeeper", ["jdogphakondfdmcanpapfahkdomaicfa"]],
    ["ckAuthenticatorG3", ["odoanpnonilogofggaohhkdkdgbhdljp"]],
    [
        "securlyClassroom",
        [
            "hkobaiihndnbfhbkmjjfbdimfbdcppdh",
            "jfbecfmiegcjddenjhlbhlikcbfmnafd",
        ],
    ],
    [
        "hapara",
        [
            "hpamladjhjimikgajbgjmcopoejbpnfp",
            "kbohafcopfpigkjdimdcdgenlhkmhbnc",
            "aceopacgaepdcelohobicpffbbejnfac",
        ],
    ],
    ["iboss", ["kmffehbidlalibfeklaefnckpidbodff"]],
    ["lightspeedDigitalInsightAgent", ["njdniclgegijdcdliklgieicanpmcngj"]],
    [
        "lightspeedFilterAgent",
        [
            "ehnniokiiebpinnfegpkdlcamgdcaaje",
            "adkcpkpghahmbopkjchobieckeoaoeem",
        ],
    ],
    ["lightspeedClassroom", ["kkbmdgjggcdajckdlbngdjonpchpaiea"]],
    ["interclassFilteringService", ["jbddgjglgkkneonnineaohdhabjbgopi"]],
    ["intersafeGatewayConnectionAgent", ["ecjoghccnjlodjlmkgmnbnkdcbnjgden"]],
    ["loiLoWebFilters", ["pabjlbjcgldndnpjnokjakbdofjgnfia"]],
    ["gopherBuddy", ["cgbbbjmgdpnifijconhamggjehlamcif"]],
    ["lanschoolWebHelper", ["honjcnefekfnompampcpmcdadibmjhlk"]],
    ["imtLazarus", ["cgigopjakkeclhggchgnhmpmhghcbnaf"]],
    ["imperoBackdrop", ["jjpmjccpemllnmgiaojaocgnakpmfgjg"]],
    ["mobileGuardian", ["fgmafhdohjkdhfaacgbgclmfgkgokgmb"]],
    ["netsupportSchoolStudent", ["gcjpefhffmcgplgklffgbebganmhffje"]],
    ["classroomdotcloudStudent", ["mpkdoimpgkhjcicmhmlmgboelebflpla"]],
    ["lockdownBrowser", ["fogjeanjfbiombghnmkmmophfeccjdki"]],
    ["linewizeFilter", ["ifinpabiejbjobcphhaomiifjibpkjlf"]],
    [
        "borderlessClassroomStudent",
        ["apchgbgnimojffnkddiigiekiooeieno", "kdpgkligilplaanoablcpjahjjeghcl"],
    ],
    ["lockdownBrowserAPClassroomEdition", ["djpknfecbncogekjnjppojlaipeobkmo"]],
    ["lugusSchool", ["eoobggamkobbcpiojefejfglbfcacgca"]],
    ["noDirectIp", ["hacaeeoapmdgmhifjcgbblcobgnmceff"]],
]);

export const FILTER_WAR_MAP = new Map<string, string | string[]>([
    ["securly", "fonts/Metropolis.css"],
    ["goguardian", "icons/enabled-dark-128.png"],
    ["lanschool", "blocked.html"],
    ["linewize", "background/assets/pages/default-blocked.html"],
    ["blocksi", "images/icons/yt-denied.png"],
    ["fortiguard", "block_iframe.html"],
    ["ciscoSecurity", "_locales/ja/messages.json"],
    ["ciscoUmbrella", "blocked.html"],
    ["contentkeeper", "img/ckauth19x.png"],
    ["ckAuthenticatorG3", "img/ckauth19x.png"],
    ["securlyClassroom", "notfound.html"],
    ["hapara", "blocked.html"],
    ["iboss", "restricted.html"],
    ["lightspeedDigitalInsightAgent", "js/speed_test.js"],
    ["lightspeedFilterAgent", ["blocked.png", "blocked-image-search.png"]],
    ["lightspeedClassroom", "assets/icon-classroom-128.png"],
    ["interclassFilteringService", "pages/message-page.html"],
    ["intersafeGatewayConnectionAgent", "resources/options.js"],
    ["loiLoWebFilters", "image/allow_icon/shield_green_128x128.png"],
    ["gopherBuddy", "images/gopher-buddy_128x128_color.png"],
    ["lanschoolWebHelper", "blocked.html"],
    ["imtLazarus", "models/model.json"],
    ["imperoBackdrop", "licenses.html"],
    ["mobileGuardian", "block.html"],
    ["netsupportSchoolStudent", "_locales/lt/messages.json"],
    ["classroomdotcloudStudent", "_locales/lt/messages.json"],
    ["lockdownBrowser", "manifest.json"],
    ["linewizeFilter", "chat/assets/imgs/pendo.png"],
    ["borderlessClassroomStudent", "pages/blockPage.html"],
    ["lockdownBrowserAPClassroomEdition", "assets/images/icon_128.png"],
    ["lugusSchool", "assets/images/icon_128.png"],
    ["noDirectIp", "icons/block.png"],
]);

function toArray<T>(value: T | T[] | undefined): T[] {
    if (value === undefined) return [];
    return Array.isArray(value) ? value : [value];
}

async function extensionResourceExists(
    extensionId: string,
    path: string,
): Promise<boolean> {
    const url = `chrome-extension://${extensionId}/${path}`;

    try {
        const response = await fetch(url, {
            method: "GET",
            cache: "no-store",
            credentials: "omit",
            redirect: "error",
        });

        if (response.headers.get("x-civil-probe-miss") === "1") return false;

        return response.ok;
    } catch {
        return false;
    }
}

export async function getFilters(): Promise<string[]> {
    const detected = new Set<string>();

    for (const [name, ids] of FILTER_ID_MAP) {
        const paths = toArray(FILTER_WAR_MAP.get(name));
        if (paths.length === 0) continue;

        let found = false;

        for (const id of ids) {
            for (const path of paths) {
                if (await extensionResourceExists(id, path)) {
                    detected.add(name);
                    found = true;
                    break;
                }
            }

            if (found) break;
        }
    }

    return [...detected];
}

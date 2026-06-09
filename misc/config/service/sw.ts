import type { UVConfig } from "@titaniumnetwork-dev/ultraviolet";
import mime from "mime/lite";
import genProxyPath from "$config/shared/genProxyPath";
import { decode, encode, init } from "$config/shared/wasmDencode";

declare global {
    interface Window {
        __uv$config: Partial<UVConfig>;
        UVServiceWorker: any;
    }
}

importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.sw.js");
importScripts("/scramjetController/controller.sw.js");

if (navigator.userAgent.includes("Firefox")) {
    Object.defineProperty(globalThis, "crossOriginIsolated", {
        value: true,
        writable: true,
    });
}

const ready = init().then(() => {
    const spf = genProxyPath("/", "uv");

    const files = ["uv.handler.js", "uv.client.js", "uv.bundle.js", "uv.sw.js"];
    const fileProps = Object.fromEntries(
        files.map(file => {
            const propName = file.split(".")[1];
            return [propName, `${spf}${file}`];
        }),
    );

    self.__uv$config = {
        prefix: genProxyPath("/~/", "uv"),
        encodeUrl: encode,
        decodeUrl: decode,
        ...fileProps,
        config: "/uv_config.js",
    };

    return {
        uv: new self.UVServiceWorker(),
    };
});

const CIVIL_EXT_RE = /^\/civil-ext\/([^/]+)\/(.+)$/;

async function serveCivilExt(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const match = CIVIL_EXT_RE.exec(url.pathname);
    if (!match) return null;

    const [, extId, filePath] = match;

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const parts = `extensions/${extId}/${filePath}`
            .split("/")
            .filter(Boolean);

        let dir: FileSystemDirectoryHandle = opfsRoot;
        for (let i = 0; i < parts.length - 1; i++) {
            dir = await dir.getDirectoryHandle(parts[i]!);
        }
        const fileName = parts[parts.length - 1]!;
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        const contentType =
            mime.getType(filePath) ?? "application/octet-stream";
        return new Response(file, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(file.size),
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return new Response("Extension file not found", { status: 404 });
    }
}

const CIVIL_CHII_PREAMBLE = `<script>
(function(){
  try {
    if (!window.__civilNativeWebSocket) {
      window.__civilNativeWebSocket = window.WebSocket;
    }
    if (!window.__civilNativeFetch) {
      window.__civilNativeFetch = window.fetch && window.fetch.bind(window);
    }
    if (!window.__civilNativeXHR) {
      window.__civilNativeXHR = window.XMLHttpRequest;
    }
    if (!window.__civilNativeMessageChannel) {
      window.__civilNativeMessageChannel = window.MessageChannel;
    }
    if (!window.__civilNativeMessagePort) {
      window.__civilNativeMessagePort = window.MessagePort;
    }
  } catch(e) {}
})();
</script>`;

async function injectChiiPreamble(response: Response): Promise<Response> {
    try {
        const ct = response.headers.get("content-type") || "";
        if (!ct.toLowerCase().includes("text/html")) return response;

        const text = await response.text();
        let modified: string;
        if (/<head[^>]*>/i.test(text)) {
            modified = text.replace(
                /<head([^>]*)>/i,
                `<head$1>${CIVIL_CHII_PREAMBLE}`,
            );
        } else if (/<html[^>]*>/i.test(text)) {
            modified = text.replace(
                /<html([^>]*)>/i,
                `<html$1>${CIVIL_CHII_PREAMBLE}`,
            );
        } else {
            modified = CIVIL_CHII_PREAMBLE + text;
        }

        const headers = new Headers(response.headers);
        headers.delete("content-length");
        return new Response(modified, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    } catch {
        return response;
    }
}

async function swResponse(event: FetchEvent) {
    const { request } = event;
    const url = new URL(request.url);

    if (url.pathname.startsWith("/civil-ext/")) {
        const extResponse = await serveCivilExt(request);
        if (extResponse) return extResponse;
    }

    if (url.pathname === "/chii" || url.pathname.startsWith("/chii/")) {
        return fetch(request);
    }

    const { uv } = await ready;

    if (
        request.url.startsWith(self.location.origin + self.__uv$config.prefix)
    ) {
        const response = await uv.fetch(event);
        return injectChiiPreamble(response);
    } else if (($scramjetController as any).shouldRoute(event)) {
        const response = (await ($scramjetController as any).route(
            event,
        )) as Response;
        return injectChiiPreamble(response);
    }

    return await fetch(request);
}

self.addEventListener("fetch", (event: FetchEvent) => {
    event.respondWith(swResponse(event));
});

const FILTER_ID_MAP = new Map<string, string[]>([
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

const FILTER_WAR_MAP = new Map<string, string | string[]>([
    ["securly", "fonts/Metropolis.css"],
    ["goguardian", "icons/enabled-dark-128.png"],
    ["lanschool", "blocked.html"],
    ["linewize", "background/assets/pages/default-blocked.html"],
    ["blocksi", "images/icons/yt-denied.png"],
    ["fortiguard", "youtube_injection.js"],
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

        return response.ok;
    } catch {
        return false;
    }
}

async function getFilters(): Promise<string[]> {
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

self.addEventListener("message", (event: ExtendableMessageEvent) => {
    const data = event.data as { type?: string } | undefined;

    if (data?.type !== "CHECK_FILTERS") {
        console.warn("Wrong event type:", data?.type);
        return;
    }

    event.waitUntil(
        getFilters()
            .then(filters => {
                event.source?.postMessage({
                    type: "CHECK_FILTERS_RESULT",
                    filters,
                });
            })
            .catch(error => {
                event.source?.postMessage({
                    type: "CHECK_FILTERS_ERROR",
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            }),
    );
});

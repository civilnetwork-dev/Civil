/**
 * Regenerates `probeData.json`: per vendor, where its block page lives and
 * what it says, the signals that mean "this filter noticed the proxy and
 * blocked it".
 *
 * ```sh
 * bun misc/filterProbe/buildProbeData.ts
 * # or, if the bundles live elsewhere:
 * CIVIL_FILTER_BUNDLES=/path/to/unpacked bun misc/filterProbe/buildProbeData.ts
 * # then lay the JSON out the way the repo formats it:
 * bunx oxfmt misc/filterProbe/probeData.json
 * ```
 *
 * ## Where each vendor's answer comes from
 *
 * `BLOCK_PAGES` below, read off the block pages themselves. The scan this
 * replaced matched a block-ish pattern over every script in a bundle, so it
 * committed log lines, comments and browser errors as markers ("IndexedDB
 * open blocked by another connection" stood in for Securly) and never saw
 * what Securly's block page says.
 *
 *   - A hosted block page (Securly on `*.securly.com/blocked`, GoGuardian on
 *     blocked.goguardian.com, Lightspeed, Linewize, Cisco, iboss,
 *     ContentKeeper on wh.contentkeeper.net) was found
 *     with the Wayback Machine's CDX API, a domain match across every
 *     subdomain, and the newest ten or more captures with distinct content
 *     were read in full. Markers are the lines they share, never a district's
 *     own name or message.
 *   - Most vendors block in a page inside their own extension
 *     (`chrome-extension://<id>/blocked.html`). That page, and the locale or
 *     script text it fills in, is read from the bundle.
 *   - ContentKeeper's page fills its block text in from script, which the
 *     check below strips, and districts reword it; its marker is the title
 *     the stock template keeps. Only two distinct captures exist.
 *
 * `domains` comes straight from `filterVendorDomains`
 * (misc/filters/filterBlockerMiddleware.ts), so the blocklist and the
 * detector never drift apart.
 *
 * ## Keeping it current
 *
 * After writing the file this checks the table against what vendors serve
 * now: each hosted page's newest captures, and each bundle present on this
 * machine. It names every marker nothing carries any more and, for a hosted
 * page, the lines most of its captures share that no marker covers yet. Move
 * what it reports into `BLOCK_PAGES` and run it again.
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { filterVendorDomains } from "../filters/filterBlockerMiddleware";
import { walkFiles } from "../walkFiles";
import { FOLDER_TO_VENDOR, VENDOR_DISPLAY_NAMES, VENDORS } from "./vendors";

export interface VendorProbe {
    displayName: string;
    /** Registrable phone-home / block-redirect domains. */
    domains: string[];
    /** Where the vendor sends a tab it blocked: `host/path` for a hosted
     *  page (the host or any subdomain, a path under it), or
     *  `chrome-extension:file` for one inside its own extension. */
    blockPages: string[];
    /** Lines this vendor's block page shows. */
    blockMarkers: string[];
}

export type ProbeData = Record<string, VendorProbe>;

type BlockPages = Pick<VendorProbe, "blockPages" | "blockMarkers">;

/** Read October 2026; the source of each is in the file comment. */
const BLOCK_PAGES: Record<string, BlockPages> = {
    aristotle: {
        blockPages: ["chrome-extension:blocked.html"],
        blockMarkers: [
            "The website you are attempting to reach has been blocked",
            "cannot be reached while a block-by-default policy is in place",
            "Internet browsing is currently restricted.",
        ],
    },
    blocksi: {
        blockPages: ["chrome-extension:blockPage.html"],
        blockMarkers: [
            "Blocksi | Access Denied",
            "Blocked by Youtube Keyword Filter",
            "Blocked by Blocksi web chat policy",
            "blocked by the school’s keyword filter list",
            "Access blocked due to general access time restrictions",
            "Access blocked due to bedtime restrictions",
        ],
    },
    cisco: {
        blockPages: ["block.opendns.com/", "chrome-extension:blocked.html"],
        blockMarkers: [
            "This site is blocked due to content filtering.",
            "This site was blocked due to the following categories:",
            "Block Page ID",
            "This site is blocked due to a security threat.",
            "SECURITY THREAT DETECTED AND BLOCKED",
            "has been blocked to prevent an attack on",
        ],
    },
    contentkeeper: {
        blockPages: ["wh.contentkeeper.net/"],
        blockMarkers: ["ContentKeeper Content Filtering"],
    },
    fortiguard: {
        blockPages: [
            "chrome-extension:block.html",
            "chrome-extension:blocked_page.htm",
            "chrome-extension:blocked_page_FGD_down.htm",
            "chrome-extension:blocksearch.html",
            "chrome-extension:blockvideo.html",
        ],
        blockMarkers: [
            "Web Page Blocked!",
            "administrator has blocked this category",
            "has been configured to block unknown urls",
            "the FortiGuard url rating service is inaccessible",
        ],
    },
    goguardian: {
        blockPages: [
            "blocked.goguardian.com/",
            "chrome-extension:x3/x3-block.html",
        ],
        blockMarkers: [
            "Page Blocked by School Admin",
            "This page has been blocked by your school",
            "Page blocked by your school",
            "All attempts are logged.",
        ],
    },
    hapara: {
        blockPages: [
            "chrome-extension:blocked.html",
            "chrome-extension:blocked_urls.html",
        ],
        blockMarkers: [
            "Hapara Highlights Extension - Blocked",
            "Are you in the right place for learning?",
            "There may be a better site to visit for now.",
            "Your browsing is guided by",
            "This page contains blocked content",
        ],
    },
    iboss: {
        blockPages: [
            "ibosscloud.com/syncCustomBranding/block_page/",
            "ibossgov.com/syncCustomBranding/block_page/",
            "chrome-extension:restricted.html",
        ],
        // A district's hosted page draws its message as an image: only the
        // title and the labels under it are text.
        blockMarkers: [
            "Page Restricted",
            "Access to the requested site has been restricted.",
            "Group Number:",
        ],
    },
    impero: {
        blockPages: ["chrome-extension:blocked.html"],
        blockMarkers: ["ask your teacher to whitelist the site"],
    },
    imtlazarus: {
        blockPages: [
            "chrome-extension:internettimelock.html",
            "chrome-extension:limittimelock.html",
            "chrome-extension:screentimelock.html",
        ],
        blockMarkers: [
            "Tiempo de internet excedido",
            "Límite horario excedido",
        ],
    },
    interclass: {
        blockPages: ["chrome-extension:message-page.html"],
        blockMarkers: [
            "ページがブロックされています",
            "このWebサイトへのアクセスは制限されています。",
            "利用時間が制限に達しました。",
        ],
    },
    lanschool: {
        blockPages: ["chrome-extension:blocked.html"],
        blockMarkers: [
            "The requested website is blocked.",
            "All websites are currently blocked.",
            "Browse by IP Address is blocked",
        ],
    },
    lightspeed: {
        blockPages: [
            "blocked.lsfilter.com/",
            "block.lsclassroom.com/",
            "lsrelay-config-production.s3.amazonaws.com/",
            "chrome-extension:block_screen.html",
        ],
        blockMarkers: [
            "Lightspeed Systems - DNS Cloud Filter",
            "your teacher has blocked this website for now",
            "Your access to the internet has been suspended for",
            "minutes for repeatedly attempting to visit blocked websites",
            "it is on a custom block list",
            "Internet access has been disabled on this device",
        ],
    },
    linewize: {
        blockPages: [
            "linewize.net/blocked",
            "chrome-extension:default-blocked.html",
            "chrome-extension:block-page-ctiru.html",
            "chrome-extension:block-page-iwf.html",
        ],
        // The hosted page renders its words from script, which no capture's
        // text carries; the redirect to it is the signal. These are the
        // extension's own pages.
        blockMarkers: [
            "has been blocked by your school",
            "The Linewize Team",
            "terrorist content identified through CTIRU safeguards",
            "indecent images of children as identified by the Internet Watch Foundation",
        ],
    },
    loilo: {
        blockPages: [
            "chrome-extension:blocked.html",
            "chrome-extension:blocked_night.html",
        ],
        blockMarkers: ["Webフィルタによりブロックされました"],
    },
    mobileguardian: {
        blockPages: ["chrome-extension:block.html"],
        blockMarkers: [
            "Request access to this site",
            "due to the device not having an internet connection",
        ],
    },
    netsupport: {
        blockPages: ["chrome-extension:weblock.html"],
        blockMarkers: [
            "Click Internet button for a list of approved web sites",
        ],
    },
    securly: {
        blockPages: [
            "securly.com/blocked",
            "chrome-extension:blocking/block.html",
            "chrome-extension:blocking/screenlock.html",
        ],
        // The hosted page says "This page has been blocked." or a district's
        // own sentence in its place, so neither is a marker; the first five
        // are on every capture, the last of them as an aria-label. The rest
        // are Securly Classroom's own block page, in the extension.
        blockMarkers: [
            "Looks like this page isn't allowed",
            "for explanation of blocking details",
            "Blocked by Category",
            "Site is in policy Block List",
            "Show more information about the blocked site",
            "This site has been blocked by a teacher",
            "This site has been blocked by the administrator",
            "This site is not available during site lock",
            "This content has been blocked by your administrator",
        ],
    },
};

/** A page's visible lines: scripts, styles and tags stripped. */
const textLines = (page: string): string[] =>
    page
        .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
        .replace(/<[^>]+>/g, "\n")
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&amp;/g, "&")
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean);

const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A Wayback Machine response's text. It answers a burst with 429 or 503, or
 * drops the socket, so those wait and retry; and a raw (`id_`) capture keeps
 * the encoding it was archived with, so a gzipped body is unpacked here.
 */
async function wayback(url: string): Promise<string> {
    for (let attempt = 1; ; attempt++) {
        const res = await fetch(url).catch((error: Error) => error);
        if (res instanceof Response && res.ok) {
            const body = Buffer.from(await res.arrayBuffer());
            const gzipped = body[0] === 0x1f && body[1] === 0x8b;
            return (gzipped ? gunzipSync(body) : body).toString("utf8");
        }
        const failure =
            res instanceof Response
                ? new Error(`${res.status} from ${url}`)
                : res;
        const retryable =
            !(res instanceof Response) ||
            res.status === 429 ||
            res.status === 503;
        if (attempt === 4 || !retryable) throw failure;
        await pause(10_000 * attempt);
    }
}

/**
 * The text of a hosted block page's newest captures with distinct content:
 * a CDX domain match, so `*.securly.com/blocked` and the like are covered
 * across every subdomain, filtered to the page's path.
 */
async function latestCaptures(page: string, count = 10): Promise<string[][]> {
    const slash = page.indexOf("/");
    const host = page.slice(0, slash);
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const query = new URLSearchParams({
        url: host,
        matchType: "domain",
        from: String(new Date().getFullYear() - 2),
        fl: "timestamp,original,digest",
        output: "json",
    });
    query.append("filter", "statuscode:200");
    query.append("filter", "mimetype:text/html");
    query.append(
        "filter",
        `original:https?://([^/]+\\.)?${escape(host)}(:\\d+)?${escape(page.slice(slash))}.*`,
    );
    const rows = (
        JSON.parse(
            await wayback(`https://web.archive.org/cdx/search/cdx?${query}`),
        ) as string[][]
    ).slice(1);

    const digests = new Set<string>();
    const pages: string[][] = [];
    for (const [timestamp, original, digest] of rows.toSorted((a, b) =>
        b[0]!.localeCompare(a[0]!),
    )) {
        if (pages.length === count) break;
        if (digests.has(digest!)) continue;
        digests.add(digest!);
        pages.push(
            textLines(
                await wayback(
                    `https://web.archive.org/web/${timestamp}id_/${original}`,
                ),
            ),
        );
        await pause(1_000); // the Wayback Machine refuses a burst
    }
    return pages;
}

function bundleText(root: string, vendor: string): string | undefined {
    const dirs = Object.entries(FOLDER_TO_VENDOR)
        .filter(([, v]) => v === vendor)
        .map(([folder]) => join(root, folder))
        .filter(dir => {
            try {
                return statSync(dir).isDirectory();
            } catch {
                return false; // bundle not present on this machine
            }
        });
    if (dirs.length === 0) return undefined;
    return dirs
        .flatMap(dir => walkFiles(dir))
        .filter(file => /\.(?:html?|js|json)$/i.test(file))
        .map(file => readFileSync(file, "utf8"))
        .join("\n");
}

/** Prints what the newest captures and the bundles no longer agree with. */
async function check(root: string): Promise<void> {
    for (const vendor of VENDORS) {
        const { blockPages, blockMarkers } = BLOCK_PAGES[vendor]!;
        const captures: string[][] = [];
        for (const page of blockPages.filter(p => !p.startsWith("chrome-"))) {
            try {
                captures.push(...(await latestCaptures(page)));
            } catch (error) {
                process.stdout.write(
                    `${vendor}: ${page} unreadable: ${error}\n`,
                );
            }
        }
        const bundle = bundleText(root, vendor);
        const seen = [...captures.map(lines => lines.join("\n")), bundle ?? ""];

        for (const marker of blockMarkers)
            if (!seen.some(text => text.includes(marker)))
                process.stdout.write(`${vendor}: nothing says "${marker}"\n`);

        const shared = new Map<string, number>();
        for (const lines of captures)
            for (const line of new Set(lines))
                shared.set(line, (shared.get(line) ?? 0) + 1);
        for (const [line, n] of shared)
            if (
                n * 2 >= captures.length &&
                line.length >= 18 &&
                !blockMarkers.some(marker => line.includes(marker))
            )
                process.stdout.write(
                    `${vendor}: ${n}/${captures.length} captures say "${line}"\n`,
                );
    }
}

async function main(): Promise<void> {
    const root =
        process.env.CIVIL_FILTER_BUNDLES ?? join(homedir(), "extensions");
    const domainsByVendor = filterVendorDomains as unknown as Record<
        string,
        readonly string[]
    >;

    const out: ProbeData = {};
    for (const vendor of VENDORS)
        out[vendor] = {
            displayName: VENDOR_DISPLAY_NAMES[vendor] ?? vendor,
            domains: [...(domainsByVendor[vendor] ?? [])],
            ...BLOCK_PAGES[vendor]!,
        };

    const target = join(import.meta.dirname, "probeData.json");
    writeFileSync(target, `${JSON.stringify(out, null, 4)}\n`);
    process.stdout.write(`wrote ${VENDORS.length} vendors to ${target}\n\n`);
    await check(root);
}

await main();

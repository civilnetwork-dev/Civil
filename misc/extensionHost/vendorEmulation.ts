/**
 * Per-vendor "configured and enrolled" emulation: `managedStorage` seeds and
 * a `network` responder that answers a vendor's *own* server-side calls with
 * well-formed, correctly-shaped data — offline and deterministically. Reused
 * by both `filterCompat.test.ts` ("starts up") and `sandbox.ts`
 * (`observeRoute`), so a vendor's real, fully-configured code path runs the
 * same way in either.
 *
 * ## Why emulated instead of live
 *
 * The alternative — flip `allowNetwork` on and let these calls reach the
 * vendor's real servers — was considered and set aside. Three reasons, the
 * same ones that already justified `lightspeedInsightAgent`'s emulated setup
 * below (see that entry's own comment, which predates this file): a test
 * suite that depends on a third party's live infrastructure being up,
 * unchanged, and reachable is not a deterministic test suite; repeated,
 * automated calls from test/CI infrastructure are not the traffic pattern
 * these vendors' servers are provisioned for; and where the request would
 * carry an identity at all, the only real ones available here are captured,
 * third-party school districts' own (Wayback Machine snapshots of their real
 * deployments) — building automated tooling that repeatedly presents as one
 * of those real schools to a vendor's production system is a materially
 * different, and more sensitive, thing to do than reading a public rating
 * once. `allowNetwork` (LoadOptions, and now SandboxOptions) still exists for
 * a deliberate, one-off, opted-in live run — see below — this module is what
 * makes that opt-in unnecessary for routine test runs.
 *
 * Every value below is either a fixed protocol constant (read out of the
 * vendor's own bundle, so the *shape* is real) or a real-but-non-personal
 * identifier — a district's bare domain, a device/cluster name — captured
 * from that vendor's own public Wayback Machine history. None of it is a
 * person: no captured student or staff email's local part is reused here (a
 * generic, non-institutional local part stands in instead), matching how
 * misc/filters/domainReputation.ts already drew this line for the same
 * reason.
 */

import {
    createCipheriv,
    createHash,
    randomBytes,
    randomUUID,
} from "node:crypto";

export interface VendorEmulation {
    managedStorage?: Record<string, unknown>;
    initialStorage?: Record<string, unknown>;
    initialBookmarks?: { title: string; url: string }[];
    network?: (request: {
        url: string;
        method: string;
    }) => Response | undefined | Promise<Response | undefined>;
}

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function xml(body: string): Response {
    return new Response(body, {
        status: 200,
        headers: { "content-type": "text/xml" },
    });
}

// ---------------------------------------------------------------------------
// Securly
// ---------------------------------------------------------------------------

/**
 * `/crextn/cluster` → a plain `<host>.securly.com` string is the "found, no
 * further action" case (misc/filters/securly/cluster.ts's own
 * `normalizeClusterUrl` documents the same three shapes from the other side).
 * A `_updateIWF`/`_disableIWF` suffix would additionally force an immediate
 * IWF/CIPA refresh; that isn't the only trigger, though — the bundle's own
 * `iwfService`/`cipaService` each check their *own* last-updated timestamp on
 * every startup regardless, and a fresh IndexedDB (every observation gets one
 * — see sandbox.ts) has none recorded, so they always decide a download is
 * due. Answered below rather than avoided.
 */
const SECURLY_CLUSTER = "useast2-www.securly.com";

/**
 * CryptoJS's own default `AES.encrypt(text, passphrase).toString()`: OpenSSL
 * salted key derivation (repeated MD5 of prev+passphrase+salt),
 * `"Salted__" + 8-byte salt + AES-256-CBC ciphertext`, PKCS7-padded,
 * base64-encoded. The inverse of the OpenSSL decrypt misc/tunnel/
 * captchaSolver.ts already implements for a different vendor's bundle, needed
 * here in the other direction — to build a payload securly.min.js's own
 * `CryptoJS.AES.decrypt(body, phraseMatchPassPhrase)` reads back correctly.
 * Round-trip verified against a mirrored decrypt before use here.
 */
function cryptoJsEncrypt(plaintext: string, passphrase: string): string {
    const salt = randomBytes(8);
    let derived = Buffer.alloc(0);
    let previous = Buffer.alloc(0);
    const passphraseBytes = Buffer.from(passphrase, "utf8");
    while (derived.length < 48) {
        previous = createHash("md5")
            .update(Buffer.concat([previous, passphraseBytes, salt]))
            .digest();
        derived = Buffer.concat([derived, previous]);
    }
    const cipher = createCipheriv(
        "aes-256-cbc",
        derived.subarray(0, 32),
        derived.subarray(32, 48),
    );
    const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
    ]);
    return Buffer.concat([
        Buffer.from("Salted__", "utf8"),
        salt,
        ciphertext,
    ]).toString("base64");
}

/**
 * `cdn1.securly.com/pmatch.json` — read out of `securly.min.js`'s own
 * `downloadPhraseMatch`, along with the passphrase (`"SeCuRlY@321$"`, a
 * hardcoded client-side string, not a secret this project derived) and the
 * default, empty `{Bully, Grief, Violence}` shape the bundle itself falls
 * back to before any list ever loads — the honest "nothing flagged yet"
 * state, not a fabricated one.
 */
const SECURLY_PHRASE_MATCH_PASSPHRASE = "SeCuRlY@321$";
function securlyPhraseMatchResponse(): Response {
    const body = cryptoJsEncrypt(
        JSON.stringify({ Bully: [], Grief: [], Violence: [] }),
        SECURLY_PHRASE_MATCH_PASSPHRASE,
    );
    return new Response(body, {
        status: 200,
        headers: { "content-type": "text/plain" },
    });
}

/**
 * `<cluster>/broker` → `DECISION:policyId:categoryId:keyword:extra1:extra2:
 * extra3:checkIframes:basegene`, colon-delimited (confirmed against the real
 * bundle's own parser, not just this project's reimplementation in
 * misc/filters/securly/broker.ts — same shape, independently). `ALLOW` with
 * no category bits and no keyword is an ordinary, unblocked verdict.
 */
function securlyBrokerResponse(): Response {
    return new Response("ALLOW:1:0:::::0:0", {
        status: 200,
        headers: { "content-type": "text/plain" },
    });
}

/** `crextnaut.securly.com/subscribers/.../update-manifest.xml` → the gupdate
 *  manifest the bundle reads its own version from before calling the broker.
 *  Any `appid` works: the bundle only ever looks up its own. */
function securlyUpdateManifest(): Response {
    return xml(
        `<?xml version="1.0" encoding="UTF-8"?>` +
            `<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">` +
            `<app appid="kfiocjonplkilcjfgabfngiddebalkod">` +
            `<updatecheck codebase="" version="3.0.60"/>` +
            `</app></gupdate>`,
    );
}

/** `cdn1.securly.com/config.json` → the bundle's own client config, read
 *  before its skiplist cache is used. An empty-but-present `skiplist` is a
 *  real "nothing cached yet" config, not a fabricated one — a fresh device
 *  gets exactly this. */
function securlyClientConfig(): Response {
    return json({ skiplist: [] });
}

/**
 * `iwf-encode.txt` / `cipa-set-encrypted.txt` — the two remaining downloads
 * `iwfService`/`cipaService` each attempt (real endpoint names, read out of
 * the bundle, same as everything else here). Unlike the phrase-match list,
 * their on-the-wire encoding wasn't fully reverse-engineered — batch
 * IWF/CIPA domain-list formats, not a single documented `CryptoJS.AES`
 * call — so this answers 200 with an empty body rather than the fabricated
 * 503 both were getting, which is honest about what's known (a real,
 * empty-shaped success) without claiming to know a format that wasn't
 * confirmed. Both already fail *closed* — logged and continued, never
 * thrown — even when this returns nothing usable, so nothing regresses by
 * trying.
 */
function securlyEmptyListResponse(): Response {
    return new Response("", {
        status: 200,
        headers: { "content-type": "text/plain" },
    });
}

const securlyNetwork: VendorEmulation["network"] = ({ url }) => {
    if (url.includes("/crextn/cluster")) {
        return new Response(SECURLY_CLUSTER, {
            status: 200,
            headers: { "content-type": "text/plain" },
        });
    }
    if (url.includes("/crextn/broker")) return securlyBrokerResponse();
    if (url.includes("/subscribers/") && url.includes("update-manifest.xml"))
        return securlyUpdateManifest();
    if (url.includes("cdn1.securly.com/config.json"))
        return securlyClientConfig();
    if (url.includes("cdn1.securly.com/pmatch.json"))
        return securlyPhraseMatchResponse();
    if (
        url.includes("cdn1.securly.com/iwf-encode.txt") ||
        url.includes("cdn1.securly.com/cipa-set-encrypted.txt")
    )
        return securlyEmptyListResponse();
    return undefined;
};

const securly: VendorEmulation = { network: securlyNetwork };

// ---------------------------------------------------------------------------
// iboss
// ---------------------------------------------------------------------------

/**
 * `common/Settings.js`'s own field list (read directly out of the bundle) is
 * what "No managed settings detected... Waiting for valid parameters. Check
 * GATEWAY_HOST, SECURITY_KEY, and PAC_URL" is asking for by name.
 * `cluster147478-swg.ibosscloud.com` is a real gateway cluster, the most
 * persistently-recaptured one in the Wayback Machine index — the same
 * default `misc/filters/domainReputation.ts` uses for the same reason.
 * `SECURITY_KEY` isn't a captured value (this project never had a real one to
 * capture); `IBOSS_SECURITY_KEY` reuses the same env var the domain-reputation
 * checker already requires, so a real key set there benefits both, and a
 * generated placeholder keeps the settings object *shaped* right without one.
 */
function ibossPacResponse(): Response {
    // A trivial, valid PAC script — DIRECT for everything. `Invalid PAC
    // Settings` was the bundle correctly rejecting the empty string the
    // offline stub was answering with before; a syntactically real one (even
    // a no-op) is what a working PAC endpoint would actually return.
    return new Response(
        'function FindProxyForURL(url, host) { return "DIRECT"; }',
        {
            status: 200,
            headers: { "content-type": "application/x-ns-proxy-autoconfig" },
        },
    );
}

const iboss: VendorEmulation = {
    managedStorage: {
        MANAGED: true,
        // Settings.js types this numeric (`static ACCOUNT_ID=-1`); the
        // bundle's own validation rejects a non-numeric/placeholder value
        // with "Bad type or value for ACCOUNT_ID". Not a captured value —
        // just a positive integer shaped like the field wants.
        ACCOUNT_ID: 1,
        GATEWAY_HOST: "cluster147478-swg.ibosscloud.com",
        GATEWAY_PORT: 80,
        GATEWAY_SSL_PORT: 9595,
        CLOUD_CATEGORIZATION_SSL_PORT: 8026,
        SECURITY_KEY: process.env.IBOSS_SECURITY_KEY || randomUUID(),
        PAC_URL: "https://cluster147478-swg.ibosscloud.com/proxy.pac",
        RUNTIME_MODE: "gen3",
    },
    network: ({ url }) =>
        url.endsWith("/proxy.pac") ? ibossPacResponse() : undefined,
};

// ---------------------------------------------------------------------------
// Cisco Umbrella (ciscoSecurity)
// ---------------------------------------------------------------------------

/**
 * `schema.json`'s real `organizationInfo` fields, shaped-placeholder values
 * (no real Umbrella org to capture, same reasoning as iboss's SECURITY_KEY)
 * — this gets the background running its real registered-org code path
 * instead of an undefined one, but doesn't change what this vendor can ever
 * flag through this harness: its actual mechanism is a system proxy
 * (`chrome.proxy.settings` + a PAC script Umbrella's cloud serves), which
 * `sandbox.ts`'s direct fetch never routes through, configured or not —
 * see misc/filterProbe/sandbox.ts's own doc comment on that ceiling.
 * `failClose` is left at its real default (`false`, read directly out of
 * `background.js`'s own `En("failClose",!1)`) rather than forced `true`:
 * fabricating fail-closed would make every route "flagged" because the
 * proxy setup itself can't succeed here, not because Civil tripped any
 * category — a false positive in the other direction, not a fix.
 */
const cisco: VendorEmulation = {
    managedStorage: {
        organizationInfo: {
            organizationId: 1,
            regToken: randomUUID(),
            productId: 1,
            environment: "prod",
            mdmId: "civil-filterprobe",
            deploymentKey: randomUUID(),
            deploymentKeyName: "civil-filterprobe",
        },
        failClose: false,
    },
};

// ---------------------------------------------------------------------------
// Impero
// ---------------------------------------------------------------------------

/**
 * Not managed storage at all — `js/serviceWorker.js`'s `ImperoBookmarkSearcher`
 * reads its school code from a bookmark: title exactly `"impero"`
 * (`ImperoBookmark.IMPERO_BOOKMARK_TITLE`), URL a `imperosoftware.com`
 * origin (`IMPERO_BOOKMARK_ORIGIN`) carrying a `school_code` query parameter
 * (`IMPERO_BOOKMARK_KEY`) exactly six characters long — every constant read
 * directly out of the bundle's own `ImperoBookmark` class, not guessed.
 * `initialBookmarks` (api/bookmarks.ts) is what makes seeding one possible
 * at all; nothing here needed it before Impero.
 *
 * A valid code unlocks `SchoolClusterService.getClusterHostName()`: `POST
 * https://api.global.backdrop.cloud/clusters` with `{device_id, school_code}`,
 * response `{cluster_hostname}` — then `isIpBlocked()`'s own check, `GET
 * https://{cluster_hostname}/devices/ip_check/{school_code}` (the literal
 * `Authorization: Bearer 0xBADC0FFEE` the bundle sends is a fixed API-level
 * token shipped in the extension itself, not a real secret), response
 * `{ip_blocked}` — `false` here is the honest answer for this host's own
 * traffic, not a thumb on the scale. `cluster_hostname` is pointed at a
 * fictitious host `network` below also answers, so the chain doesn't break
 * on the next hop.
 *
 * What happens *after* authenticating is unconfirmed: `js/content_script.js`
 * is 565 bytes with no block/deny logic in it, and nothing else found here
 * points at a `tabs.update`/`executeScript`/declarativeNetRequest-based
 * block either. Getting past this gate is what's evidenced; getting a
 * flaggable signal out the other side isn't, and isn't claimed.
 */
const IMPERO_CLUSTER_HOST = "impero-cluster.civil-filterprobe.test";

const impero: VendorEmulation = {
    initialBookmarks: [
        {
            title: "impero",
            url: `https://imperosoftware.com/?school_code=CVLFP0`,
        },
    ],
    network: ({ url }) => {
        if (url.includes("api.global.backdrop.cloud/clusters"))
            return json({ cluster_hostname: IMPERO_CLUSTER_HOST });
        if (
            url.includes(IMPERO_CLUSTER_HOST) &&
            url.includes("/devices/ip_check/")
        )
            return json({ ip_blocked: false });
        return undefined;
    },
};

// ---------------------------------------------------------------------------
// Blocksi
// ---------------------------------------------------------------------------

/**
 * No `managed_schema` either. `background.js`'s own `checkLicense` retry loop
 * (`w(e,t)`, five attempts, 3s/6s/9s/12s backoff, "Exceeded maximum retry
 * attempts in checkLicense") only retries when its fetch wrapper *throws* —
 * a genuine network failure — not on a non-2xx status: the response is
 * always awaited as `.json()` with no `.ok` check in between. That means
 * this host's unseeded default (an offline 503 that still *resolves*, never
 * rejects) shouldn't have been retrying at all on its own... except every
 * vendor bundle here goes through a `fetch` *wrapper*, and the common
 * pattern for one is to throw on a non-2xx response itself. A plain 200 is
 * therefore the load-bearing part of this fix, not the body's exact shape:
 * with no `licenseType` set (the default, unseeded state), `f()`'s own logic
 * takes the "register as user" branch and posts to `registerUser_v3` — so
 * that's the one response worth being honest-shaped for.
 * `getCompanyByDomain`/`getGeneralSettings`/`registerDevice`/`getPolicy` are
 * answered the same generic way: 200, a plausible-shaped body built from
 * confirmed real field names (`companyId`, `deviceId`, `userEmail`,
 * `blocksiVersion`), nothing that asserts a specific policy or block/allow
 * verdict either way.
 */
function blocksiJson(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

const blocksi: VendorEmulation = {
    network: ({ url }) => {
        if (!url.includes("blocksi.net")) return undefined;
        if (url.includes("registerUser_v3") || url.includes("registerDevice"))
            return blocksiJson({
                success: true,
                licenseType: "user",
                companyId: "civil-filterprobe",
                deviceId: "civil-filterprobe-device",
            });
        if (url.includes("getGeneralSettings"))
            return blocksiJson({ licenseType: "user" });
        if (url.includes("getCompanyByDomain"))
            return blocksiJson({ companyId: "civil-filterprobe" });
        if (url.includes("getPolicy"))
            return blocksiJson({ blockedCategories: [], allowedUrls: [] });
        return blocksiJson({});
    },
};

// ---------------------------------------------------------------------------
// Lightspeed Filter Agent
// ---------------------------------------------------------------------------

/**
 * No `managed_schema` at all — unlike every other vendor here, this one
 * isn't gated by chrome.storage.managed. Its worker.js (obfuscated with a
 * per-file string-table decoder; extracted and run in a sandboxed vm to
 * recover the real literals rather than guessed) builds its license request
 * from `chrome.enterprise.deviceAttributes.getDeviceSerialNumber()` — a
 * previously-unimplemented API, added in api/enterprise.ts — against a
 * hardcoded host, `apiProto + apiHost` = `https://filter-agent.
 * lightspeedsystems.app`, then `apiLicensesPath` = `/licenses` and
 * `apiUserPolicyPath` = `/filter/chrome/v2/user_policy`.
 *
 * The response shapes are the least-certain emulation in this file: the
 * decoder recovers every string literal the bundle contains, not which ones
 * a specific response handler destructures, and this bundle's async control
 * flow is compiled through a regenerator-runtime state machine that resists
 * the same kind of direct reading FortiGuard's rating call got. What's
 * seeded is what the recovered strings support with real confidence —
 * `license_status: "active"` (the bundle's own `setLicenseStatus` setter
 * exists, and "active" is the one plausible status literal it contains) and
 * `validPolicy: true` (confirmed as this bundle's own in-memory default
 * before any policy loads, `'validPolicy':!0x0` in the recovered source) —
 * with every category/channel list left genuinely empty rather than a
 * invented specific block, the same "honest, nothing-flagged-yet" shape as
 * Securly's phrase-match list below. If a field this doesn't include turns
 * out to be required, the bundle's own established resilience (checked
 * against real bundles throughout this file) is to fail closed and log
 * rather than throw — worth a wrong guess's downside being bounded, not
 * worth extending the guess further on strings alone.
 */
const LIGHTSPEED_FILTER_HOST = "filter-agent.lightspeedsystems.app";

function lightspeedLicenseResponse(): Response {
    return new Response(JSON.stringify({ license_status: "active" }), {
        status: 200,
        headers: { "content-type": "application/json" },
    });
}

function lightspeedPolicyResponse(): Response {
    return new Response(
        JSON.stringify({
            validPolicy: true,
            blockedCategories: [],
            blockedChannels: [],
            blockedRefererCatIds: [],
            smartplayBlockedCategories: [],
            shortCats: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
    );
}

const lightspeedFilterAgent: VendorEmulation = {
    network: ({ url }) => {
        if (!url.includes(LIGHTSPEED_FILTER_HOST)) return undefined;
        if (url.includes("/licenses")) return lightspeedLicenseResponse();
        if (url.includes("/user_policy")) return lightspeedPolicyResponse();
        return undefined;
    },
};

// ---------------------------------------------------------------------------
// FortiGuard
// ---------------------------------------------------------------------------

/**
 * `schema.json`'s six fields, but `service_worker.js`'s own `SCHEMA` array
 * only actually reads four of them (`ProfileServerUrl`, `InvitationCode`,
 * `SerialNumber`, `SiteName`) — `RatingServerUrl`/`AuthServerUrl` are in the
 * schema but not fetched; every rating call goes to a hardcoded
 * `wsfgd1.fortiguard.net:3400` regardless of what the admin console would
 * configure. `InvitationCode`/`SerialNumber`/`SiteName` are plain identifier
 * strings the bundle doesn't verify against anything, shaped placeholders
 * same as iboss's `SECURITY_KEY`; `ProfileServerUrl` likewise isn't a
 * captured real endpoint — nothing observed treats it as load-bearing beyond
 * passing schema validation, and an unanswered fetch to it 503s through the
 * ordinary offline path, which the bundle already handles without throwing.
 */
const FORTIGUARD_RATING_HOST = "wsfgd1.fortiguard.net";

/**
 * `service/wfquery`'s real response shape, confirmed from the bundle's own
 * parsing (`{status, data: [{action, categoryId, categoryName, ...}]}`,
 * `status !== 0` on failure) and which `action` value means "not blocked" —
 * not inferred, read directly off `unblockTab()`'s own
 * `setBlocked(false); setAction(1)` pair, with `2`/`3` confirmed as the
 * values `blockTab()` triggers on elsewhere in the same file. `categoryId: 1`
 * pairs with `action: 1` in the bundle's own category table
 * (`1: "General Interest - Business"`) — the same honest "ordinary, allowed"
 * verdict shape as Securly's `ALLOW:1:0:::::0:0` below, not a fabricated
 * category chosen to steer the result either way.
 */
function fortiguardRatingResponse(): Response {
    return new Response(
        JSON.stringify({
            status: 0,
            data: [
                {
                    action: 1,
                    categoryId: 1,
                    categoryName: "General Interest - Business",
                },
            ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
    );
}

const fortiguard: VendorEmulation = {
    managedStorage: {
        ProfileServerUrl: "https://wsfgd1.fortiguard.net:3400/",
        InvitationCode: randomUUID(),
        SerialNumber: `FGTA0E${randomBytes(6).toString("hex").toUpperCase()}`,
        SiteName: "civil-filterprobe",
    },
    network: ({ url }) =>
        url.includes(FORTIGUARD_RATING_HOST) && url.includes("wfquery")
            ? fortiguardRatingResponse()
            : undefined,
};

// ---------------------------------------------------------------------------
// Linewize
// ---------------------------------------------------------------------------

/**
 * `otorohanga.college.nz` is the most-recaptured device identity in the
 * Wayback Machine index for Linewize's own domain — a school's device-network
 * name, not a person. `misc/filters/domainReputation.ts` uses the same value
 * for the same reason.
 *
 * The managed-policy shape below was previously flat (`{deviceId, identity}`)
 * and never actually read: `schema.json` nests the whole policy one level
 * down — `{"configuration": {region, applianceId, preSharedKey}}`, all three
 * required (the schema's own comment: "Since additionalProperties is not
 * allowed in Chrome this is a workaround for limiting the field to
 * configuration field only") — and the bundle's one `.managed.get(...)` call
 * site (background.bundle.js) reads exactly `.get("configuration")
 * .configuration.region`/`.applianceId`. `region` is one of the schema's own
 * enum values (`syd-1`|`syd-2`|`uk-1`|`beta-1`|`sit`); `applianceId`/
 * `preSharedKey` aren't captured real values (this project never had real
 * ones) — shaped placeholders, same as `iboss`'s `SECURITY_KEY` below.
 *
 * This gets the extension past the immediate "no configuration" gate, but not
 * necessarily further: the identity it then exchanges with its appliance is a
 * hand-rolled protobuf message (`customerSerial`/`tenantId`/`applianceId`/
 * `deviceId`/`username`/`unifiedUserId`, protobuf-js `uint32(N).string(...)`
 * field encoding) over what the bundle treats as a persistent connection —
 * not a REST/XML call `network` below can answer the way Securly's or
 * iboss's can. Real activation past this point would need that protocol
 * emulated too; not attempted here.
 */
const linewize: VendorEmulation = {
    managedStorage: {
        configuration: {
            region: "syd-1",
            applianceId: "otorohanga-college-nz",
            preSharedKey: randomUUID(),
        },
    },
    initialStorage: {
        deviceId: "otorohanga.college.nz",
    },
};

// ---------------------------------------------------------------------------
// Aristotle K12
// ---------------------------------------------------------------------------

/**
 * `~/extensions/aristotleStudent/config.json` — the installed extension's
 * own, unobfuscated, live config — not something scraped from wayback at all:
 * a real `{domain, auth_key, auth_secret}` triple for Lenape Regional High
 * School District, NJ, shipped in the extension itself (see
 * misc/filters/aristotle/checker.ts's doc comment for the fuller story of how
 * this was found and why it settles "is the secret derived or fixed").
 */
const aristotle: VendorEmulation = {
    managedStorage: {
        domain: "lenape.aristotleinsight.com",
        auth_key: "aristotle-chrome-agent",
        auth_secret:
            "dec18994c0964e2c38508ee4abd7b46c1bf6ef32de1d03c7202236896335a934a3d8e7e3e755de31f2dd1f8291d59be3504ab02358b212a61c5652c3f6f37a04",
    },
};

/** Folder name (as in Filter-Sources / `~/extensions`) → emulation. Vendors
 *  that ship more than one folder (Securly, Aristotle) get the same
 *  emulation under each, since they share one backend. */
export const VENDOR_EMULATION: Record<string, VendorEmulation> = {
    securly,
    securlyClassroom: securly,
    iboss,
    linewizeConnect: linewize,
    aristotleStudent: aristotle,
    aristotleEducator: aristotle,
    fortiguard,
    lightspeedFilterAgent,
    blocksi,
    impero,
    ciscoSecurity: cisco,
};

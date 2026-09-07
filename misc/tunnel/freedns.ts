/**
 * A typed FreeDNS (freedns.afraid.org) client.
 *
 * A port of ading2210's `freedns-client` `client.py`
 * (https://github.com/ading2210/freedns-client) — same endpoints, same form
 * fields, same "a 302 means it worked" success test — with three deliberate
 * differences:
 *
 *   1. `xior`, not `fetch`, for every request (the rest of Civil's outbound
 *      HTTP goes through xior too — see misc/filters/securly/cluster.ts), and
 *      `redirect: "manual"` so a 302 stays a 302 to read rather than being
 *      followed into the page it points at.
 *   2. Credentials come from `FREEDNS_EMAIL` / `FREEDNS_PASSWORD` (FreeDNS
 *      accepts an email in its username field), so nothing calling this has
 *      to hold them. `login()` with no arguments reads the environment.
 *   3. A `deleteSubdomain` the reference doesn't have — the tunnel teardown
 *      needs it (see index.ts), and it is the one method here modelled on
 *      FreeDNS's own delete form rather than on the reference client.
 *
 * FreeDNS has no JSON API; every response is an HTML page, so the parsing
 * mirrors the reference's CSS selectors exactly (`table[width="95%"]`,
 * `tr.trl, tr.trd`, and so on) using htmlparser2 + domutils. The registry and
 * subdomain listings are login-gated, so those selectors are verified against
 * the reference client's documented structure rather than a live capture; the
 * public shape has been stable for years.
 *
 * Captchas are not solved here. `createSubdomain`, `createAccount` and
 * `updateSubdomain` take a `captchaCode` the caller obtained from
 * `getCaptcha()` and solved by hand — the same contract the reference keeps,
 * and the right one: auto-solving a bot check is neither this library's job
 * nor something it should pretend to do.
 */

import { type AnyNode, type Element, isTag } from "domhandler";
import { findAll, findOne, getAttributeValue, textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import xior, { type XiorInstance, type XiorResponse } from "xior";

const BASE_URL = "https://freedns.afraid.org";

/** The Firefox UA the reference sends. Kept verbatim: FreeDNS is an old site
 *  and there is no reason to look like anything it hasn't seen. */
const USER_AGENT =
    "Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0";

export class FreeDnsError extends Error {}

export interface RegistryDomain {
    domain: string;
    id: number;
    hosts: number;
    status: string;
    ownerName: string;
    ownerId: number;
    /** Days since the domain was added. */
    age: number;
    created: string;
}

export interface Registry {
    domainsInfo: { pageStart: number; pageEnd: number; total: number };
    pagesInfo: { currentPage: number; totalPages: number };
    domains: RegistryDomain[];
}

export interface Subdomain {
    subdomain: string;
    id: string;
    type: string;
    destination: string;
}

export interface SubdomainDetails {
    type: string;
    subdomain: string;
    domain: string;
    domainId: number;
    destination: string;
    wildcard: boolean;
}

/** A record type FreeDNS's subdomain form accepts. */
export type RecordType = "A" | "AAAA" | "CNAME" | "MX" | "NS" | "TXT";

/**
 * Just enough cookie handling for one logged-in session: capture `Set-Cookie`
 * off each response and replay the names/values on the next request. Not a
 * spec-complete jar (no path, domain, expiry, or Secure handling) — this talks
 * to exactly one host over one session, where none of that changes the
 * outcome. `getSetCookie()` needs the runtime to expose redirect responses'
 * headers, which Bun does (the target runtime — see the module doc); Node's
 * `redirect: "manual"` strips them on a 3xx.
 */
class CookieJar {
    private readonly cookies = new Map<string, string>();

    capture(response: XiorResponse): void {
        for (const line of response.response.headers.getSetCookie()) {
            const pair = line.split(";", 1)[0]?.trim();
            if (!pair) continue;
            const eq = pair.indexOf("=");
            if (eq <= 0) continue;
            this.cookies.set(pair.slice(0, eq), pair.slice(eq + 1));
        }
    }

    header(): string {
        return [...this.cookies]
            .map(([name, value]) => `${name}=${value}`)
            .join("; ");
    }
}

export class FreeDnsClient {
    private readonly http: XiorInstance;
    private readonly jar = new CookieJar();

    constructor() {
        this.http = xior.create({
            baseURL: BASE_URL,
            headers: {
                "User-Agent": USER_AGENT,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
            },
            // xior's default success check is `response.ok` (2xx only), which
            // would reject the promise on FreeDNS's own 302-means-success
            // responses before `redirected()`/`detectError()` below ever see
            // them. Accept every status here; those two are the real judges.
            validateResponse: () => true,
        });

        // Every request carries the accumulated cookies; every response feeds
        // the jar. `redirect: "manual"` is forced here so callers never have
        // to remember it — a followed redirect would turn the 302 success
        // signal into a 200 for the page it landed on.
        this.http.interceptors.request.use(config => {
            const cookie = this.jar.header();
            if (cookie) config.headers = { ...config.headers, Cookie: cookie };
            return { ...config, redirect: "manual" };
        });
        this.http.interceptors.response.use(response => {
            this.jar.capture(response);
            return response;
        });
    }

    private async get(path: string): Promise<XiorResponse<string>> {
        return this.http.get<string>(path, { responseType: "text" });
    }

    private async post(
        path: string,
        form: Record<string, string>,
    ): Promise<XiorResponse<string>> {
        return this.http.post<string>(path, new URLSearchParams(form), {
            responseType: "text",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });
    }

    /** A 302 (or an opaque redirect — Node reports a manual-mode 3xx as
     *  status 0) is FreeDNS's "it worked". Any 2xx means it stayed on the
     *  page to show an error. */
    private static redirected(response: XiorResponse): boolean {
        return (
            (response.status >= 300 && response.status < 400) ||
            response.status === 0 ||
            response.response.type === "opaqueredirect"
        );
    }

    /** The reference's `detect_error`: the message FreeDNS puts in the grey
     *  cell of the 95%-wide table on a failure page. */
    private static detectError(html: string): string {
        const doc = parseDocument(html);
        const table = findOne(
            el =>
                isTag(el) && el.name === "table" && attr(el, "width") === "95%",
            doc.children,
            true,
        );
        if (!table) return "Unknown FreeDNS error";
        const cell = findOne(
            el => isTag(el) && attr(el, "bgcolor") === "#eeeeee",
            [table],
            true,
        );
        return cell ? textContent(cell).trim() : "Unknown FreeDNS error";
    }

    /** The captcha image bytes for `subdomain`/`account` creation. The caller
     *  presents it to a human and passes the answer back as `captchaCode`. */
    async getCaptcha(): Promise<Uint8Array> {
        const response = await this.http.get<ArrayBuffer>(
            "/securimage/securimage_show.php",
            { responseType: "arraybuffer" },
        );
        return new Uint8Array(response.data);
    }

    /**
     * Authenticate. With no arguments, reads `FREEDNS_EMAIL` and
     * `FREEDNS_PASSWORD`; FreeDNS accepts the email in its username field.
     * Explicit credentials override the environment for callers that manage
     * their own.
     */
    async login(username?: string, password?: string): Promise<void> {
        const user = username ?? process.env.FREEDNS_EMAIL;
        const pass = password ?? process.env.FREEDNS_PASSWORD;
        if (!user || !pass) {
            throw new FreeDnsError(
                "FreeDNS credentials missing: set FREEDNS_EMAIL and " +
                    "FREEDNS_PASSWORD, or pass them to login().",
            );
        }

        const response = await this.post("/zc.php?step=2", {
            username: user,
            password: pass,
            remember: "1",
            submit: "Login",
            remote: "",
            from: "",
            action: "auth",
        });
        if (!FreeDnsClient.redirected(response)) {
            throw new FreeDnsError(
                `Login failed: ${FreeDnsClient.detectError(response.data)}`,
            );
        }
    }

    /**
     * The public domains FreeDNS offers, one registry page at a time. This is
     * the raw material for "pick a domain the filters don't block" — the
     * blocklist cross-check itself lives above this, in whatever calls it.
     */
    async getRegistry(page = 1, sort = 5, query?: string): Promise<Registry> {
        const q = query ? `&q=${encodeURIComponent(query)}` : "";
        const response = await this.get(
            `/domain/registry/?page=${page}&sort=${sort}${q}`,
        );
        const doc = parseDocument(response.data);

        const summary = textContent(
            findOne(
                el =>
                    isTag(el) && el.name === "font" && attr(el, "size") === "2",
                doc.children,
                true,
            ) ?? doc,
        );
        const counts = /Showing (\S+)-(\S+) of (\S+) total/.exec(summary) ?? [];
        const num = (value: string | undefined) =>
            Number((value ?? "0").replace(/,/g, ""));

        const pager = findOne(
            el =>
                isTag(el) &&
                el.name === "td" &&
                attr(el, "width") === "33%" &&
                attr(el, "align") === "center",
            doc.children,
            true,
        );
        const currentPage = pager
            ? Number(
                  attr(
                      findOne(
                          el => isTag(el) && el.name === "input",
                          [pager],
                          true,
                      ),
                      "value",
                  ) ?? "1",
              )
            : 1;
        const totalPages = pager
            ? Number(textContent(pager).trim().split(/\s+/).pop() ?? "1")
            : 1;

        const rows = findAll(
            el =>
                isTag(el) &&
                el.name === "tr" &&
                (attr(el, "class") === "trl" || attr(el, "class") === "trd"),
            doc.children,
        );

        const domains: RegistryDomain[] = [];
        for (const row of rows) {
            const cells = childElements(row);
            if (cells.length < 4) continue;

            const domainLink = childElements(cells[0]!)[0];
            const domain = domainLink ? textContent(domainLink).trim() : "";
            const domainId = Number(
                (attr(domainLink, "href") ?? "").split("=").pop(),
            );

            // Comma-tolerant: FreeDNS writes large host counts as "1,000
            // hosts", and a bare `\d+` would stop at the comma and read 1.
            const hostsText = textContent(
                childElements(cells[0]!).at(-1) ?? cells[0]!,
            );
            const hosts = num(/([\d,]+)/.exec(hostsText)?.[1]);

            const ownerLink = childElements(cells[2]!)[0];
            const ownerName = ownerLink ? textContent(ownerLink).trim() : "";
            const ownerId = Number(
                /user_id=(\d+)&subject/.exec(
                    attr(ownerLink, "href") ?? "",
                )?.[1] ?? "0",
            );

            const ageMatch = /(\d+) days? ago \((\S+)\)/.exec(
                textContent(cells[3]!),
            );

            domains.push({
                domain,
                id: domainId,
                hosts,
                status: textContent(cells[1]!).trim(),
                ownerName,
                ownerId,
                age: Number(ageMatch?.[1] ?? "0"),
                created: ageMatch?.[2] ?? "",
            });
        }

        return {
            domainsInfo: {
                pageStart: num(counts[1]),
                pageEnd: num(counts[2]),
                total: num(counts[3]),
            },
            pagesInfo: { currentPage, totalPages },
            domains,
        };
    }

    /** The subdomains on the logged-in account. Needed to find a subdomain's
     *  id before updating or deleting it. */
    async getSubdomains(): Promise<Subdomain[]> {
        const response = await this.get("/subdomain/");
        const doc = parseDocument(response.data);

        const form = findOne(
            el =>
                isTag(el) &&
                el.name === "form" &&
                attr(el, "action") === "delete2.php",
            doc.children,
            true,
        );
        if (!form) return [];

        const out: Subdomain[] = [];
        for (const row of findAll(
            el => isTag(el) && el.name === "tr",
            [form],
        )) {
            const cells = childElements(row);
            if (cells.length !== 4) continue;

            const link = childElements(cells[1]!)[0];
            if (!link) continue;
            out.push({
                subdomain: textContent(cells[1]!).trim(),
                id: (attr(link, "href") ?? "").split("=").pop() ?? "",
                type: textContent(cells[2]!).trim(),
                destination: textContent(cells[3]!).trim(),
            });
        }
        return out;
    }

    /** Create a subdomain. `captchaCode` is the answer to a `getCaptcha()`
     *  image; FreeDNS rejects the request without it. */
    async createSubdomain(params: {
        captchaCode: string;
        recordType: RecordType;
        subdomain: string;
        domainId: number | string;
        destination: string;
    }): Promise<void> {
        const response = await this.post("/subdomain/save.php?step=2", {
            type: params.recordType,
            subdomain: params.subdomain,
            domain_id: String(params.domainId),
            address: params.destination,
            ttlalias: "For our premium supporters",
            captcha_code: params.captchaCode,
            ref: "",
            send: "Save!",
        });
        if (!FreeDnsClient.redirected(response)) {
            throw new FreeDnsError(
                `Failed to create subdomain: ${FreeDnsClient.detectError(response.data)}`,
            );
        }
    }

    /** The subdomain edit form's current values, so `updateSubdomain` can
     *  change one field without clearing the rest. */
    async getSubdomainDetails(subdomainId: string): Promise<SubdomainDetails> {
        const response = await this.get(
            `/subdomain/edit.php?data_id=${subdomainId}`,
        );
        if (FreeDnsClient.redirected(response)) {
            throw new FreeDnsError("Not authenticated.");
        }
        const doc = parseDocument(response.data);

        const selectedOption = (name: string): Element | null =>
            findOne(
                el =>
                    isTag(el) &&
                    el.name === "option" &&
                    "selected" in el.attribs,
                selectByName(doc, "select", name)
                    ? [selectByName(doc, "select", name)!]
                    : [],
                true,
            );

        const typeOption = selectedOption("type");
        const domainOption = selectedOption("domain_id");
        const domainText = domainOption
            ? (textContent(domainOption).trim().split(" ")[0] ?? "")
            : "";

        const address =
            attr(selectByName(doc, "input", "address"), "value") ?? "";

        return {
            type: attr(typeOption, "value") ?? "",
            subdomain:
                attr(selectByName(doc, "input", "subdomain"), "value") ?? "",
            domain: domainText,
            domainId: Number(attr(domainOption, "value") ?? "0"),
            destination: address,
            wildcard: address === "1",
        };
    }

    /** Update one or more fields of an existing subdomain. Unspecified fields
     *  keep their current values (read back via `getSubdomainDetails`). */
    // fallow-ignore-next-line unused-class-member
    async updateSubdomain(
        subdomainId: string,
        captchaCode: string,
        changes: Partial<{
            type: RecordType;
            subdomain: string;
            domainId: number | string;
            destination: string;
        }> = {},
    ): Promise<void> {
        const current = await this.getSubdomainDetails(subdomainId);
        const response = await this.post("/subdomain/save.php?step=2", {
            type: String(changes.type ?? current.type),
            subdomain: changes.subdomain ?? current.subdomain,
            domain_id: String(changes.domainId ?? current.domainId),
            address: changes.destination ?? current.destination,
            ttlalias: "For our premium supporters",
            captcha_code: captchaCode,
            data_id: subdomainId,
            ref: "",
            send: "Save!",
        });
        if (!FreeDnsClient.redirected(response)) {
            throw new FreeDnsError(
                `Failed to update subdomain: ${FreeDnsClient.detectError(response.data)}`,
            );
        }
    }

    /**
     * Delete a subdomain by id. Not in the reference client — modelled on
     * FreeDNS's own subdomain list, whose delete form posts checked
     * `data_id[]` entries to `delete2.php`. Deletion is not captcha-gated, so
     * the tunnel can tear itself down unattended.
     */
    async deleteSubdomain(subdomainId: string): Promise<void> {
        const response = await this.get(
            `/subdomain/delete2.php?data_id%5B%5D=${encodeURIComponent(subdomainId)}&submit=delete+selected`,
        );
        // A redirect back to the list is success; a 200 that names the id in
        // an error page is not. An id FreeDNS no longer knows about is
        // treated as already gone rather than an error — teardown is
        // idempotent by design.
        if (
            !FreeDnsClient.redirected(response) &&
            response.data.includes("data_id")
        ) {
            throw new FreeDnsError(
                `Failed to delete subdomain: ${FreeDnsClient.detectError(response.data)}`,
            );
        }
    }
}

/** `getAttributeValue` typed for the predicate callsites, which hand it
 *  possibly-null nodes. */
function attr(
    node: AnyNode | null | undefined,
    name: string,
): string | undefined {
    return node && isTag(node) ? getAttributeValue(node, name) : undefined;
}

/** Direct element children of a node, skipping text/whitespace. */
function childElements(node: AnyNode): Element[] {
    return isTag(node) ? node.children.filter(isTag) : [];
}

/** The first `<tag name="...">` in the document — the several `select`/`input`
 *  lookups the edit-form parser needs. */
function selectByName(
    doc: ReturnType<typeof parseDocument>,
    tag: string,
    name: string,
): Element | null {
    return findOne(
        el => isTag(el) && el.name === tag && attr(el, "name") === name,
        doc.children,
        true,
    );
}

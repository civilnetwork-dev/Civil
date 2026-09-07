/**
 * Tests for the FreeDNS client's HTML parsing and its success/error decision
 * logic — the parts that are pure functions of a response and carry the real
 * risk of being wrong.
 *
 * The fixtures reproduce the exact DOM the reference `client.py` selects
 * against (`table[width="95%"]`, `tr.trl`/`tr.trd`, the `select[name=...]`
 * edit form, ...). FreeDNS gates the registry and subdomain pages behind a
 * login and a captcha, so a live capture of the authenticated pages isn't
 * available to commit; the reference client's selectors are the contract, and
 * these fixtures match them.
 *
 * Network methods (login, create, delete) are driven through a stub `xior`
 * instance so the request shape and the "302 means success" rule are tested
 * without touching freedns.afraid.org.
 */

import { describe, expect, it, vi } from "vitest";

import { FreeDnsClient, FreeDnsError } from "./freedns";

/** Builds a client whose HTTP layer is replaced by `handler`, which sees the
 *  method, path and form body and returns a fake response. Bypasses login. */
function clientWith(
    handler: (call: {
        method: "get" | "post";
        path: string;
        form?: Record<string, string>;
    }) => {
        status: number;
        data?: string;
        type?: string;
        setCookie?: string[];
    },
): FreeDnsClient {
    const client = new FreeDnsClient();
    const respond = (call: Parameters<typeof handler>[0]) => {
        const r = handler(call);
        return {
            status: r.status,
            statusText: "",
            data: r.data ?? "",
            headers: new Headers(),
            response: {
                type: r.type ?? "basic",
                headers: { getSetCookie: () => r.setCookie ?? [] },
            } as unknown as Response,
            config: {},
            request: {},
        };
    };
    // The client only ever calls its private `get`/`post`, which call
    // `this.http.get`/`this.http.post`. Replace the xior instance.
    (client as unknown as { http: unknown }).http = {
        get: (path: string) =>
            Promise.resolve(respond({ method: "get", path })),
        post: (path: string, body: URLSearchParams) =>
            Promise.resolve(
                respond({
                    method: "post",
                    path,
                    form: Object.fromEntries(body),
                }),
            ),
        interceptors: {
            request: { use: () => {} },
            response: { use: () => {} },
        },
    };
    return client;
}

describe("login", () => {
    it("reads FREEDNS_EMAIL / FREEDNS_PASSWORD and posts them as auth", async () => {
        vi.stubEnv("FREEDNS_EMAIL", "student@example.com");
        vi.stubEnv("FREEDNS_PASSWORD", "hunter2");
        let seen: Record<string, string> | undefined;
        const client = clientWith(({ path, form }) => {
            expect(path).toBe("/zc.php?step=2");
            seen = form;
            return { status: 302 }; // FreeDNS redirects on success
        });

        await client.login();

        expect(seen).toMatchObject({
            username: "student@example.com",
            password: "hunter2",
            action: "auth",
        });
        vi.unstubAllEnvs();
    });

    it("throws with the page's error text when no redirect happens", async () => {
        const client = clientWith(() => ({
            status: 200,
            data: '<table width="95%"><tr><td bgcolor="#eeeeee">Invalid login.</td></tr></table>',
        }));
        await expect(client.login("a@b.c", "wrong")).rejects.toThrow(
            /Login failed: Invalid login\./,
        );
    });

    it("refuses to run with no credentials in the environment or arguments", async () => {
        vi.stubEnv("FREEDNS_EMAIL", "");
        vi.stubEnv("FREEDNS_PASSWORD", "");
        const client = clientWith(() => ({ status: 302 }));
        await expect(client.login()).rejects.toThrow(FreeDnsError);
        vi.unstubAllEnvs();
    });

    it("treats an opaque redirect (Node manual-mode 3xx) as success", async () => {
        const client = clientWith(() => ({
            status: 0,
            type: "opaqueredirect",
        }));
        await expect(client.login("a@b.c", "pw")).resolves.toBeUndefined();
    });
});

describe("login (real xior transport, not the clientWith stub)", () => {
    // xior's default success check is `response.ok` — false for a 302 — which
    // would reject the underlying request before `redirected()` ever sees it.
    // The other `login` tests replace `client.http` entirely, so they can't
    // catch that: this one goes through the real `xior.create()` config.
    it("does not reject the request on FreeDNS's 302 success response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 302 })),
        );
        const client = new FreeDnsClient();
        await expect(client.login("a@b.c", "pw")).resolves.toBeUndefined();
        vi.unstubAllGlobals();
    });
});

describe("getRegistry", () => {
    const REGISTRY_HTML = `
<html><body>
  <font size="2">Showing 1-2 of 1,234 total</font>
  <td width="33%" align="center"><input value="1"> of 3</td>
  <table>
    <tr class="trl">
      <td><a href="/subdomain/?domain_id=42">mooo.com</a> <span>(1,000 hosts)</span></td>
      <td>public</td>
      <td><a href="/profile.php?user_id=7&subject=x">alice</a></td>
      <td>30 days ago (2026-07-26)</td>
    </tr>
    <tr class="trd">
      <td><a href="/subdomain/?domain_id=99">chickenkiller.com</a> <span>(500 hosts)</span></td>
      <td>public</td>
      <td><a href="/profile.php?user_id=9&subject=x">bob</a></td>
      <td>1 day ago (2026-08-24)</td>
    </tr>
  </table>
</body></html>`;

    it("parses the summary, pager and every domain row", async () => {
        const client = clientWith(({ path }) => {
            expect(path).toContain("/domain/registry/");
            return { status: 200, data: REGISTRY_HTML };
        });

        const registry = await client.getRegistry();

        expect(registry.domainsInfo).toEqual({
            pageStart: 1,
            pageEnd: 2,
            total: 1234,
        });
        expect(registry.pagesInfo).toEqual({ currentPage: 1, totalPages: 3 });
        expect(registry.domains).toHaveLength(2);
        expect(registry.domains[0]).toMatchObject({
            domain: "mooo.com",
            id: 42,
            hosts: 1000,
            status: "public",
            ownerName: "alice",
            ownerId: 7,
            age: 30,
            created: "2026-07-26",
        });
        expect(registry.domains[1]).toMatchObject({
            domain: "chickenkiller.com",
            id: 99,
            age: 1,
        });
    });

    it("passes a search query through to the URL", async () => {
        let seenPath = "";
        const client = clientWith(({ path }) => {
            seenPath = path;
            return { status: 200, data: REGISTRY_HTML };
        });
        await client.getRegistry(2, 5, "mooo");
        expect(seenPath).toContain("page=2");
        expect(seenPath).toContain("q=mooo");
    });
});

describe("getSubdomains", () => {
    it("reads id, type and destination from the delete form's rows", async () => {
        const html = `
<form action="delete2.php">
  <tr><th>x</th><th>Subdomain</th><th>Type</th><th>Dest</th></tr>
  <tr>
    <td><input type="checkbox"></td>
    <td><a href="/subdomain/edit.php?data_id=555">abc.mooo.com</a></td>
    <td>CNAME</td>
    <td>xyz.trycloudflare.com</td>
  </tr>
</form>`;
        const client = clientWith(() => ({ status: 200, data: html }));
        const subs = await client.getSubdomains();
        expect(subs).toEqual([
            {
                subdomain: "abc.mooo.com",
                id: "555",
                type: "CNAME",
                destination: "xyz.trycloudflare.com",
            },
        ]);
    });

    it("returns nothing when the account has no subdomains", async () => {
        const client = clientWith(() => ({
            status: 200,
            data: "<p>You have no subdomains.</p>",
        }));
        expect(await client.getSubdomains()).toEqual([]);
    });
});

describe("createSubdomain", () => {
    it("sends the CNAME form with the captcha and succeeds on a redirect", async () => {
        let form: Record<string, string> | undefined;
        const client = clientWith(({ path, form: f }) => {
            expect(path).toBe("/subdomain/save.php?step=2");
            form = f;
            return { status: 302 };
        });

        await client.createSubdomain({
            captchaCode: "AB12CD",
            recordType: "CNAME",
            subdomain: "probe",
            domainId: 42,
            destination: "abc.trycloudflare.com",
        });

        expect(form).toMatchObject({
            type: "CNAME",
            subdomain: "probe",
            domain_id: "42",
            address: "abc.trycloudflare.com",
            captcha_code: "AB12CD",
            send: "Save!",
        });
    });

    it("surfaces FreeDNS's error when creation is rejected", async () => {
        const client = clientWith(() => ({
            status: 200,
            data: '<table width="95%"><tr><td bgcolor="#eeeeee">The captcha code you entered was incorrect.</td></tr></table>',
        }));
        await expect(
            client.createSubdomain({
                captchaCode: "wrong",
                recordType: "CNAME",
                subdomain: "probe",
                domainId: 42,
                destination: "abc.trycloudflare.com",
            }),
        ).rejects.toThrow(/captcha code you entered was incorrect/);
    });
});

describe("deleteSubdomain", () => {
    it("requests delete2.php with the id and treats a redirect as done", async () => {
        let seenPath = "";
        const client = clientWith(({ path }) => {
            seenPath = path;
            return { status: 302 };
        });
        await client.deleteSubdomain("555");
        expect(seenPath).toContain("/subdomain/delete2.php");
        expect(seenPath).toContain("data_id%5B%5D=555");
    });

    it("is idempotent: a 200 that doesn't mention the id is not an error", async () => {
        const client = clientWith(() => ({
            status: 200,
            data: "<p>Subdomain list.</p>",
        }));
        await expect(
            client.deleteSubdomain("does-not-exist"),
        ).resolves.toBeUndefined();
    });
});

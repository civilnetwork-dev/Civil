/**
 * Aristotle K12's `/wss/wf` filter socket, for the domain-reputation registry
 * (misc/filters/domainReputation).
 *
 * ## Protocol, independently confirmed from the real extension
 *
 * `~/extensions/aristotleStudent/assets/background.ts.88ce4144.js` defines the
 * message enums directly:
 *
 * ```
 * Or (outgoing) = { Authenticate: 0, CheckURL: 2, Username: 3, Device: 4, … }
 * bs (incoming) = { Authentication: 0, Ping: 1, FilterResult: 2, … }
 * ```
 *
 * and its `_urlCheck` sends `serverRPC({ cmd: Or.CheckURL, url, type:
 * "main_frame" })` and reads `s.block` / `s.category` off the reply — exactly
 * what this checker sends and reads. The auth handshake's metadata field names
 * (`guid`, `os`, `user_id`, `connect_time`, `version`) were not traced through
 * the minifier in the time available; those come from the equivalent checker in
 * shayderrr's `idk` (github.com/shayderrr/idk, `filters/aristotle.js`), whose
 * `cmd`/response shape matches the confirmed enums above.
 *
 * ## The auth secret is not derived — it's shipped, per district
 *
 * `~/extensions/aristotleStudent/config.json` — the installed extension's own,
 * unobfuscated config — is a live `{domain, auth_key, auth_secret}` triple:
 * `lenape.aristotleinsight.com` (Lenape Regional High School District, NJ) with
 * its own `auth_secret`. There is no key-derivation function anywhere in the
 * bundle: `auth_secret` is a fixed value provisioned into the extension at
 * deployment, one per district, not computed from anything a client could
 * regenerate. That answers "can a per-agent secret be generated
 * cryptographically" — no. This uses that live pairing (domain and secret from
 * the same file, so they are guaranteed to match) rather than mixing a secret
 * with an unrelated domain from wayback data.
 */

import { randomUUID } from "node:crypto";

import { WebSocket } from "ws";

import type { DomainVerdict } from "../domainReputation";

const CMD = { AUTHENTICATE: 0, CHECK_URL: 2 } as const;

const DEFAULT_HOST = "lenape.aristotleinsight.com";
const DEFAULT_SECRET =
    "dec18994c0964e2c38508ee4abd7b46c1bf6ef32de1d03c7202236896335a934a3d8e7e3e755de31f2dd1f8291d59be3504ab02358b212a61c5652c3f6f37a04";
const AUTH_KEY = "aristotle-chrome-agent";
const CONNECT_TIMEOUT_MS = 10_000;

const toHost = (domain: string): string =>
    domain
        .replace(/^https?:\/\//, "")
        .replace(/\/.*$/, "")
        .trim();

const env = (name: string, fallback: string): string =>
    process.env[name] || fallback;

export async function checkAristotleDomain(
    domain: string,
): Promise<DomainVerdict> {
    const host = env("CIVIL_REP_ARISTOTLE_HOST", DEFAULT_HOST);
    const secret = env("CIVIL_REP_ARISTOTLE_SECRET", DEFAULT_SECRET);
    const target = `https://${toHost(domain)}`;

    return new Promise(resolve => {
        let settled = false;
        const finish = (verdict: DomainVerdict) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                ws.close();
            } catch {}
            resolve(verdict);
        };

        const ws = new WebSocket(`wss://${host}/wss/wf?ssId=${randomUUID()}`);
        const timer = setTimeout(() => finish("UNKNOWN"), CONNECT_TIMEOUT_MS);

        ws.on("open", () => {
            ws.send(
                JSON.stringify({
                    cmd: CMD.AUTHENTICATE,
                    auth: true,
                    key: AUTH_KEY,
                    secret,
                    guid: randomUUID(),
                    os: "win",
                    user_id: "civil-probe",
                    connect_time: new Date().toUTCString(),
                    version: "1.0.0",
                }),
            );
        });

        ws.on("message", raw => {
            try {
                const data = JSON.parse(raw.toString());

                if (data.authenticated === false) return finish("UNKNOWN");

                if (data.authenticated === true) {
                    ws.send(
                        JSON.stringify({
                            cmd: CMD.CHECK_URL,
                            url: target,
                            type: "main_frame",
                        }),
                    );
                    return;
                }

                // A FilterResult reply: only a definite `block` is actionable.
                if (typeof data.block === "boolean") {
                    finish(data.block ? "BLOCK" : "ALLOW");
                }
            } catch {
                finish("UNKNOWN");
            }
        });

        ws.on("error", () => finish("UNKNOWN"));
        ws.on("close", () => finish("UNKNOWN"));
    });
}

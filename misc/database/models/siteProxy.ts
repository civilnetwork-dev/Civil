import { eq } from "drizzle-orm";
import UserAgent from "user-agents";

import { db } from "../db";
import type { SiteProxyConfig } from "../schema";
import { siteProxyConfigs } from "../schema";

export type { SiteProxyConfig };

export type ProxyName = "scramjet" | "uv";
export type TransportName = "epoxy" | "libcurl" | "bare";

export interface ProxyDecision {
    proxy: ProxyName;
    transport: TransportName;
    wispVersion: 1 | 2;
    score: number;
    latencyMs: number | null;
    reason: string;
}

export function normalizeHostname(input: string): string | null {
    let raw = input.trim();
    if (!raw) return null;
    if (!/^[a-z][\w+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
        const host = new URL(raw).hostname.toLowerCase();
        return host.startsWith("www.") ? host.slice(4) : host;
    } catch {
        return null;
    }
}

export async function getSiteProxyConfig(
    hostname: string,
): Promise<SiteProxyConfig | null> {
    const rows = await db
        .select()
        .from(siteProxyConfigs)
        .where(eq(siteProxyConfigs.hostname, hostname))
        .limit(1);
    return rows[0] ?? null;
}

export async function upsertSiteProxyConfig(
    hostname: string,
    decision: ProxyDecision,
): Promise<SiteProxyConfig> {
    const rows = await db
        .insert(siteProxyConfigs)
        .values({
            hostname,
            proxy: decision.proxy,
            transport: decision.transport,
            wispVersion: decision.wispVersion,
            score: decision.score,
            latencyMs: decision.latencyMs,
            reason: decision.reason,
        })
        .onConflictDoUpdate({
            target: siteProxyConfigs.hostname,
            set: {
                proxy: decision.proxy,
                transport: decision.transport,
                wispVersion: decision.wispVersion,
                score: decision.score,
                latencyMs: decision.latencyMs,
                reason: decision.reason,
                updatedAt: new Date(),
            },
        })
        .returning();
    return rows[0];
}

export async function recordCompatFeedback(
    hostname: string,
    reportedProxy: ProxyName,
    transport: TransportName | undefined,
    compat: number,
    rewriterErrors = 0,
): Promise<ProxyName | null> {
    const existing = await getSiteProxyConfig(hostname);
    if (!existing) return null;

    const other: ProxyName = reportedProxy === "scramjet" ? "uv" : "scramjet";

    // Record this proxy's measured score; keep the other's from before.
    const scoreScramjet =
        reportedProxy === "scramjet" ? compat : existing.scoreScramjet;
    const scoreUv = reportedProxy === "uv" ? compat : existing.scoreUv;
    const otherScore = reportedProxy === "scramjet" ? scoreUv : scoreScramjet;

    let proxy = existing.proxy as ProxyName;
    let reason = existing.reason ?? "";

    if (scoreScramjet != null && scoreUv != null) {
        proxy = scoreScramjet >= scoreUv ? "scramjet" : "uv";
        reason = `sj=${Math.round(scoreScramjet)},uv=${Math.round(scoreUv)}`;
    } else {
        const weak = compat < 70 || rewriterErrors > 0;
        if (weak && otherScore == null) {
            proxy = other;
            reason = `explore-${other}(from ${reportedProxy}@${compat},err=${rewriterErrors})`;
        } else {
            proxy = reportedProxy;
            reason = `${reportedProxy}@${compat},err=${rewriterErrors}`;
        }
    }

    await db
        .update(siteProxyConfigs)
        .set({
            proxy,
            score: compat,
            scoreScramjet,
            scoreUv,
            transport: transport ?? existing.transport,
            reason: reason.slice(0, 240),
            updatedAt: new Date(),
        })
        .where(eq(siteProxyConfigs.hostname, hostname));

    return proxy;
}

export async function probeSite(url: string): Promise<ProxyDecision> {
    const start = Date.now();
    let res: Response | null = null;
    let latencyMs: number | null = null;

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3000);
        res = await fetch(url, {
            method: "GET",
            redirect: "follow",
            signal: controller.signal,
            headers: {
                "User-Agent": new UserAgent().toString(),
                Accept: "text/html,application/xhtml+xml",
            },
        });
        clearTimeout(timer);
        latencyMs = Date.now() - start;
    } catch {
        latencyMs = Date.now() - start;
    }

    const h = res?.headers;
    const csp = h?.get("content-security-policy") ?? "";
    const xfo = (h?.get("x-frame-options") ?? "").toLowerCase();
    const coop = (h?.get("cross-origin-opener-policy") ?? "").toLowerCase();
    const coep = (h?.get("cross-origin-embedder-policy") ?? "").toLowerCase();
    const ct = (h?.get("content-type") ?? "").toLowerCase();

    let scramjetPoints = 0;
    const reasons: string[] = [];

    if (xfo.includes("deny") || xfo.includes("sameorigin")) {
        scramjetPoints += 2;
        reasons.push("x-frame-options");
    }
    if (csp) {
        scramjetPoints += 1;
        if (/frame-ancestors|require-trusted-types|sandbox/.test(csp)) {
            scramjetPoints += 2;
            reasons.push("strict-csp");
        } else {
            reasons.push("csp");
        }
    }
    if (coop && coop !== "unsafe-none") {
        scramjetPoints += 2;
        reasons.push("coop");
    }
    if (coep && coep !== "unsafe-none") {
        scramjetPoints += 1;
        reasons.push("coep");
    }
    if (ct.includes("text/html")) {
        scramjetPoints += 1;
    }

    const slow = (latencyMs ?? 9999) > 1200;
    const proxy: ProxyName = scramjetPoints >= 3 ? "scramjet" : "uv";

    const server = (h?.get("server") ?? "").toLowerCase();
    const isCloudflare =
        Boolean(h?.get("cf-ray")) || server.includes("cloudflare");
    let transport: TransportName;
    if ((latencyMs ?? 0) > 900) {
        transport = "libcurl";
        reasons.push("slow>libcurl");
    } else if (isCloudflare) {
        transport = "epoxy";
        reasons.push("cf>epoxy");
    } else if (scramjetPoints <= 1) {
        transport = "bare";
        reasons.push("simple>bare");
    } else {
        transport = "epoxy";
    }

    const score = Math.max(
        0,
        Math.min(
            100,
            proxy === "scramjet"
                ? 50 + scramjetPoints * 8
                : 60 - scramjetPoints * 8,
        ),
    );

    if (reasons.length === 0) reasons.push(res ? "plain-response" : "no-probe");

    return {
        proxy,
        transport,
        wispVersion: slow ? 1 : 2,
        score,
        latencyMs,
        reason: reasons.join(","),
    };
}

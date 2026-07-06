import { err, ok, ResultAsync } from "neverthrow";
import WebSocket from "ws";
import xior, { type XiorError } from "xior";
import { z } from "zod";

export type HaparaSessionType = "filter" | "focus" | "lock" | "pausescreen";
export type HaparaFocusType = "whole_site" | "links";

export type HaparaVerdict =
    | "BLOCKED"
    | "ALLOWED"
    | "LOCKED"
    | "PAUSED"
    | "UNMONITORED"
    | "NO_SESSION";

export type HaparaError =
    | { type: "INVALID_URL"; message: string; input: string }
    | { type: "NETWORK"; message: string; status?: number; body?: unknown }
    | { type: "PARSE"; message: string; body?: unknown };

export interface HaparaStudentById {
    kind: "by-id";
    userId: string;
    classIds: string[];
}

export interface HaparaStudentByEmail {
    kind: "by-email";
    email: string;
}

export type HaparaStudentInput = HaparaStudentById | HaparaStudentByEmail;

export interface HaparaCheckInput {
    url: string;
    student: HaparaStudentInput;
}

export interface HaparaCheckResult {
    inputUrl: string;
    normalizedUrl: string;
    hostname: string;
    verdict: HaparaVerdict;
    sessionType: HaparaSessionType | null;
    sessionId: string | null;
    teacherName: string | null;
    sessionStart: number | null;
    sessionEnd: number | null;
    blockedDomains: string[];
    allowedDomains: string[];
    allowedLinks: string[];
    matchedDomain: string | null;
    // Session-independent context (populated from /admin/config/highlights).
    monitored: boolean | null;
    invalidCode: string | null;
    whitelisted: boolean;
    stateSource: "session" | "config" | null;
    rawSession?: unknown;
    rawState?: unknown;
}

export interface HaparaStudentConfig {
    userId: string;
    email: string;
    classIds: string[];
    whiteList: string[];
    isValid: boolean;
    invalidCode?: string;
    hlBusUrl?: string;
    monitoringTime?: HaparaMonitoringTime;
}

export interface HaparaMonitoringTime {
    currentTime?: string;
    timezone?: string;
    start?: string;
    end?: string;
    saturday?: boolean;
    sunday?: boolean;
}

export interface HaparaCheckerOptions {
    timeoutMs?: number;
    apiBaseUrl?: string;
    featureFlags?: string[];
}

const MonitoringTimeSchema = z
    .looseObject({
        CurrentTime: z.string().optional(),
        Timezone: z.string().optional(),
        Start: z.string().optional(),
        End: z.string().optional(),
        Saturday: z.boolean().optional(),
        Sunday: z.boolean().optional(),
    })
    .optional();

const ConfigUserSchema = z.looseObject({
    ID: z.string().optional(),
    UserId: z.string().optional(),
    PrimaryEmail: z.string().optional(),
    Email: z.string().optional(),
    Classes: z.array(z.string()).nullable().optional().default([]),
    WhiteList: z.array(z.string()).nullable().optional().default([]),
    Valid: z.boolean().optional(),
    InvalidCode: z.string().optional(),
    HLBusURL: z.string().optional(),
    MonitoringTime: MonitoringTimeSchema,
});

const ConfigResponseSchema = z.union([
    z.array(ConfigUserSchema),
    z.looseObject({
        users: z.array(ConfigUserSchema).optional(),
    }),
]);

const FocusSessionDetailsSchema = z
    .looseObject({
        FocusType: z.enum(["whole_site", "links"]).optional(),
        EndSessionKeepAllTabs: z.boolean().optional(),
        EndSessionRestoreOriginal: z.boolean().optional(),
    })
    .optional();

const SessionSchema = z.looseObject({
    ID: z.string(),
    Type: z.enum(["filter", "focus", "lock", "pausescreen"]),
    Links: z.array(z.string()).optional().default([]),
    ModificationTime: z.number().optional(),
    Start: z.number().optional(),
    End: z.number().optional(),
    MessageDuration: z.number().optional(),
    TeacherFirstName: z.string().optional(),
    TeacherLastName: z.string().optional(),
    FocusSessionDetails: FocusSessionDetailsSchema,
});

const StudentStateSchema = z.looseObject({
    CurrentSessions: z.array(SessionSchema).optional().default([]),
    Messages: z.array(z.unknown()).optional().default([]),
    RecordingSessions: z.array(z.unknown()).optional().default([]),
});

type Session = z.infer<typeof SessionSchema>;

const DEFAULT_FEATURE_FLAGS: string[] = [
    "HAP-6944-screenshot-interval_extension",
    "PERM-0000-Allow-EyesOnMe-Escape_extension",
    "PERM-0000-debug-logging_extension",
    "HAP-9651-take-over-blocking-request",
    "HAP-9942-breaking-pause-screen-on-chromebook",
    "HAP-11000-new-deledao-id",
    "HAP-10524-normalization",
    "PS-1075-token-refresh-before-expiry",
    "SUPPORT_001-throttle-extension-logging",
    "PS-1895-enable-auth-in-extension",
    "PS-1350-student-class-level-ui-enhancements",
    "HL-05-Improvements-Focus-browsing",
    "HAP-12335-mv3-force-reinit-tabs",
    "PS-3182-Iframe-blocking",
];

function normalizeHaparaUrl(input: string): string {
    if (
        !input.startsWith("http") &&
        !input.startsWith("file:") &&
        !input.startsWith("chrome-extension:")
    ) {
        return `https://${input}`;
    }

    return input;
}

function normalizeDomain(hostname: string): string {
    return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function convertToListOfDomains(links: string[]): string[] {
    const seen = new Set<string>();
    const domains: string[] = [];

    for (const link of links) {
        try {
            const url = new URL(normalizeHaparaUrl(link));
            const domain = normalizeDomain(url.hostname);

            if (domain && !seen.has(domain)) {
                seen.add(domain);
                domains.push(domain);
            }
        } catch {}
    }

    return domains;
}

function matchesDomainList(url: URL, domainList: string[]): string | null {
    if (!domainList.length) return null;

    let hostname = normalizeDomain(url.hostname);

    while (hostname) {
        if (domainList.includes(hostname)) return hostname;

        const dotIndex = hostname.indexOf(".");

        if (dotIndex === -1) break;

        hostname = hostname.slice(dotIndex + 1);
    }

    return null;
}

function matchesLinkList(
    normalizedInputUrl: string,
    links: string[],
): string | null {
    const lower = normalizedInputUrl.toLowerCase();

    for (const link of links) {
        try {
            const normalizedLink = normalizeHaparaUrl(link).toLowerCase();

            if (
                lower === normalizedLink ||
                lower.startsWith(`${normalizedLink}/`)
            ) {
                return link;
            }
        } catch {}
    }

    return null;
}

function toNetworkError(error: unknown): HaparaError {
    const e = error as XiorError<unknown>;

    return {
        type: "NETWORK",
        message: e.message,
        status: e.response?.status,
        body: e.response?.data,
    };
}

function buildTeacherName(session: Session): string | null {
    const first = session.TeacherFirstName?.trim() ?? "";
    const last = session.TeacherLastName?.trim() ?? "";
    const full = [first, last].filter(Boolean).join(" ");

    return full || null;
}

const HAPARA_API_BASE = "https://api.hapara.com";

const RESTRICTING_SESSION_TYPES = new Set(["filter", "focus", "lock"] as const);

export function lookupHaparaStudentConfig(
    email: string,
    options: HaparaCheckerOptions = {},
): ResultAsync<HaparaStudentConfig, HaparaError> {
    const apiBase = (options.apiBaseUrl ?? HAPARA_API_BASE).replace(/\/$/, "");

    const client = xior.create({
        timeout: options.timeoutMs ?? 10_000,
        headers: { "Content-Type": "application/json" },
    });

    return ResultAsync.fromPromise(
        client.post<unknown>(`${apiBase}/admin/config/highlights`, {
            flags: options.featureFlags ?? DEFAULT_FEATURE_FLAGS,
            emails: [email],
        }),
        toNetworkError,
    ).andThen(res => {
        const parsed = ConfigResponseSchema.safeParse(res.data);

        if (!parsed.success) {
            return err<HaparaStudentConfig, HaparaError>({
                type: "PARSE",
                message:
                    "Invalid config response from /admin/config/highlights.",
                body: res.data,
            });
        }

        const users = Array.isArray(parsed.data)
            ? parsed.data
            : (parsed.data.users ?? []);

        const lower = email.toLowerCase();
        const user =
            users.find(
                u =>
                    (u.PrimaryEmail &&
                        u.PrimaryEmail.toLowerCase() === lower) ||
                    (u.Email && u.Email.toLowerCase() === lower),
            ) ?? users[0];

        if (!user) {
            return err<HaparaStudentConfig, HaparaError>({
                type: "PARSE",
                message: `No config entry found for email: ${email}`,
                body: res.data,
            });
        }

        const userId =
            user.ID || user.UserId || user.PrimaryEmail || user.Email || email;

        return ok<HaparaStudentConfig, HaparaError>({
            userId,
            email: user.PrimaryEmail ?? user.Email ?? email,
            classIds: user.Classes ?? [],
            whiteList: user.WhiteList ?? [],
            isValid: user.Valid ?? true,
            invalidCode: user.InvalidCode,
            hlBusUrl: user.HLBusURL,
            monitoringTime: user.MonitoringTime
                ? {
                      currentTime: user.MonitoringTime.CurrentTime,
                      timezone: user.MonitoringTime.Timezone,
                      start: user.MonitoringTime.Start,
                      end: user.MonitoringTime.End,
                      saturday: user.MonitoringTime.Saturday,
                      sunday: user.MonitoringTime.Sunday,
                  }
                : undefined,
        });
    });
}

/** A URL is whitelisted if it matches any persistent WhiteList entry (regex). */
function matchesWhiteList(normalizedUrl: string, whiteList: string[]): boolean {
    for (const pattern of whiteList) {
        if (!pattern) continue;
        try {
            if (new RegExp(pattern).test(normalizedUrl)) return true;
        } catch {
            if (normalizedUrl.includes(pattern)) return true;
        }
    }
    return false;
}

function parseHm(value?: string): number | null {
    if (!value) return null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
}

/** Day-of-week (0=Sun..6=Sat) and minute-of-day in a given IANA timezone. */
function partsInTz(
    date: Date,
    timeZone?: string,
): { day: number; minutes: number } {
    try {
        const fmt = new Intl.DateTimeFormat("en-US", {
            timeZone: timeZone || "UTC",
            hour12: false,
            weekday: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
        const parts = fmt.formatToParts(date);
        const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
        const days: Record<string, number> = {
            Sun: 0,
            Mon: 1,
            Tue: 2,
            Wed: 3,
            Thu: 4,
            Fri: 5,
            Sat: 6,
        };
        const hour = Number(get("hour"));
        const minute = Number(get("minute"));
        return {
            day: days[get("weekday")] ?? date.getUTCDay(),
            minutes:
                (Number.isNaN(hour) ? 0 : hour) * 60 +
                (Number.isNaN(minute) ? 0 : minute),
        };
    } catch {
        return { day: date.getUTCDay(), minutes: 0 };
    }
}

/**
 * Whether the student is being monitored right now, per the MonitoringTime
 * schedule. Without a schedule we can't rule monitoring out, so assume true.
 */
function isMonitoredNow(mt?: HaparaMonitoringTime): boolean {
    if (!mt || (!mt.start && !mt.end)) return true;
    let now: Date;
    try {
        now = mt.currentTime ? new Date(mt.currentTime) : new Date();
        if (Number.isNaN(now.getTime())) now = new Date();
    } catch {
        now = new Date();
    }
    const { day, minutes } = partsInTz(now, mt.timezone);
    if (day === 0 && mt.sunday === false) return false;
    if (day === 6 && mt.saturday === false) return false;
    const start = parseHm(mt.start);
    const end = parseHm(mt.end);
    if (start === null || end === null) return true;
    return minutes >= start && minutes <= end;
}

function hasRestrictingOrPause(
    state: z.infer<typeof StudentStateSchema> | null,
): boolean {
    const sessions = state?.CurrentSessions ?? [];
    return sessions.some(
        s =>
            s.Type === "pausescreen" ||
            RESTRICTING_SESSION_TYPES.has(
                s.Type as "filter" | "focus" | "lock",
            ),
    );
}

/** Pull a StudentState-shaped object out of an HLBus message (defensive). */
function extractBusState(
    json: unknown,
): z.infer<typeof StudentStateSchema> | null {
    const looksLikeState = (o: unknown): o is Record<string, unknown> =>
        !!o && typeof o === "object" && "CurrentSessions" in o;

    if (looksLikeState(json)) {
        const p = StudentStateSchema.safeParse(json);
        if (p.success) return p.data;
    }
    if (json && typeof json === "object") {
        for (const v of Object.values(json as Record<string, unknown>)) {
            if (looksLikeState(v)) {
                const p = StudentStateSchema.safeParse(v);
                if (p.success) return p.data;
            }
        }
    }
    return null;
}

/**
 * Read the student's persistent state from their HLBus (from config.HLBusURL).
 * The bus pushes the current state snapshot on connect, so this reflects
 * persistent class filtering even when no teacher has a session actively open.
 * Best-effort: resolves null on any failure/timeout so the caller can fall back.
 */
function fetchHaparaBusState(
    hlBusUrl: string,
    studentId: string,
    timeoutMs: number,
): Promise<z.infer<typeof StudentStateSchema> | null> {
    return new Promise(resolve => {
        let ws: WebSocket | null = null;
        let settled = false;
        const finish = (value: z.infer<typeof StudentStateSchema> | null) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
                ws?.close();
            } catch {}
            resolve(value);
        };
        const timer = setTimeout(() => finish(null), timeoutMs);
        const url = `${hlBusUrl.replace(/\/$/, "")}/${encodeURIComponent(studentId)}`;
        try {
            ws = new WebSocket(url);
        } catch {
            return finish(null);
        }
        ws.on("message", (data: WebSocket.RawData) => {
            try {
                const state = extractBusState(JSON.parse(data.toString()));
                if (state) finish(state);
            } catch {}
        });
        ws.on("error", () => finish(null));
        ws.on("close", () => finish(null));
    });
}

export function checkHaparaFilter(
    input: HaparaCheckInput,
    options: HaparaCheckerOptions = {},
): ResultAsync<HaparaCheckResult, HaparaError> {
    const normalizedUrlStr = normalizeHaparaUrl(input.url);
    let parsedUrl: URL;

    try {
        parsedUrl = new URL(normalizedUrlStr);
    } catch {
        return ResultAsync.fromSafePromise(
            Promise.resolve(
                err<HaparaCheckResult, HaparaError>({
                    type: "INVALID_URL",
                    message: "Could not parse the provided URL.",
                    input: input.url,
                }),
            ),
        ).andThen(x => x);
    }

    // by-email resolves the full session-independent config (whitelist,
    // monitoring window, HLBus URL); by-id has only the ids the caller gave us.
    const resolve: ResultAsync<
        { student: HaparaStudentById; config?: HaparaStudentConfig },
        HaparaError
    > =
        input.student.kind === "by-id"
            ? ResultAsync.fromSafePromise(
                  Promise.resolve({ student: input.student }),
              )
            : lookupHaparaStudentConfig(input.student.email, options).map(
                  config => ({
                      student: {
                          kind: "by-id" as const,
                          userId: config.userId,
                          classIds: config.classIds,
                      },
                      config,
                  }),
              );

    return resolve.andThen(({ student, config }) =>
        fetchStudentState(
            student,
            config,
            options,
            parsedUrl,
            normalizedUrlStr,
            input.url,
        ),
    );
}

function fetchStudentState(
    student: HaparaStudentById,
    config: HaparaStudentConfig | undefined,
    options: HaparaCheckerOptions,
    parsedUrl: URL,
    normalizedUrlStr: string,
    inputUrl: string,
): ResultAsync<HaparaCheckResult, HaparaError> {
    const apiBase = (options.apiBaseUrl ?? HAPARA_API_BASE).replace(/\/$/, "");
    const timeoutMs = options.timeoutMs ?? 10_000;

    const client = xior.create({
        timeout: timeoutMs,
        headers: { "Content-Type": "application/json" },
    });

    return ResultAsync.fromPromise(
        (async () => {
            let state: z.infer<typeof StudentStateSchema> | null = null;

            const res = await client.post<unknown>(
                `${apiBase}/hlstate/student/state`,
                [{ ID: student.userId, Classes: student.classIds }],
            );
            const parsed = StudentStateSchema.safeParse(res.data);
            if (parsed.success) state = parsed.data;

            if (!hasRestrictingOrPause(state) && config?.hlBusUrl) {
                const busState = await fetchHaparaBusState(
                    config.hlBusUrl,
                    student.userId,
                    Math.min(timeoutMs, 8_000),
                );
                if (hasRestrictingOrPause(busState)) state = busState;
            }

            return computeVerdict(
                state ?? {
                    CurrentSessions: [],
                    Messages: [],
                    RecordingSessions: [],
                },
                parsedUrl,
                normalizedUrlStr,
                inputUrl,
                config,
            );
        })(),
        error => {
            if (error && typeof error === "object" && "type" in error) {
                return error as HaparaError;
            }
            return toNetworkError(error);
        },
    );
}

function computeVerdict(
    state: z.infer<typeof StudentStateSchema>,
    parsedUrl: URL,
    normalizedUrlStr: string,
    inputUrl: string,
    config?: HaparaStudentConfig,
): HaparaCheckResult {
    const sessions = state.CurrentSessions ?? [];

    const pauseSession = sessions.find(s => s.Type === "pausescreen");
    const activeSession = sessions.find(
        s => s.Type === "filter" || s.Type === "focus" || s.Type === "lock",
    );

    // `monitored` reflects only the MonitoringTime schedule, NOT config.isValid:
    // Valid is relative to the *requester's* IP (false with InvalidCode
    // "ip_not_in_range" whenever the check runs off the school network), so
    // gating on it would always report UNMONITORED server-side. isValid is still
    // surfaced separately via `invalidCode` for callers that care.
    const monitored = config ? isMonitoredNow(config.monitoringTime) : null;
    const whitelisted = config
        ? matchesWhiteList(normalizedUrlStr, config.whiteList)
        : false;

    const base = {
        inputUrl,
        normalizedUrl: normalizedUrlStr,
        hostname: parsedUrl.hostname,
        monitored,
        invalidCode: config?.invalidCode ?? null,
        whitelisted,
        rawState: state,
    };

    if (!activeSession) {
        if (pauseSession) {
            return {
                ...base,
                verdict: "PAUSED",
                sessionType: "pausescreen",
                sessionId: pauseSession.ID,
                teacherName: buildTeacherName(pauseSession),
                sessionStart: pauseSession.Start ?? null,
                sessionEnd: pauseSession.End ?? null,
                blockedDomains: [],
                allowedDomains: [],
                allowedLinks: [],
                matchedDomain: null,
                stateSource: "session",
                rawSession: pauseSession,
            };
        }

        // No session at all. Answer from session-independent config when we
        // have it, instead of giving up with NO_SESSION.
        const noSession = {
            ...base,
            sessionType: null,
            sessionId: null,
            teacherName: null,
            sessionStart: null,
            sessionEnd: null,
            blockedDomains: [],
            allowedDomains: [],
            allowedLinks: [],
            matchedDomain: null,
        };

        if (!config) {
            return { ...noSession, verdict: "NO_SESSION", stateSource: null };
        }
        if (whitelisted) {
            return { ...noSession, verdict: "ALLOWED", stateSource: "config" };
        }
        if (monitored === false) {
            // Not monitored right now → Highlights isn't filtering.
            return {
                ...noSession,
                verdict: "UNMONITORED",
                stateSource: "config",
            };
        }
        // Monitored but no restricting session → Highlights doesn't block
        // outside of an active session, so browsing is allowed.
        return { ...noSession, verdict: "ALLOWED", stateSource: "config" };
    }

    const links = activeSession.Links ?? [];
    const sharedFields = {
        ...base,
        sessionType: activeSession.Type as HaparaSessionType,
        sessionId: activeSession.ID,
        teacherName: buildTeacherName(activeSession),
        sessionStart: activeSession.Start ?? null,
        sessionEnd: activeSession.End ?? null,
        stateSource: "session" as const,
        rawSession: activeSession,
    };

    if (activeSession.Type === "lock") {
        return {
            ...sharedFields,
            verdict: "LOCKED",
            blockedDomains: [],
            allowedDomains: [],
            allowedLinks: [],
            matchedDomain: null,
        };
    }

    if (activeSession.Type === "filter") {
        const blockedDomains = convertToListOfDomains(links);
        const matchedDomain = matchesDomainList(parsedUrl, blockedDomains);

        return {
            ...sharedFields,
            verdict:
                whitelisted || matchedDomain === null ? "ALLOWED" : "BLOCKED",
            blockedDomains,
            allowedDomains: [],
            allowedLinks: [],
            matchedDomain,
        };
    }

    const focusType =
        activeSession.FocusSessionDetails?.FocusType ?? "whole_site";

    if (focusType === "whole_site") {
        const allowedDomains = convertToListOfDomains(links);
        const matchedDomain = matchesDomainList(parsedUrl, allowedDomains);

        return {
            ...sharedFields,
            verdict:
                whitelisted || matchedDomain !== null ? "ALLOWED" : "BLOCKED",
            blockedDomains: [],
            allowedDomains,
            allowedLinks: [],
            matchedDomain,
        };
    }

    const allowedLinks = links;
    const matchedLink = matchesLinkList(normalizedUrlStr, allowedLinks);

    return {
        ...sharedFields,
        verdict: whitelisted || matchedLink !== null ? "ALLOWED" : "BLOCKED",
        blockedDomains: [],
        allowedDomains: [],
        allowedLinks,
        matchedDomain: matchedLink,
    };
}

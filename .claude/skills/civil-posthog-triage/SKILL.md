---
name: civil-posthog-triage
description: Investigate Civil production problems and real usage through PostHog (project 468271): errors users hit, console logs in session replays, Replay Vision scans, relay and ingestion gaps. Use when the owner reports a production bug, asks what users struggle with, or when AGENTS.md calls for PostHog evidence about how people use Civil.
---
# PostHog triage

- Tool: PostHog MCP connector's `exec` tool (named `mcp__<connector-id>__exec`). `plugin:posthog` server may need /mcp authorization; connector works without. Run `learn -s "<keywords>"` first, then `learn analytics` before any SQL. Generic flows: load matching `posthog:*` skill (querying-posthog-data, investigating-replay, finding-sessions-to-watch, triaging-error-issues).
- Project 468271 on us.posthog.com. App runs at civil.quartinal.me.
- Console errors: HogQL table `console_logs_log_entries` with `log_source = 'session_replay'`; `log_source_id` is session id. Group errors by message there: `$exception` events miss most proxy errors.
- Replay Vision: `vision-requests-create` takes up to 200 session ids + inline monitor prompt. Poll `vision-requests-get`; output over 100 KB, so parse saved file. Each observation costs 5 credits on default model; free 2,500 credits/month capped, no spend. Check remaining credits before large batch. Low-activity sessions come back `ineligible`; a few sit in `running` 20+ minutes.
- Vision can read recording's network log (e.g. status codes of `/bare/v3/` requests). No MCP tool lists recording network requests.
- History explaining odd data: recordings stop 2026-10-19, resume 2026-10-29, because relay blocked `/s/` until commit 11f28be. Recordings before about Oct 24 show Sep 24 build ("Unblock" button UI), not Strata. Relay lives in `misc/analytics/posthogProxy.ts`.
- Production facts from Oct 2026 review (recheck before relying):
  - `BETTER_AUTH_URL` was unset. Auth now trusts request's own host; Patreon OAuth still builds callbacks from that base URL.
  - Banned-domain list (porn-domains) names ad-tech and shared hosts. Wisp suffix-matches, so blocks every `*.b-cdn.net` and `*.blogspot.com` host.
  - Under Bun, node:http closes idle keep-alive sockets about 6 s after response. bare-server-node's default limiter answers 429 to 40 of 50 requests one page load makes.
- Privacy: never put user emails, IPs or person ids in reports or commits. Cite session ids and counts.
- Fix flow: reproduce locally (civil-ui-verify skill, or live probe in civil-filter-research), fix root cause, cite evidence in commit body.
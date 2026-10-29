# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: students on locked-down school Chromebooks/devices, use Civil in free time to reach games, social, video past school filters. Secondary: privacy/censorship-circumvention users facing workplace/ISP filtering. School-first, but anyone behind network filter can use.

## Product Purpose

Civil Proxy = open-source web proxy. Unblocks internet behind school/network filters, inside full simulated browser UI (tabs, bookmarks, history, new-tab page, extensions, apps/games library), not bare iframe wrapper. Goal: normal-feeling browsing despite filtering.

## Positioning

Two things competing unblockers (UV, Rammerhead, Interstellar, etc.) can't truthfully claim together:
1. **Full browser experience**: tabs, bookmarks, history, extensions, new-tab page mimic real browser chrome, not just proxied iframe.
2. **Active, per-vendor filter-evasion engineering**: detectors/bypasses tuned per filter vendor (iboss gateway detection, LanSchool Air checker, Securly broker/cluster, Lightspeed, GoGuardian manifest toast), kept current as vendors change.

## Operating Context

- Mainly school-managed Chromebooks/devices where filter extension or network gateway (Securly, Lightspeed, GoGuardian, iBoss, Blocksi, FortiGuard, Cisco Umbrella) intercepts/blocks traffic.
- Ships "Filter Checker" (`checkfilters` route): users test if network/filter setup compatible.
- Ships ban-detection UI (`ban`, `baninfo` routes): shows when vendor flagged/blocked proxy, plus vendor toasts (e.g. iBoss gateway detect toast) warn proactively.
- Transport layer on Mercury Workshop tooling (scramjet, bare-mux, epoxy-transport, libcurl-transport) plus custom Wisp (native Rust/napi + Zig client).
- Deployed via Docker/Docker Compose; built SolidJS 2 + @solidjs/vite-plugin (start mode) + TanStack Router, served via Nitro.

## Capabilities and Constraints

- Full simulated browser chrome: tabs (drag reorder), search/URL bar, bookmarks bar + page, history, new-tab page, apps page, games, extensions page (incl. devtools panel / Chii integration).
- Settings (`/settings`): every auto choice Civil makes also manual: search engine, connection method (default, per-site rules, failover, timeout, Wisp version) with comparison of each method/Wisp version on site support, reliability, speed, latency; history storage location/method and full-storage behavior; startup, appearance, privacy switches, settings backup. First-run setup (`/setup`) asks main questions or picks from what browser reveals about device/network, explains each pick.
- Vendor modules under `misc/filters/` (lanschool/air, securly broker+cluster+middleware, lightspeed, iboss) and `misc/ibossGateways/`, `misc/wisp/`: maintained countermeasures, not one-off hacks. Core product surface, not plumbing.
- Database-backed (Drizzle) domain ban lists + migrations: filter/ban state persisted, not static.
- Undecided: scope of "general privacy user" secondary audience vs school-first primary. Don't assume enterprise/anonymity feature requests in scope without confirmation.

## Brand Commitments

- Name "Civil Proxy" fixed. No rebrand.
- Ads load-bearing: HilltopAds/Monetag slots = real revenue constraint, not removable in redesign.
- PostHog analytics wired in service worker config (`misc/config/service/sw.ts`): existing infra, preserve, don't replace.
- **Users may switch ads and analytics off.** Owner decided (2026-09-26): ads off in Settings; analytics off in Settings or first-run setup. Both default on; setup never offers ads switch, so no new visitor nudged. Deliberately trades some revenue/data for user control; infra stays.
- **Visual distinctiveness chosen over visual camouflage.** Previously chrome aimed to sit open on shared screen unnoticed. Owner now directs chrome redesigned in Civil's own visual language. Deliberate trade, real cost: Civil more noticeable on shared school screen. Decision, not oversight: don't silently reintroduce camouflage goal, don't re-litigate without owner.

## Evidence on Hand

- Description/keywords copy in `src/routes/index.tsx` (meta description + keyword list) reflects current positioning.
- No testimonials, case studies, press, benchmarks exist. Don't fabricate.

## Product Principles

1. Ship browser, not wrapper: chrome fidelity (tabs, history, bookmarks, new-tab) = core identity, not decoration.
2. Filter evasion = maintained engineering surface: vendor bypasses are living code keeping pace with vendors; design treats filter/ban states as first-class UI, not edge cases.
3. School-first, privacy-open: default flows/copy natural for student on locked-down device, without blocking general circumvention use.
4. Revenue infra (ads, analytics) fixed: design accommodates ad placement + PostHog, not fights them. User off switches in Settings = only sanctioned exception.

## Accessibility & Inclusion

No product-specific accessibility requirement yet.
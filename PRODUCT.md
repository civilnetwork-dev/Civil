# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: students on locked-down, school-issued Chromebooks/devices, using Civil during free time to reach games, social, and video sites past school-managed content filters. Secondary: general privacy/censorship-circumvention users facing workplace or ISP-level filtering — school-first, but the proxy is usable by anyone behind a network filter.

## Product Purpose

Civil Proxy is an open-source web proxy that unblocks internet access behind school/network content filters, wrapped in a full simulated browser UI (tabs, bookmarks, history, new-tab page, extensions, apps/games library) rather than a bare iframe wrapper. It exists to give users a normal-feeling browsing experience despite restrictive network filtering.

## Positioning

Two things a competing unblocker (UV, Rammerhead, Interstellar, etc.) could not truthfully copy at once:
1. **Full browser experience** — tabs, bookmarks, history, extensions, and a new-tab page that mimics a real browser's chrome, not just a proxied iframe.
2. **Active, per-vendor filter-evasion engineering** — dedicated detectors/bypasses tuned to specific filtering vendors (iboss gateway detection, LanSchool Air checker, Securly broker/cluster, Lightspeed, GoGuardian manifest toast), kept up to date as vendors change behavior.

## Operating Context

- Used primarily on school-managed Chromebooks/devices where a filtering extension or network-level gateway (Securly, Lightspeed, GoGuardian, iBoss, Blocksi, FortiGuard, Cisco Umbrella) intercepts or blocks traffic.
- Ships a "Filter Checker" tool (`checkfilters` route) so users can test whether their current network/filter setup is compatible.
- Ships ban-detection UI (`ban`, `baninfo` routes) surfacing when a filter vendor has flagged/blocked the proxy, plus vendor-specific toasts (e.g. iBoss gateway detect toast) warning users proactively.
- Proxy transport layer built on Mercury Workshop tooling (scramjet, bare-mux, epoxy-transport, libcurl-transport) plus a custom Wisp implementation (native Rust/napi + Zig client) and a benchmarks page comparing encoder/transport performance.
- Deployed via Docker/Docker Compose; built with SolidJS 2 + @solidjs/vite-plugin (start mode) + TanStack Router, served through Nitro.

## Capabilities and Constraints

- Full simulated browser chrome: tabs (with drag reorder), search/URL bar, bookmarks bar and page, history, new-tab page, apps page, games, extensions page (including a devtools panel / Chii integration).
- Filter-vendor-specific modules under `misc/filters/` (lanschool/air, securly broker+cluster+middleware, lightspeed, iboss) and `misc/ibossGateways/`, `misc/wisp/` — these are actively maintained countermeasures, not one-off hacks, and should be treated as core product surface, not internal plumbing.
- Database-backed (Drizzle) for domain ban lists, site proxy models, migrations — filter/ban state is persisted, not static.
- Undecided: exact scope of "general privacy user" secondary audience vs school-first primary — do not assume enterprise/anonymity-focused feature requests are in scope without confirmation.

## Brand Commitments

- Name "Civil Proxy" is fixed — no rebrand.
- Ad monetization is load-bearing: HilltopAds/Monetag ad slots present in the codebase are a real revenue constraint, not optional or removable in redesign work.
- PostHog product analytics is wired into the service worker config (`misc/config/service/sw.ts`) — treat as existing infra to preserve, not replace.
- **Visual distinctiveness is chosen over visual camouflage.** The product previously aimed for a browser chrome that could sit open on a shared screen without drawing a glance. The owner has since directed that the chrome be redesigned into Civil's own visual language. This is a deliberate trade with a real cost: Civil is now more noticeable on a shared school screen than a plain browser would be. Record it as a decision, not an oversight — do not silently reintroduce camouflage as a design goal, and do not re-litigate it without the owner.

## Evidence on Hand

- Existing description/keywords copy in `src/routes/index.tsx` (meta description + keyword list) reflects current positioning language.
- No testimonials, case studies, press, or benchmark claims beyond the in-repo `benchmarks` route (live encoder/transport comparison) exist — do not fabricate any.

## Product Principles

1. Ship a browser, not a wrapper — chrome-level fidelity (tabs, history, bookmarks, new-tab) is core identity, not decoration.
2. Filter evasion is a maintained engineering surface — vendor-specific bypasses are living code that must keep pace with filter vendors, and design work should treat filter/ban states as first-class UI, not edge cases.
3. School-first, privacy-open — default flows and copy should read naturally for a student on a locked-down device, without foreclosing general filter-circumvention use.
4. Revenue infra (ads, analytics) is a fixed constraint — design must accommodate ad placement and PostHog instrumentation, not fight them.

## Accessibility & Inclusion

No product-specific accessibility requirement established yet.

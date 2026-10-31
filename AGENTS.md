# AGENTS.md

Guidance for coding agents in repo. `CLAUDE.md` imports this file, so all-agent instructions go here.

## Project

Civil Proxy = open-source web proxy for students on school-managed devices. Full simulated browser (tabs, history, bookmarks, extensions, new tab page, apps), not proxied iframe. Per-vendor filter-evasion code (Securly, Lightspeed, GoGuardian, iboss, LanSchool, others) = core product surface, not plumbing.

Read relevant doc before changing product behaviour, UI, copy:

- `PRODUCT.md`: users, positioning, owner decisions. Ads + PostHog = fixed revenue infrastructure. Users can switch both off in Settings; infrastructure stays. Name fixed. Visual distinctiveness chosen over camouflage; no reintroducing camouflage as design goal.
- `DESIGN.md`: Strata visual language, radius scale, component rules, house voice, do's/don'ts.
- `ICONS.md`: icon grid + contract every glyph follows.

Issues, PRs on GitHub at `civilnetwork-dev/Civil`; use `gh`.

## Commands

Bun = package manager + runtime. `patches/` applied via `patchedDependencies` in `package.json`.

```sh
bun install
bunx vite --port 5173              # UI dev server; needs no backend
./build.sh                         # build:configs, then vite build (what Docker runs)
bun run build                      # vite build only, into dist/
bun run build:configs              # misc/config bundles, into dist-config/
bun run build:wisp-native          # Rust/napi Wisp server addon (needs a Rust toolchain)
bun run start                      # bun run.ts, the server, on PORT (default 9876)

bun run test                                        # whole suite (vitest run)
bunx vitest run src/lib/settings.test.ts            # one file
bunx vitest run src/lib/settings.test.ts -t "name"  # one test
bunx tsc --noEmit                                   # type check (TypeScript 7, no script)

bun run lint                       # oxlint --fix (writes)
bun run format                     # oxfmt (writes)
bun run lint:check                 # read-only
bun run format:check               # read-only
bun run audit                      # oxlint, oxfmt --check, fallow dead-code
bun run audit:advisory             # fallow dupes and health

bun run db:generate                # drizzle-kit, config in misc/database/drizzle.config.ts
bun run db:migrate
bun run db:studio
docker compose up --build          # Postgres, Redis, the app and drizzle-studio
```

Clean oxlint run prints nothing, exits 0.

`bun run start` needs `.env` (copy `.env.example`), Postgres, Redis, `dist/`, `dist-config/`, Wisp addon. Addon gitignored like all `*.node` files; build locally. `misc/env.ts` checks required vars at startup: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (min 32 chars), `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `IBOSS_SECURITY_KEY`. UI work needs none; Vite dev server enough.

## Architecture

### One server: `run.ts`

Hono app = whole backend. `@hono/node-server` adapts to `node:http` server, which first gives Chii devtools (`/chii/`) and Bare server (`/bare/`) their requests: both use raw Node streams. In order, `run.ts`:

1. validates env (`misc/env.ts`);
2. mounts PostHog relay (`misc/analytics/posthogProxy.ts`) before compression + 100 kB body limit, so capture payloads pass unparsed;
3. mounts `misc/database` (better-auth at `/api/auth/*`, GraphQL at `/graphql`, visit tracking) + per-vendor middleware from `misc/filters/*`;
4. serves proxy APIs (`/api/checkBanned`, `/api/banStatus`, `/api/extProxy`, others), Mercury Workshop runtimes direct from `node_modules` (`/scramjet`, `/scramjetController`, `/epoxy`, `/libcurl`, `/bareTransport`, `/baremux`), `dist-config/`, `dist/client/`;
5. hands all other requests to SSR handler `vite build` emits at `dist/nitro/vite/services/ssr/server.js`.

`misc/http.ts` = route helpers. `clientIp` resolves visitor address like Express `trust proxy: 1`: socket peer, or behind `REVERSE_PROXY` last `x-forwarded-for` entry. `readJsonBody` returns `{}` for missing/malformed body.

WebSocket upgrades ending `/wisp/` → native Wisp server (`misc/wisp/native`, Rust via napi) after ban check. Server gets banned-domain list (porn-domains) as hostname blacklist, refuses those hosts. Restricted site never strikes or bans: Wisp, service worker (`/ban` redirect, 403), `/api/trackVisit` only refuse, any number of times. Only admin bans (GraphQL `banUser`); `/api/banStatus` reports it. Upgrades ending `/suggestions` serve search suggestions. `/api/extProxy` rejects private hosts via `isPrivateHost` (`misc/net.ts`), follows redirects manually so every hop rechecked.

### Frontend: `src/`

SolidJS 2 (RCs, pinned exact) + TanStack Solid Router. Routes = files in `src/routes/`; router plugin generates `src/routeTree.gen.ts`. `@solidjs/vite-plugin` runs start mode with SSR, Nitro packages output (`vite.config.ts`).

`Document.tsx` = whole HTML document; both entries render it. `entry-server.tsx` streams it with fresh router per request, since shared router rendered wrong route on overlapping requests. `entry-client.tsx` hydrates `document`. One-side-only stuff goes via Document's trailing `scripts` slot, so no hydration claim shifts.

`/` = browser itself (`BrowserChrome`, client-only), only route loading proxy runtime scripts. Internal pages (`/newTab`, `/history`, `/bookmarks`, `/settings`) each run as separate document in tab's same-origin iframe. Pages and chrome share no memory: coordinate via localStorage (`src/lib/reactiveStorage.ts`, storage events) + `civil:navigate` messages.

- `src/lib/settings.ts` = typed registry of all settings. Each setting own localStorage key, validated on read since proxied pages share origin. `transport` and `search` keep legacy raw keys so older builds' values load. Separately bundled `misc/config/scramjet/scramjetInit.ts` reads `transport` and `civil:wisp-version` raw.
- `src/lib/transport.ts` picks transport per proxied navigation in one place: error page retry pick, then per-site rule, session failover, then user default. No automatic per-site pick; user chooses method + Wisp version.
- `src/lib/TabManager.ts`, `src/lib/useIframeManager.ts` (frame loading + load watchdog), `src/api/` (tabs, history, bookmarks, extensions, chrome APIs, OPFS file system via `@terbiumos/tfs`) hold browser state.
- `entry-client.tsx` sends first-time visitors to `/setup` before hydration, reloads (max once/min) on stale-chunk errors after deploy, starts PostHog only on production host when analytics setting allows.

### Proxy runtime bundles: `misc/config/` into `dist-config/`

`misc/config/bundle.js` builds these outside Vite with Rollup: service worker (`service/sw.ts` → `sw.js`), `scramjet_init.js`, bare-mux transport module. First two carry URL codec (`shared/xorCodec.ts`). Its `encode`/`decode` must stay self-contained: scramjet controller copies them into proxied frames as source text. Output format fixed: saved history + bookmarks hold encoded addresses. Bundler only strips types (oxc-transform); `tsc` type checks. Vite dev server no rebuild of these, so run `bun run build:configs` after editing `misc/config/`.

Public names stay neutral because installed filter extensions scan them (`docs/research/`). Page loads engine through `/_runtime/*` (`shared/runtimeScripts.ts`); `misc/runtimeScripts.ts` renames engine globals, IndexedDB name, DOM attributes in served bytes (`neutralizeEngineNames`); proxied frames live under `PROXY_PREFIX`. Scramjet bump that adds an engine-named identifier fails `misc/runtimeScripts.test.ts`: extend the rename table, load a proxied page in a real browser, never leave upstream name. `$scramjet$` message keys (`$scramjet$data`, `$scramjet$messagetype`) stay: service worker + extension shim read them.

### Styles

Styles = vanilla-extract `.css.ts` files in `src/styles/`, mostly one per component. `material.css.ts` holds Strata recipes; spread into component's own `style()` via `blend()`, never compose as classes. `palette.ts` = 12-colour palette as plain data so `Document.tsx` can put real hex in SVG filter attributes. `.css.ts` imported by component must not export bare functions (vanilla-extract can't serialize). `material.css.ts` may, since only other `.css.ts` files import it.

Structural primitives in `src/components/schematic/` (Sheet, TitleBlock, Rule, Anno, Field, Unfold). Settings + setup share rows via `src/components/SettingControls.tsx`. All icons from `~/components/icons`; nothing imports icon package.

### Data: `misc/database/`

Drizzle 1.0 (RCs, pinned exact) on Postgres (`schema.ts`, `models/`, SQL migrations in `migrations/`), Redis via ioredis (`cache.ts`), better-auth (`auth.ts`) with anonymous sign-in + Patreon OAuth. No password sign-in. Migration `20260610194037_strange_supernaut` dropped password column, hence `auth.ts` sets `validateSchema: false`.

Migrations use drizzle-kit v3 layout: one folder per migration with `migration.sql` + `snapshot.json`, no journal. Migrator records applied migrations by folder name; never rename migration folder.

### `misc/`: filter research and native code

`misc/` = monorepo half: independent packages, no build system, share nothing outside `misc/`.

- `filters/<vendor>/`: detection + countermeasures per filter vendor.
- `extensionHost/`: runs unpacked extension's real background code in `node:vm` with emulated `chrome.*` + web platform APIs.
- `browserApiEmulators/`: chrome API shim, bundled into app by `civilExtShimPlugin` in `vite.config.ts`.
- `filterProbe/`: checks every route vs every filter vendor, points at source to change. README covers offline + live modes.
- `tunnel/`: FreeDNS subdomains + domain picking for live probe.
- `wisp/`: Wisp server (`native/`, Rust napi) + Zig client (`zig-client/`).
- `deobfuscator/` (Zig): normalises obfuscated vendor extensions so releases diffable.
- `obfuscatti/` (Zig): optional native engine for build-time asset obfuscation. README has pinned Zig toolchain + build steps.

After `vite build`, `misc/vite/obfuscateAssets.ts` obfuscates `dist/client/_build/assets` with obscura-rs, or obfuscatti when `OBFUSCATE_ENGINE=obfuscatti`. Throws (no fallback) if obfuscatti addon missing. `build.assetsDir` in `vite.config.ts`, `run.ts`, this plugin must agree on `_build/assets`; `run.ts` must keep 404 for missing `/_build` files: stale chunk falling to SSR returns HTML.

## Tests

- `vitest.config.ts` deliberately no reuse of `vite.config.ts` (no router codegen, start mode, Nitro). Shares only Solid JSX transform, redeclares aliases.
- Tests in `tests/` and beside sources in `src/`, `misc/` as `*.test.ts` / `*.test.tsx`. Default env `node`; DOM tests start with `// @vitest-environment happy-dom`.
- Component tests mount with `renderSolid` from `$tests/helpers/renderSolid`, not testing library; must call `unmount()`.
- `tests/setup.ts` fills placeholder credentials (Postgres + Redis drivers connect lazily), sets vanilla-extract file scope so `.css.ts` modules import clean.
- Offline filter probe suite: `bunx vitest run misc/filterProbe misc/filters/filterBlockerMiddleware.test.ts`. With vendor bundles in `~/extensions` (or `CIVIL_FILTER_BUNDLES`) also runs real filters; `bun misc/filterProbe/downloadBundles.ts` fetches them.
- Check UI changes in browser at 1366x768 (common school Chromebook) + 390x844.

## Conventions

- Aliases: `~/` = `src/`, `$config/` = `misc/config/`, `$tests/` = `tests/`. `tsconfig.json` + `vitest.config.ts` declare all three; `misc/config/bundle.js` declares `$config/`.
- oxfmt: 4-space indent, 80 cols, `arrowParens: "avoid"`, sorted imports. Markdown + YAML hand-laid, excluded.
- `oxlint.config.ts` + `.fallowrc.json` explain every exception in comment. New exceptions get reason same way.
- Comments explain why: incident, constraint, failed alternative. Match.
- Commits: Conventional Commits with scope, e.g. `fix(sw): ...`, `feat(ui): ...`, `refactor(newtab): ...`.
- Required env vars listed in four places that must agree: `REQUIRED_ENV` in `misc/env.ts`, `.env.example`, app env in `docker-compose.yml`, defaults in `tests/setup.ts`.
- `docker-compose.yml` publishes Postgres + Redis on `127.0.0.1` only. Keep prefix, else they listen on all interfaces.
- Logo changes hit every copy together: `src/components/Wordmark.tsx`, `public/assets/civil-wordmark.{svg,png}`, `public/favicon.ico`, `MARK_STONE` + `MARK_DOOR` in `src/components/LoadingAnimation.tsx`.
- Route paths (API + pages) camelCase, no hyphens: `/api/trackVisit`, `/filterCheck/securly`, `/newTab`, `/checkFilters`. Rename = every caller, incl. `misc/config/` bundles (`bun run build:configs`). Router matches case-insensitively (TanStack `caseSensitive` default off), so old lowercase page URLs in saved sessions + history still load; keep it off. `browser:` addresses stay lowercase, Chrome-style (`browser:newtab`), mapped in `src/lib/browserUrls.ts`. Exceptions: paths third parties own (`/api/auth/*` from better-auth, PostHog relay paths).

## Skills, subagents and tools

- Playwright MCP screenshots → `.playwright-mcp/` (gitignored), absolute paths.
- Every subagent run `/caveman ultra` whole run, skill-asked or started for speed. Subagent writing/changing code also run `/ponytail full` with Caveman.
- Real-creativity work (e.g. UI redesign) → `/adhd` skill.
- UI redesign: Taste (`design-taste-frontend`) + Impeccable skills with `/adhd`. Unless owner named 2+ liked reference sites, run `/interview-me` to find them, then pull design components via `/extract-design` + other Designlang commands. Add other skills where help.
- Request or stored memory about how people actually use Civil → check PostHog for evidence via PostHog skills.
- All saves to Hindsight compressed with Caveman first, save tokens on Hindsight Cloud account. Uncompressed Hindsight memory/document → compress with Caveman too.
- Functions, variables, other code → look up via JCodeMunch MCP server. Stuff likely deep in Markdown file >50 lines → JDocMunch MCP server.
- Before any Fallow task, check Fallow skills (`fallow`, `fallow-review`, `fallow-setup`, rest) for one covering it; use it.
- Fallow health stays 100: no function, `describe` or `it` callback >60 lines. Hoist test tables to module scope.

## Gotchas

- Solid 2 applies signal writes on flush; read right after write same tick = old value. Test dispatching `input` then submitting sync sees stale state; await `setTimeout(0)` between.
- Reading signal directly in component body logs `[STRICT_READ_UNTRACKED]`. For one-time initial value, read source (`getSetting(...)`) or use `untrack`.
- In `onSettled` callback, return cleanup fn; never call `onCleanup` inside.
- Solid 2 JSX uses lowercase `tabindex`.
- `Specimen` renders `icon` prop once. To swap glyph, re-create specimen keyed on it, like `SetupPage.tsx`.
- `overrides["@tanstack/router-core"]` in `package.json` must equal exact router-core version installed `@tanstack/solid-router` depends on, not newest; `@tanstack/history` follows router-core's pin. After TanStack bump, `bun run build` must pass and `node_modules/@tanstack/router-core/node_modules` must not exist.
- TanStack Router devtools opt-in (`VITE_ROUTER_DEVTOOLS=1`). When on, fire Solid's delegated click handlers twice.
- Dev server without backend = expected noise: bare-mux worker fetch failures, 404s for `/sw.js`, `/scramjet/*`, `/baremux/*`, `/suggestions` WebSocket never connects, failed `/wisp/` probe in setup (then picks Bare). Filter check page logs `chrome-extension://invalid` errors by design. `[STRICT_READ_UNTRACKED] ... in
  <Document>` and "Hydration completed with 1 unclaimed server-rendered node(s)" also expected in dev.
- `/setup` only catches visitors with neither `civil:setup-complete` nor `browser-session` in localStorage. Remove both keys to see again.
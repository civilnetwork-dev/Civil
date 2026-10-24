# AGENTS.md

Guidance for coding agents working in this repository. `CLAUDE.md` imports this
file, so instructions that apply to every agent belong here.

## Project

Civil Proxy is an open-source web proxy for students on school-managed devices.
It is a full simulated browser (tabs, history, bookmarks, extensions, a new tab
page, apps) rather than a proxied iframe. Its per-vendor filter-evasion code
(Securly, Lightspeed, GoGuardian, iboss, LanSchool and others) is core product
surface, not plumbing.

Read the relevant document before changing product behaviour, UI or copy:

- `PRODUCT.md`: users, positioning and the owner's decisions. Ads and PostHog
  are fixed revenue infrastructure. Users may switch both off in Settings, but
  the infrastructure stays. The name is fixed. Visual distinctiveness was chosen
  over camouflage, so do not reintroduce camouflage as a design goal.
- `DESIGN.md`: the Strata visual language, the radius scale, component rules,
  the house voice, and the do's and don'ts.
- `ICONS.md`: the icon grid and the contract every glyph follows.

Issues and pull requests live on GitHub at `civilnetwork-dev/Civil`; use `gh`.

## Commands

Bun is the package manager and runtime. `patches/` is applied through
`patchedDependencies` in `package.json`.

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

A clean oxlint run prints nothing and exits 0.

`bun run start` needs `.env` (copy `.env.example`), Postgres, Redis, `dist/`,
`dist-config/` and the Wisp addon. The addon is gitignored like every `*.node`
file, so build it locally. `misc/env.ts` checks the required variables at
startup: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (at least 32
characters), `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET` and
`IBOSS_SECURITY_KEY`. UI work needs none of this; the Vite dev server is enough.

## Architecture

### One server: `run.ts`

A Hono app is the whole backend. `@hono/node-server` adapts it to a `node:http`
server, which first hands Chii devtools (`/chii/`) and the Bare server
(`/bare/`) their requests: both work on the raw Node streams. In order,
`run.ts`:

1. validates the environment (`misc/env.ts`);
2. mounts the PostHog relay (`misc/analytics/posthogProxy.ts`) before
   compression and the 100 kB body limit, so capture payloads pass through
   unparsed;
3. mounts `misc/database` (better-auth at `/api/auth/*`, GraphQL at `/graphql`,
   visit tracking) and the per-vendor middleware from `misc/filters/*`;
4. serves the proxy APIs (`/api/best-proxy`, `/api/check-banned`,
   `/api/violations`, `/api/ext-proxy` and others), the Mercury Workshop
   runtimes straight out of `node_modules` (`/scramjet`, `/scramjetController`,
   `/epoxy`, `/libcurl`, `/bare-transport`, `/baremux`), `dist-config/` and
   `dist/client/`;
5. hands every other request to the SSR handler that `vite build` emits at
   `dist/nitro/vite/services/ssr/server.js`.

`misc/http.ts` holds the route helpers. `clientIp` resolves the visitor's
address as Express's `trust proxy: 1` did: the socket's peer, or behind
`REVERSE_PROXY` the last `x-forwarded-for` entry. `readJsonBody` returns `{}`
for a missing or malformed body.

WebSocket upgrades ending in `/wisp/` go to the native Wisp server
(`misc/wisp/native`, Rust through napi) after a ban check. The server receives
the banned-domain list as its hostname blacklist, and its violation callback
records strikes (`misc/violations.ts`). Upgrades ending in `/suggestions` serve
search suggestions. `/api/ext-proxy` and `/api/best-proxy` reject private hosts
with `isPrivateHost` (`misc/net.ts`), and ext-proxy follows redirects by hand
so every hop is checked again.

### Frontend: `src/`

SolidJS 2 (release candidates, pinned exactly) with TanStack Solid Router.
Routes are files in `src/routes/`; the router plugin generates
`src/routeTree.gen.ts`. `@solidjs/vite-plugin` runs in start mode with SSR, and
Nitro packages the output (`vite.config.ts`).

`Document.tsx` is the entire HTML document, and both entries render it.
`entry-server.tsx` streams it with a fresh router per request, because a shared
router rendered the wrong route when requests overlapped. `entry-client.tsx`
hydrates `document`. Anything that exists on only one side goes through
Document's trailing `scripts` slot, so it shifts no hydration claim.

`/` is the browser itself (`BrowserChrome`, client-only) and the only route that
loads the proxy runtime scripts. Internal pages such as `/newtab`, `/history`,
`/bookmarks` and `/settings` each run as a separate document inside a tab's
same-origin iframe. Pages and the chrome share no memory: they coordinate
through localStorage (`src/lib/reactiveStorage.ts`, storage events) and
`civil:navigate` messages.

- `src/lib/settings.ts` is the typed registry of every setting. Each setting is
  its own localStorage key, validated on read because proxied pages share the
  origin. `transport` and `search` keep their legacy raw keys because the
  separately bundled `misc/config/scramjet/scramjetInit.ts` reads them.
- `src/lib/transport.ts` picks the transport for each proxied navigation in one
  place: the error page's retry pick, then a per-site rule, this session's
  failover, the `/api/best-proxy` pick, and finally the default.
- `src/lib/TabManager.ts`, `src/lib/useIframeManager.ts` (frame loading and the
  load watchdog) and `src/api/` (tabs, history, bookmarks, extensions, chrome
  APIs, an OPFS file system through `@terbiumos/tfs`) hold browser state.
- `entry-client.tsx` sends first-time visitors to `/setup` before hydration,
  reloads (at most once a minute) on stale-chunk errors after a deploy, and
  starts PostHog only on the production host while the analytics setting
  allows it.

### Proxy runtime bundles: `misc/config/` into `dist-config/`

`misc/config/bundle.js` builds these outside Vite, with Rollup: the service
worker (`service/sw.ts` into `sw.js`), `scramjet_init.js`, `wasm_dencode.js`
(the URL codec over `config/encoder/xor_encoder.wasm`) and the bare-mux
transport module. It only strips types (oxc-transform); `tsc` does the type
checking. The Vite dev server does not rebuild these bundles, so run
`bun run build:configs` after editing `misc/config/`.

### Styles

Styles are vanilla-extract `.css.ts` files in `src/styles/`, mostly one per
component. `material.css.ts` holds the Strata recipes; spread them into a
component's own `style()` with `blend()` and never compose them as classes.
`palette.ts` is the 12-colour palette as plain data, so `Document.tsx` can put
real hex values in SVG filter attributes. A `.css.ts` file that a component
imports must not export bare functions, because vanilla-extract cannot serialize
them. `material.css.ts` may, because only other `.css.ts` files import it.

Structural primitives live in `src/components/schematic/` (Sheet, TitleBlock,
Rule, Anno, Field, Unfold), and Settings and setup share their rows through
`src/components/SettingControls.tsx`. Every icon comes from
`~/components/icons`; nothing imports an icon package.

### Data: `misc/database/`

Drizzle 1.0 (release candidates, pinned exactly) on Postgres (`schema.ts`,
`models/`, SQL migrations in `migrations/`), Redis through ioredis (`cache.ts`),
and better-auth (`auth.ts`) with anonymous sign-in and Patreon OAuth. There is
no password sign-in. Migration `20260610194037_strange_supernaut` dropped the
password column, which is why `auth.ts` sets `validateSchema: false`.

Migrations use drizzle-kit's v3 layout: one folder per migration holding
`migration.sql` and `snapshot.json`, and no journal. The migrator records each
applied migration by its folder name, so never rename a migration folder.

### `misc/`: filter research and native code

`misc/` is the monorepo half of the repository: independent packages with no
build system, sharing nothing outside `misc/` except the root `config/`.

- `filters/<vendor>/`: detection and countermeasures for each filter vendor.
- `extensionHost/`: runs an unpacked extension's real background code in
  `node:vm`, with emulated `chrome.*` and web platform APIs.
- `browserApiEmulators/`: the chrome API shim, bundled into the app by
  `civilExtShimPlugin` in `vite.config.ts`.
- `filterProbe/`: checks every route against every filter vendor and points at
  the source that has to change. Its README covers the offline and live modes.
- `tunnel/`: FreeDNS subdomains and domain picking for the live probe.
- `wisp/`: the Wisp server (`native/`, Rust napi) and a Zig client
  (`zig-client/`).
- `deobfuscator/` (Zig): normalises obfuscated vendor extensions so their
  releases can be diffed.
- `obfuscatti/` (Zig): an optional native engine for build-time asset
  obfuscation. Its README has the pinned Zig toolchain and build steps.

After `vite build`, `misc/vite/obfuscateAssets.ts` obfuscates
`dist/client/_build/assets` with obscura-rs, or with obfuscatti when
`OBFUSCATE_ENGINE=obfuscatti`. It throws, rather than falling back, when the
obfuscatti addon is missing. `build.assetsDir` in `vite.config.ts`, `run.ts` and
this plugin must agree on `_build/assets`, and `run.ts` must keep answering 404
for missing `/_build` files: a stale chunk that falls through to SSR comes back
as HTML.

## Tests

- `vitest.config.ts` deliberately does not reuse `vite.config.ts` (no router
  codegen, start mode or Nitro). It shares only the Solid JSX transform and
  declares the aliases again.
- Tests live in `tests/` and beside their sources in `src/` and `misc/` as
  `*.test.ts` or `*.test.tsx`. The default environment is `node`; DOM tests
  start with `// @vitest-environment happy-dom`.
- Component tests mount with `renderSolid` from `$tests/helpers/renderSolid`
  instead of a testing library, and must call `unmount()`.
- `tests/setup.ts` fills placeholder credentials (the Postgres and Redis drivers
  connect lazily) and sets a vanilla-extract file scope so `.css.ts` modules
  import cleanly.
- The offline filter probe suite is
  `bunx vitest run misc/filterProbe misc/filters/filterBlockerMiddleware.test.ts`.
  With vendor bundles in `~/extensions` (or `CIVIL_FILTER_BUNDLES`) it also runs
  the real filters; `bun misc/filterProbe/downloadBundles.ts` fetches them.
- Check UI changes in a browser at 1366x768 (a common school Chromebook) and
  390x844.

## Conventions

- Aliases: `~/` is `src/`, `$config/` is `misc/config/`, `$wasm/` is
  `config/encoder/`, and `$tests/` is `tests/`. `tsconfig.json`,
  `vitest.config.ts` and `misc/config/bundle.js` each declare them.
- oxfmt formats with 4-space indents, 80 columns, `arrowParens: "avoid"` and
  sorted imports. Markdown and YAML are laid out by hand and excluded.
- `oxlint.config.ts` and `.fallowrc.json` explain every exception in a comment.
  Give any new exception its reason the same way.
- Comments explain why: the incident, the constraint, the alternative that
  failed. Match that.
- Commit messages follow Conventional Commits with a scope, such as
  `fix(sw): ...`, `feat(ui): ...` or `refactor(newtab): ...`.
- The required environment variables are listed in four places that must agree:
  `REQUIRED_ENV` in `misc/env.ts`, `.env.example`, the app's environment in
  `docker-compose.yml`, and the defaults in `tests/setup.ts`.
- `docker-compose.yml` publishes Postgres and Redis on `127.0.0.1` only. Keep the
  prefix, or they listen on every interface.
- Logo changes land in every copy together: `src/components/Wordmark.tsx`,
  `public/assets/civil-wordmark.{svg,png}`, `public/favicon.ico` and `MARK_C` in
  `src/components/LoadingAnimation.tsx`.

## Gotchas

- Solid 2 applies signal writes on flush, so a read right after a write in the
  same tick returns the old value. A test that dispatches `input` and then
  submits synchronously sees stale state; await `setTimeout(0)` between them.
- Reading a signal directly in a component body logs `[STRICT_READ_UNTRACKED]`.
  For a one-time initial value, read the source (`getSetting(...)`) or use
  `untrack`.
- In an `onSettled` callback, return the cleanup function; never call
  `onCleanup` inside it.
- Solid 2 JSX uses lowercase `tabindex`.
- `Specimen` renders its `icon` prop once. To swap the glyph, re-create the
  specimen keyed on it, as `SetupPage.tsx` does.
- `overrides["@tanstack/router-core"]` in `package.json` must equal the exact
  router-core version that the installed `@tanstack/solid-router` depends on,
  not the newest release, and `@tanstack/history` follows router-core's own
  pin. After a TanStack bump, `bun run build` must pass and
  `node_modules/@tanstack/router-core/node_modules` must not exist.
- TanStack Router devtools are opt-in (`VITE_ROUTER_DEVTOOLS=1`). While they are
  on, they fire Solid's delegated click handlers twice.
- The dev server without the backend shows expected noise: bare-mux worker
  fetch failures, 404s for `/sw.js`, `/scramjet/*` and `/baremux/*`, a
  `/suggestions` WebSocket that never connects, and a failed `/wisp/` probe in
  setup, which then picks Bare. The filter check page logs
  `chrome-extension://invalid` errors by design. `[STRICT_READ_UNTRACKED] ... in
  <Document>` and "Hydration completed with 1 unclaimed server-rendered node(s)"
  are also expected in dev.
- `/setup` only catches visitors with neither `civil:setup-complete` nor
  `browser-session` in localStorage. Remove both keys to see it again.

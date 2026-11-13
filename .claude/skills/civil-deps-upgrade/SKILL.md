---
name: civil-deps-upgrade
description: Upgrade Civil's npm (Bun), Cargo and Zig dependencies to their latest versions and port the code to them. Use when asked to update, bump or upgrade dependencies, packages, crates or Zig packages. Holds the pins that must not be bumped blindly (TanStack router-core, seroval, epoxy, yuku, the Solid and Drizzle release candidates) and the patch-porting steps.
---
# Civil dependency sweep

Four sweeps (Sep to Oct 2026) hit same traps. Work in this order.

## 1. Baseline

- `git status --short`: note owner's uncommitted work. Never revert.
- Copy `package.json` and `bun.lock` to scratchpad as rollback point.
- `caveman-blocks run gate`, so later failures trace to a bump.

## 2. npm packages (Bun)

- `bun outdated` lists candidates. Ignore its "Slow filesystem" lines.
- Pinned exact on release candidates: `solid-js`, `@solidjs/web`, `@solidjs/meta`, `@solidjs/vite-plugin`, `drizzle-orm`, `drizzle-kit`. Bump with `bun add --exact <pkg>@<ver>` (`bun add -d --exact` for dev dependencies). Move every Solid package to same RC together. Read release notes: RCs break APIs.
- `@solidjs/compiler` (native compiler, `@solidjs/vite-plugin` dependency) not in `package.json`: plugin bump keeps its locked RC. Run `bun update @solidjs/compiler` so it matches `solid-js` (2026-11-11: stayed rc.19 under rc.21).
- Before bumping coupled set, read its pins: `npm view <pkg>@<ver> dependencies peerDependencies --json`.
- `overrides` in `package.json`:
  - `@tanstack/router-core` must equal exact router-core version the installed `@tanstack/solid-router` depends on, never newest. `@tanstack/history` follows router-core's own pin. Overriding to newest broke `vite build` with MISSING_EXPORT `isPlainObject` (2026-09-28).
  - `seroval` and `seroval-plugins` must equal exact version `solid-js` pins.
  - `caveman-blocks run dep-pins` checks both, the patched versions, and that `node_modules/@tanstack/router-core/node_modules` does not exist (nested copy = version mismatch).
- epoxy: `@mercuryworkshop/epoxy-transport` bundles epoxy-tls into its `dist/index.mjs` at publish time. Bumping `@mercuryworkshop/epoxy-tls` alone changes nothing served. Bump epoxy-transport.
- Every bump of package in `patchedDependencies` (keyed `name@version`) needs patch ported:
  1. `bun patch <pkg>` to get editable copy in `node_modules`.
  2. Re-apply hunks of old `patches/<name>@<old>.patch` by hand.
  3. `bun patch --commit 'node_modules/<pkg>'`.
  4. Delete old patch file. Check `package.json` points at new one.
  `tests/epoxyTransport.test.ts` guards epoxy patch.
- After installing, run `bun pm untrusted`. New postinstall script needs owner's decision before going in `trustedDependencies`.
- Scramjet bump: `misc/runtimeScripts.test.ts` fails on any new engine-named identifier. Extend rename table in `misc/runtimeScripts.ts`, then load proxied page in real browser (live probe in civil-filter-research skill). Never leave upstream name in served bytes.

## 3. Cargo (`misc/wisp/native`)

- `cargo update --manifest-path misc/wisp/native/Cargo.toml`. For major bump, edit `Cargo.toml` first, then update.
- Rebuild addon with `bun run build:wisp-native`. `.node` file gitignored.

## 4. Zig (`misc/obfuscatti`, `misc/deobfuscator`)

- Dependencies live in each `build.zig.zon`. Find newest tag with `git ls-remote --tags <repo>`, then `zig fetch --save <url>`.
- yuku is 0.24.1 since commit 82e07c5 (2026-10-28). Any further bump needs Zig API port (0.20 to 0.22 renamed traverser, semantic, comments and codegen APIs). Obfuscatti must keep byte-for-byte JSDefender 2.12.0 parity afterwards: `caveman-blocks run zig-test --step test-jsdefender`.
- Toolchain pinned to stable Zig 0.17.0 (see civil-obfuscatti skill). 0.17.0-dev build fails to compile yuku 0.24.1.

## 5. Verify

- `caveman-blocks run gate`.
- `bun run build` must pass: catches MISSING_EXPORT errors `tsc` misses. Then `bun run build:configs`.
- `caveman-blocks run dep-pins` returns `"ok": true`.
- Smoke-test UI (civil-ui-verify skill). One-time "multiple instances of Solid" warning right after lockfile change is dependency re-optimization reload, not real duplicate.

## 6. Report

List bumped majors, each held-back package with reason, each ported patch. Commit only when asked, with `/ship`.
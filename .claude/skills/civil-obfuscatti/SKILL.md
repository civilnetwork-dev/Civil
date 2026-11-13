---
name: civil-obfuscatti
description: Build, test and change misc/obfuscatti, the Zig port of JSDefender Core 2.12.0 that obfuscates Civil's built assets, and the OBFUSCATE_ENGINE=obfuscatti build path. Use for any edit under misc/obfuscatti, work on obfuscation size, speed or protection, parity bugs against JSDefender, and yuku or napi-zig bumps.
---
# Obfuscatti

Read `misc/obfuscatti/README.md` (Build, Node API, limits) before change code.

- Toolchain: README pin Zig version; `build.zig.zon` set minimum. Check with `zig version`. Multiple Zig maybe installed: point block at right one with `--zig <path>`. Compile error inside `zig-pkg/` = toolchain/package mismatch, not obfuscatti bug. Never edit `zig-pkg/`: `zig build` fetch it.
- Tests from `misc/obfuscatti` (`caveman-blocks run zig-test --step <step>` summarise each):
  - `zig build test`: unit tests.
  - `zig build test-jsdefender`: differential parity against JSDefender Core 2.12.0 (`package/index.js`, SHA-256 in README).
  - `zig build -Doptimize=ReleaseFast`: addon, at `zig-out/lib/obfuscatti.node`.
- Acceptance = byte-for-byte output parity with JSDefender for every fixture. Universal parity unproven, so add differential fixture with every transform change.
- Node smoke test from `misc/obfuscatti`: `node -e "const o=require('./zig-out/lib/obfuscatti.node'); console.log(o.getVersion(), o.obfuscate('console.log(1)', {randomSeed: 42}))"`.
- App integration: after `vite build`, `misc/vite/obfuscateAssets.ts` obfuscate `dist/client/_build/assets` with obscura-rs, or with obfuscatti when `OBFUSCATE_ENGINE=obfuscatti`. That path throw, no fallback, when addon missing.
- Container check: `OBFUSCATE_ENGINE=obfuscatti podman compose up -d --force-recreate app`, then `podman ps --filter name=civil-` until app healthy.
- Size budget after build: `caveman-blocks run asset-sizes`.
- yuku bumps need Zig API port and parity rerun (see civil-deps-upgrade).
- Codex wrote large parts of tree. When commit Codex work, add `Co-Authored-By: Codex <noreply@openai.com>` (`/ship` command do this).
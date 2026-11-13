---
name: civil-filter-research
description: Reverse-engineer school filter extensions (Securly, GoGuardian, Lightspeed, iboss, LanSchool, Aristotle, Blocksi, Linewize, DyKnow, Hapara and the rest) and turn the findings into Civil countermeasures, probe runs and dated audit reports. Use for filter audits, vendor detection work, block-page research, questions like "why does filter X flag Civil", and changes under misc/filters, misc/filterProbe, misc/extensionHost or docs/research.
---
# Filter research

## Where things live

- Vendor bundles: `~/extensions/<folder>`, or folder in `CIVIL_FILTER_BUNDLES`. Fetch/refresh with `bun misc/filterProbe/downloadBundles.ts` (Filter-Sources `extensions.json` plus `misc/filterProbe/extensionCatalog.ts`; CRX signatures verified before unpacking). Never commit bundles: `/extensions/` gitignored.
- Raw audit evidence: `extensions/filter-audit-<YYYY-MM-DD>/<topic>/` (inside repo, gitignored). Keep inventories, logs, downloaded captures there.
- Reports: `docs/research/filter-audit-<YYYY-MM-DD>[-<topic>].md`, one per pass or topic. Follow earlier reports: what changed in product, Verification (exact commands and results), Completion audit, remaining work. Counts in bold, exact paths, cite evidence files. Correct earlier wrong claim in so many words (e.g. Blocksi `hvtrs8`: Civil's codec writes `hvtrs%27`).
- Code: per-vendor countermeasures in `misc/filters/<vendor>/`; extension id to vendor groups in `misc/filterProbe/vendors.ts`; block-page detector and fix predictor in `misc/filterProbe/detect.ts` and `predict.ts`; emulated extension runtime in `misc/extensionHost/`.

## Reading vendor code

- Search minified bundle: `caveman-blocks run min-grep --path <file or dir> --pattern '<regex>' --context 120`. Blocks read only inside repo, so copy bundle from `~/extensions` into audit folder first.
- Normalize obfuscated releases so two versions diff cleanly: `misc/deobfuscator` (Zig, see its README).
- WASM or native helpers: reverse-engineer-anything (REA) skill.

## Probing

- Offline suite, after every change (what CI runs): `caveman-blocks run test-summary --cmd "bunx vitest run misc/filterProbe misc/filters/filterBlockerMiddleware.test.ts"`. With bundles present, also loads each real filter. `filterProbe.test.ts` times out at 30 s while dev server and Chromium busy: rerun alone before calling it failure.
- Live end to end: `FREEDNS_EMAIL=... FREEDNS_PASSWORD=... bun misc/filterProbe/harness.ts`. Needs Postgres, Redis, FreeDNS credentials; exits non-zero for incomplete sweep. See `misc/filterProbe/README.md`.
- What extension sees on real Civil page, locally: [live-probe.md](live-probe.md).
- Vendor block pages in Wayback Machine: [wayback.md](wayback.md).

## Rules

- Archived block URLs and extension telemetry carry students' emails and names. Redact before printing anything. Never commit them.
- Public names stay neutral, because installed filters scan them: no engine names in served bytes. Scramjet bump adding engine-named identifier fails `misc/runtimeScripts.test.ts`: extend rename table in `misc/runtimeScripts.ts`, recheck with live probe.
- Claim about what filter does needs evidence from running it or from source. Mark anything unverified as unverified.
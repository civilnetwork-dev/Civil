---
name: civil-fallow-health
description: Keep Civil's Fallow health score at 100 (A) and fix Fallow findings the way this repo does. Use after UI or test edits, before commits, when asked to audit with Fallow or fix complexity, duplication or dead code, or when the score drops below 100. Generic Fallow usage lives in the fallow plugin skills; this skill holds Civil's thresholds and fixes.
---
# Fallow health at 100

Per AGENTS.md, load matching `fallow:*` skill for generic CLI and MCP use. This skill adds Civil specifics.

- Target: `bunx fallow health --score` prints `Health score: 100 A` (formula v3). `caveman-blocks run fallow-health` returns score, grade, non-zero penalties, every function over 60 lines.
- Two penalties trip first here:
  - Unit size: 0.5 x (functions over 60 lines per 1,000 functions). One 61-line function costs ~0.1. Test `describe` and `it` callbacks count as functions: split by concern (`describe("X latching")`), hoist test tables to module scope.
  - Coupling: 0.5 x percentage of files with fan-in above max(p95, 10). `src/components/Specimen.tsx` sits exactly at 10, so one more importer (even `import type`) costs ~0.2. Intended shared foundations go in `.fallowrc.json` `health.ignore`, each with comment giving reason.
- Fallow prints "Large functions" list only when 3%+ of functions exceed 60 lines, so here never shows. Use block instead.
- `bun run audit` (oxlint, oxfmt check, `fallow dead-code`) must exit 0. `bun run audit:advisory` (dupes and health) exits 1 on CRAP findings whatever score: CRAP advisory.
- Fixing long function: split into named helpers, hooks or parts, keep DOM and behaviour identical. For components, compare screenshots before and after at 1366x768 and 390x844 (civil-ui-verify skill).
- Never add `fallow-ignore` comments or new `.fallowrc.json` exceptions just to reach score unless owner agrees. Every exception carries reason comment.
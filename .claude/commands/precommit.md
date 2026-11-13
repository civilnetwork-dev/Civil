---
description: Run Civil's pre-commit gate (oxlint, oxfmt, tsc, vitest, Fallow score) and fix what fails. Argument - optional test paths to limit vitest.
argument-hint: "[test paths]"
---
1. Run `caveman-blocks run gate` (with `--tests "$ARGUMENTS"` when paths given).
2. Each failing check: fix root cause, rerun only that check: `caveman-blocks run tsc-errors`, `caveman-blocks run test-summary --cmd "bunx vitest run <file>"`, `bun run lint:check`, `bun run format:check`, `caveman-blocks run fallow-health`.
3. Rerun gate until pass, report final JSON. No commit.
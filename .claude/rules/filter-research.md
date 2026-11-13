---
paths:
  - "misc/filters/**"
  - "misc/filterProbe/**"
  - "misc/extensionHost/**"
  - "docs/research/**"
  - "extensions/**"
---
# Filter vendor code and research

- Load civil-filter-research skill before changing detection, countermeasures or audit reports.
- Archived block URLs and extension data carry students' emails and names: redact before printing, never commit.
- Never commit vendor bundles or files under `extensions/`.
- After change here, run offline probe suite: `bunx vitest run misc/filterProbe misc/filters/filterBlockerMiddleware.test.ts`.
- New audit reports go in `docs/research/filter-audit-<YYYY-MM-DD>[-<topic>].md`, evidence in `extensions/filter-audit-<YYYY-MM-DD>/<topic>/`.
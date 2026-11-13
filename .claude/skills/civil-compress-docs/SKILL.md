---
name: civil-compress-docs
description: Compress Civil's agent-facing Markdown (AGENTS.md, CLAUDE.md, DESIGN.md, ICONS.md, PRODUCT.md, docs/superpowers plans and specs, and the .claude skills, rules and commands) with caveman-compress while keeping the backups. Use when asked to compress agent docs, after large edits to those files, or when caveman-compress aborts with "Backup file already exists".
---
# Compress agent docs

- Agent docs: `AGENTS.md`, `CLAUDE.md`, `DESIGN.md`, `ICONS.md`, `PRODUCT.md`, `docs/superpowers/plans/*.md`, `docs/superpowers/specs/*.md`, `.claude/skills/*/*.md`, `.claude/rules/*.md`, `.claude/commands/*.md`.
- Never compress files for humans and GitHub: `README.md`, `misc/**/README.md`, `TODO.md`, `UPSTREAM.md`, `docs/research/*.md`. Never compress generated `.blocks/INDEX.md`.
- Run caveman-compress skill on each file by absolute path, in parallel.
- Backups land in `%LOCALAPPDATA%\caveman-compress\backups\<parent-dir>\<name>.original.md`. On rerun script aborts with "Backup file already exists". Rename old backup to `<name>.original.<YYYY-MM-DD>.md`. Never delete it: holds only pre-compression text.
- After compressing, check each file:
  - YAML frontmatter still parses, and `name`, `description`, `paths` intact.
  - Generated `<!-- caveman-blocks:start -->` to `<!-- caveman-blocks:end -->` section in AGENTS.md and CLAUDE.md unchanged: `caveman-blocks sync --check` exits 0.
  - Every negation, number, path, command, code span survived. Read diff against backup.
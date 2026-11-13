---
description: Commit the working tree the Civil way - gate, a thorough Conventional Commit humanised and cleaned of AI marks, with Claude (and Codex) credit. Argument - notes such as which parts Codex wrote.
argument-hint: "[notes, e.g. misc/obfuscatti is Codex's work]"
disable-model-invocation: true
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*)
---
## Current state

!`git status --short`

!`git diff --shortstat HEAD`

Recent subjects:

!`git log -8 --format=%s`

## Steps

1. Run gate: `caveman-blocks run gate`. Fix failures, or report. Never commit on failing gate without owner's yes.
2. Read whole change (`git diff HEAD` plus untracked files), group by intent. One commit unless owner asks for several.
3. Draft message with caveman-commit skill. Format: Conventional Commits with scope (`feat(ui): ...`, `fix(sw): ...`), subject max 72 characters. Body describes change thoroughly, wrapped at 72 columns: why needed, then short bullet list of what changed. State migrations and anything dropping data plainly.
4. Pass draft through humanizer skill, then watermarks-remover skill (clean-user-facing-text), so no AI tells, no invisible Unicode. House voice: no em dashes.
5. End message with Claude attribution trailer this session gives (`Co-Authored-By: Claude <model> <noreply@anthropic.com>`). When any part is Codex's work (see notes below, or ask), also add `Co-Authored-By: Codex <noreply@openai.com>` and say in body which parts.
6. Stage paths explicitly. Never stage `.env`, `extensions/`, `data/`, vendor bundles, student emails or secrets. Check `git status` after committing.
7. Commit on current branch. Push or open PR only when asked.

Notes from owner: $ARGUMENTS
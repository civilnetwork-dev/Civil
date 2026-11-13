---
name: civil-upstream-sync
description: Pull remote commits from civilnetwork-dev/Civil into this checkout without losing the owner's uncommitted local work, then resolve conflicts and re-verify. Use when asked to sync upstream, pull or merge remote changes, update from GitHub or origin/master while local changes exist.
---
# Sync upstream, keep local work

Checkout usually carry much uncommitted work. Losing it = one unrecoverable mistake. Never run `git reset --hard`, `git checkout -- .`, `git clean` or `git stash drop` before owner see verified result.

1. Survey: `git remote -v`, `git branch -vv`, `git stash list`, `git fetch --all --prune`, `git rev-list --left-right --count master...@{u}` (ahead, behind), `git status --porcelain | wc -l`.
2. Back up: `git add -A && git diff --cached --binary > <scratchpad>/local-changes.patch`, then `git reset` to unstage. Patch include untracked files.
3. Stash: `git stash push -u -m "pre-sync <date>"`.
4. Integrate: no unpushed local commits → `git merge --ff-only origin/master`. Branch diverged → ask owner merge or rebase.
5. Restore: `git stash apply`. No `pop`: stash stay as second backup until end.
6. Resolve conflicts:
   - List with `git diff --name-only --diff-filter=U`. Also grep `package.json` and `bun.lock` for `<<<<<<<` and `>>>>>>>`.
   - Keep both intents: upstream refactor and local feature. Upstream moved or split code (e.g. "split every function over sixty lines") → re-apply local edits at new locations.
   - Never hand-merge `bun.lock`. Resolve `package.json`, then run `bun install` to regenerate lockfile.
7. Verify: `bun install`, `caveman-blocks run gate`, `bun run build`.
8. Fallow: merge of local work over upstream function split once dropped score to 99.2 (six 61 to 106 line functions plus Specimen fan-in). Run civil-fallow-health skill until score 100.
9. Report what came in (`git log --oneline ORIG_HEAD..HEAD`), which conflicts resolved and how. Drop stash and delete patch only after owner agree.
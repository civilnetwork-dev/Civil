# Local live probe

Shows what filter extension can see on Civil's real pages. Rerun after any Scramjet bump and after changes to `misc/runtimeScripts.ts`, `misc/config/scramjet/scramjetInit.ts` or proxy prefix. Audit pass 1 never ran page; pass 2 ran it, found wrong claim plus real signals (`$scramjetController`, `bare-mux-path`, the IndexedDB name).

1. Build: `bun run build:configs && bun run build`.
2. Guard districts download. First server start downloads ~210 MB NCES shapefile whenever `misc/schoolDistricts/data/districts.sqlite` has zero rows.
   - `caveman-blocks run districts-sentinel --action status`.
   - If `rows` is 0, run `--action add` now and `--action remove` when done.
   - Delete stray `misc/schoolDistricts/data/tmp/districts.zip.part` if download already started.
3. Start server in background with placeholder env: `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (32 characters or more), `PATREON_CLIENT_ID`, `PATREON_CLIENT_SECRET`, `IBOSS_SECURITY_KEY`, `PORT=9876`, then `bun run.ts`. Postgres and Redis not needed for static routes, service worker, Bare transport or proxying. Auth and visit endpoints answer 500, ioredis logs ECONNREFUSED; both harmless here.
4. Drive with Python Playwright (`py -3.13`, `channel="chrome"`, headless). In-app Browser pane cannot register service workers, so proxying never works there.
   - Set localStorage `civil:setup-complete` to `true` and `transport` to `bare`.
   - Load `/` and await `window.scramjetReady`.
   - Open proxied frame through controller (`createFrame(iframe).go(url)`). Engine globals renamed in served bytes: read current names from `misc/runtimeScripts.ts` before scripting.
5. Replay vendor detector for real: cut its function out of vendor content script (e.g. Aristotle's `async function Vs(){...}` in `contentScript.js`) and `eval` it in page and in proxied frame. Add negative control (set the global, key or IndexedDB entry it looks for) so `null` result means something.
6. Stop server by port: `caveman-blocks run port-owner --port 9876`, then `Stop-Process -Id <pid>`. Never `taskkill /IM bun.exe`: kills every Bun process, including other sessions' servers.
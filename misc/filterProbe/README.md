# Filter route check

Tests every Civil route against every school filter Civil has to survive, one
filter at a time, and — when a filter catches the proxy — points at the Civil
source that has to change.

One filter *vendor* at a time, not one extension id: several vendors ship two
or three extensions against the same backend (Cisco, Lightspeed, Securly,
LanSchool, Aristotle, GoGuardian), so the eighteen vendors are what actually
differ. `vendors.ts` is where that id→vendor collapse lives.

## Two ways to run it

**Offline, deterministic — this is what CI runs and what you run after a
change.** No browser, no tunnel, no bundles, no wait. It drives the two pieces
with the real risk — the block-page detector and the fix predictor — plus the
sandbox against a stubbed page, off the committed `probeData.json`:

```sh
bunx vitest run misc/filterProbe misc/filters/filterBlockerMiddleware.test.ts
```

With the vendor bundles present under `~/extensions` (or
`CIVIL_FILTER_BUNDLES`), the same suite additionally loads each real filter and
runs its content scripts against a page — proving the sandbox works end to end
short of a live server. Don't have them? `bun
misc/filterProbe/downloadBundles.ts` fetches the raw bundles off
Filter-Sources' `extensions.json` (see "The bundles" below).

**Live, end to end — the full harness.** Stands up `run.ts`, tunnels it out
through FreeDNS (misc/tunnel), drives every route × filter through the sandbox
over the public URL, and tears it all down — stopping the server and deleting
the subdomain — when it finishes:

```sh
FREEDNS_EMAIL=… FREEDNS_PASSWORD=… bun misc/filterProbe/harness.ts
```

It needs what CI does not have by default — a database and Redis for `run.ts`
and FreeDNS credentials — and says which is missing rather than half-running.
Three things it now handles itself: the bundles (downloaded and cached), the
subdomain captcha (read by the OCR solver, misc/tunnel/captchaSolver — FreeDNS
gates creation on one; this reads it, it doesn't defeat the bot check), and the
**base domain**. `pickTunnelDomain` (misc/tunnel/pickDomain) sweeps the FreeDNS
registry past the filter reputation checkers (misc/filters/domainReputation) and
picks a random domain none of them block, caching the blocked set to
`data/freedns-blocked.json`. Set `CIVIL_TUNNEL_DOMAIN` + `CIVIL_TUNNEL_DOMAIN_ID`
to pin a domain, or `CIVIL_TUNNEL_CAPTCHA` for a one-shot manual captcha.

The filters that gate the pick are the ones whose extension actually rates a
bare domain against a category/reputation database — the method for each is read
straight out of that filter's own extension source in `~/extensions` (the
endpoint the content script calls, the request it sends, how it reads "blocked"
from the reply). A checker only removes a domain on a definite block: not-rated,
uncategorised or any failure abstains. Filters that decide only inside a live
class session, or against a per-device MDM policy, have no bare-domain category
to look up, so they don't participate.

## The bundles

The twenty-eight vendor extensions are never committed — ~200MB, and
third-party — so they are fetched on demand and, in the Blacksmith workflow,
kept warm in the cache: the same "download on the first run, cache thereafter"
shape [Filter-Sources](https://github.com/civilnetwork-dev/Filter-Sources) uses
for them, and this repo's `.gitignore` keeps `/extensions/` out.

Filter-Sources' own cache can't be reused here: it keeps *deobfuscated `.js`*
snapshots for diffing, without the `manifest.json` or assets the sandbox needs
to actually run a filter. So `downloadBundles.ts` fetches raw copies — using
Filter-Sources' `extensions.json` as the folder → id → update-URL list, then
Chrome's Omaha protocol and CRX unpacking (the same steps as that repo's
`omaha.zig`/`crx.zig`, in TypeScript, because that Zig tool isn't callable from
here). What it does *not* do is regenerate `probeData.json`: that stays
committed, small, and the offline suite's only input, exactly like the
extension host's `filterApiSurface.json`. Rerun `buildProbeData.ts` by hand
after a vendor ships a release.

## How a "flag" is decided

After a filter has had its fifteen seconds on a proxied route, `detect.ts`
asks the task's two questions of what the page became:

1. **`location.href`** landed on one of the vendor's own domains — the filter
   redirected the tab to its block page. Those domains are
   `filterVendorDomains` in `../filters/filterBlockerMiddleware.ts`, the same
   list the proxy blocks, so the blocklist and the detector cannot drift.
2. **the page text** carries one of the vendor's block markers, or the
   vendor's name in a blocking phrase — the filter's content script blocked in
   place. The markers are scraped from each vendor's own bundle by
   `buildProbeData.ts` into `probeData.json`; the generic ones ("Access
   Denied") are dropped, because the proxy route fetches a real third-party
   site and those would false-positive.

Attribution is never in doubt: exactly one filter is installed per run, so
"flagged" is always "flagged by the vendor under test".

## The files

| File | Job |
|---|---|
| `vendors.ts` | The id→vendor map, display names, and each vendor's primary extension |
| `buildProbeData.ts` | Scans the bundles → `probeData.json` (domains + block markers per vendor) |
| `probeData.json` | The committed answer; the bundles stay out of the repo |
| `downloadBundles.ts` | Fetches the raw bundles off Filter-Sources' `extensions.json` (Omaha + CRX) |
| `detect.ts` | Pure verdict: did vendor V flag this observation? |
| `predict.ts` | Pure traversal: which Civil source to change to stop it |
| `routes.ts` | The Civil routes exercised, incl. the proxy path |
| `sandbox.ts` | The window.open emulation — one filter + a proxied page, headless, on the extension host and happy-dom |
| `harness.ts` | The live runner: server → tunnel → matrix → teardown |
| `filterProbe.test.ts` | The offline proof + a real-bundle sandbox block |

## The ceiling, stated

`sandbox.ts` is not a browser — it reuses the extension host and happy-dom, so
it observes a filter that blocks by redirect (a `location` assignment) or by
rewriting the DOM (the text it leaves), but not one that needs a real renderer
to act. The prediction is a ranked pointer list, not a patch. And the domain
half of the detector is only as current as the middleware blocklist and
`probeData.json` — rerun `buildProbeData.ts` after a vendor ships a new
release.

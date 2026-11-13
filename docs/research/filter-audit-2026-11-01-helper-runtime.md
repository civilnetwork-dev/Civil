# Lightspeed helper: collector, complete proxy pipeline, and rendered Civil pages

Audit date: 1 November 2026, America/Los_Angeles. This follows the
[helper source recovery](filter-audit-2026-11-01-core.md) and expands the earlier
resource-only comparison. The helper remains version **1.5.1.1793289492**;
no additional historical helper package was acquired.

The concrete fix moves two developer comments out of injected HTML. Those
comments alone triggered the helper's Scramjet code predicate in a real proxied
document. Executable JavaScript and message keys remain identical. The broader
scan also identifies unresolved root/new-tab signals; this is not an allow
verdict for Civil or a managed-device enforcement test.

## Source and execution scope

All evidence is under ignored `extensions/filter-audit-2026-11-01/core/`.
The signed helper's raw `content.js` SHA-256 remains
`4e04766756d56c43e48b1c03837436d634e072d7650e2a728725e16fed694107`.
`helper-extract.cjs` selects exported function bindings and their lexical
dependencies from `helper-content.decoded.js`. Imports resolve through the
recovered numeric module ID and exported name; extension entry points never
execute. Unresolved string-pool calls throw instead of running the original
bootstrap. The only admitted non-import call initializer is an array `concat`.

The complete synchronous `_runProxyDetection` method is selected at decoded
source offsets **125540–134226**. Its **43 direct declaration dependencies**
include separately enclosed imported detector functions. The actual
`_collectNetworkInfo` method is selected at **136231–137263**. The retained
expressions, declaration ranges, decoded-source hash, browser version, explicit
configuration, page inputs and outputs are embedded in the replay receipts.
These offsets describe the recovered JavaScript, not native addresses.

Chrome **156.0.8078.74** ran in owned disposable profiles, using direct CDP
main-world and isolated-world contexts. No vendor extension was installed.
The collector augmentation mirrors the recovered orchestration: script URLs,
first 2,000 characters of each inline script, first 50,000 characters of body
HTML, up to 200 iframe IDs, localStorage keys and up to 500 resource entries.
The recovered `extractDomInfo` function itself executes unchanged.

This executes all proxy detector calls made by the selected synchronous
method. It does not execute the asynchronous scan/cache/report lifecycle,
game or NSFW classifiers, tenant policy, cloud requests, or later rescans.
The explicit replay configuration uses `bypassDetectLevel: "normal"` and
`detectionCategories.proxy: 15`; it is not a downloaded district policy.

## Collector reachability and isolated worlds

The helper manifest declares an all-frame, document-start content script with
no `world` override. Its reinjection call likewise supplies no world override.
Chrome documents the default as an isolated execution environment:
[content-script manifest](https://developer.chrome.com/docs/extensions/reference/manifest/content-scripts),
[isolated-world behavior](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts).
The controlled replay uses the documented
[CDP isolated-world method](https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-createIsolatedWorld).
This models realm visibility; it does not reproduce extension privileges.

`helper-world-replay.json` records three inert loopback fixtures in both worlds:

| Fixture input | Main / isolated page global | Recovered detector result |
|---|---|---|
| `window.scramjet` plus neutral resource | `object` / `undefined` | Both engine confidences 0; complete proxy method returns false. |
| Same global, `/epoxy/index.mjs` resource | `object` / `undefined` | BareMux confidence 35; complete proxy method returns true through tier 1. |
| Same global, one `scramjet-config` storage key | `object` / `undefined` | Scramjet confidence 15, below its detector threshold; complete proxy method returns false. |

The shared DOM attribute, resource URL and localStorage key are observable in
both worlds. An explicit synthetic `globals: ["scramjet"]` input still scores
40, proving that predicate exists. However, the recovered collector does not
populate `globals`. The actual pipeline also calls `scanProxyVariables({})`:
its score is zero even when a page global exists. Supplying explicit variable
types/nested paths separately activates that scanner in its positive control.
The earlier global-only predicate example is therefore not evidence that this
helper version reaches that predicate in its current collection path.

## Comment-triggered proxied-frame detection and fix

The real service worker injects `CIVIL_CHII_PREAMBLE` and
`CIVIL_EXT_DETECT_STUB` into proxied HTML. Each contained a developer comment
within its first 2,000 script characters naming the engine message envelope.
The engine predicate matches `/\$scramjet/` in those comments. Two matching
inline scripts produced **50**, exceeding its threshold of 30 and setting the
complete proxy method's tier-1 detection flag.

`misc/config/service/sw.ts` now keeps those same explanatory comments beside
the constants, outside their HTML template strings. This preserves the notes
in source and removes them from the shipped inline scripts. No message key,
statement, script order, native-API capture or extension-bus behavior changes.
The required message keys remain in executable code where used.

`preamble-token-equivalence.json` records a comment-free parse/generate
comparison of both old/new JavaScript bodies: both are identical. Their
template lengths fall from 2,615 to 2,177 and 5,880 to 5,561 characters.
The configuration bundle was rebuilt before the second browser run.

At **1366×768** and **390×844**, an actual `https://example.com/` document
loaded through Civil's **Bare** transport before and after the change:

| Proxied document | Scramjet confidence | Complete proxy method |
|---|---|---|
| Before comment relocation | 50 | `detected: true`, tier-1 Scramjet match |
| After comment relocation | 0 | `detected: false`, confidence 15 from a separate non-triggered obfuscation result |

The temporary runtime fixture's parent still scores 85 through script
fingerprinting because it deliberately contains explicit transport/controller
setup code. That parent is an analyst fixture, not a shipped Civil route.

## Remaining signals on actual Civil routes

The wider sweep uses the rendered production build, seeded user-off analytics
and ads settings, Bare transport, and the completed setup flag. Both sizes
produce the following identical synchronous proxy-method results:

| Actual document state | Confidence | Detected | Active explanation |
|---|---:|---|---|
| Browser root | 67.5 | true | Behavioral metadata 60 and basic detector 75. |
| New-tab document inside browser | 55.5 | true | Behavioral metadata 60 and basic detector 51. |
| New-tab route visited directly | 44 | true | Behavioral metadata 60 and basic detector 28. |
| Settings | 0 | false | No active detector. |
| History / bookmarks | 21.5 | false | Behavioral 30 and a non-triggered basic result 13. |

The detailed root result names the `Civil Proxy` title, proxy/unblocking
metadata, Chrome-style omnibox placeholder and browser control labels. These
are separate from the resource and injected-comment signals. The differing
new-tab scores reflect embedded and standalone rendered states; neither is
treated as a universal score for that route.

The aggregator's nominal normal threshold is 59, but two triggered tier-2
detectors can establish detection at confidence **15 or greater**. This
explains the direct new-tab result of `detected: true` with level `none` and
confidence 44. Reading the level or comparing confidence with 59 alone would
miss that branch. A tier-1 match independently establishes detection.

`PRODUCT.md` explicitly fixes the name and full-browser positioning. This pass
does not alter browser controls, branding, titles or positioning to suppress
those independent signals. The neutral aliases and comment change cannot
support a claim that the whole browser is invisible to this helper.

## Receipts and verification

- `helper-world-replay.json`: inert main/isolated-world controls and selected source.
- `helper-civil-sweep-before.json`: six page states and same-origin child frames before the fix, at both sizes.
- `helper-civil-sweep.json`: the same sweep after the fix.
- `helper-civil-details.json`: raw behavioral/basic explanations on root, new tab and the runtime fixture after the fix.
- `helper-civil-*.png`: rendered page captures. Before-run numeric results remain in their separate JSON receipt.
- `preambles-before.json` and `preamble-token-equivalence.json`: original strings and executable-code equivalence proof.

`bun run build:configs`, `bunx tsc --noEmit`, repository lint/format checks and
`git diff --check` passed. The repository lint/format scopes exclude the service
worker file; the bundle build and parsed-token comparison cover the edited
templates. The earlier 678-test suite remains the last full-suite result;
this comment-only executable-equivalent change did not add a unit test or
repeat the suite. Disposable Chrome profiles and the loopback server are
cleaned up, and the temporary fixture is removed from `dist/client`.

The managed-extension/policy test, production-host differences, full backend
and Unix Wisp validation remain outstanding. Historical and unselected-file
requirements in the root audit remain active.

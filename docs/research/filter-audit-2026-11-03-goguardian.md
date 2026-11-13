# GoGuardian policy and worker follow-up, 3 November 2026

This pass compares the authenticated **4.1.177** package with retained
**4.1.246**. The [request-interception report](filter-audit-2026-11-03-probe.md#goguardian-request-interception)
established the different request registrations but stubbed the current
dispatcher. This follow-up executes selected shipped dispatcher and URL
normalization expressions with synthetic dependencies.

The selected `background.js` files have SHA-256:

| Version | SHA-256 |
| --- | --- |
| 4.1.177 | `888c3b23b2253254d4b1dad546c433b006270eed12d6ff60d65d9f185394a0c5` |
| 4.1.246 | `dd0b4d6e5683b4417a5682d2cdb4b417c0991add1cd6a6f4346fd768da0d61f6` |

## Current dispatcher timing and rule order

In 4.1.246, the `Admin Site Filter` rule requests a **500 ms** blocking
window. It first tries cached categories. If none exist, it supplies an
asynchronous rule that retrieves categories and then applies policy.
A category-fetch failure is caught; policy evaluation continues with an
empty category list. This preserves the available policy checks, rather
than establishing an unconditional allow. The rule appears in `L` at
character offsets **1191378–1193236**.

The exact-expression replay checks four behaviors in the shared dispatcher:

1. `W` starts queued asynchronous rules concurrently. A later rule's
   redirect waits for earlier rules to finish without a redirect; an
   earlier redirect wins even when the later result arrived first.
2. A synchronous redirect immediately ends the rule scan. An earlier
   queued asynchronous rule has not started and does not supersede that
   synchronous result.
3. `V` races the filtering result against its configured timer. At 500 ms,
   the dispatcher response Promise can resolve to `undefined`. `P` still
   awaits the original filtering result through `G`; a later redirect
   result therefore still invokes the tab or frame redirect helper.
4. Before starting asynchronous rule work, `H` checks an active outermost
   main-frame document with a document ID. If frame lookup finds that
   document still active but its URL differs from the request URL, the
   dispatcher resolves without running those asynchronous rules.

The relevant zero-based character ranges, with exclusive ends, are
`P` **1193726–1194380**, `W` **1194776–1196032**,
`V` **1196045–1196340**, `G` **1196341–1196614**, and
`H` **1196615–1196830**. The replay stubs timers, rule decisions,
frame lookup and redirect helpers. These checks describe the JavaScript
dispatcher. They do not establish how a managed browser handles the
Promise returned by its blocking request listener, the actual time a
request is held, or an installed-device policy verdict.

## SafeTranslate destination normalization

With `safeTranslateEnabled`, both versions unwrap the `u` parameter on
`translate.google.com` before evaluating destination policy. The selected
4.1.177 filter thunk at **53420–55920** only handles that hostname.
The 4.1.246 normalizer `$` at **1187699–1188961** additionally handles
hostnames ending in `.translate.goog`.

For the synthetic input
`https://www-example-com.translate.goog/a?q=term&_x_tr_sl=auto&_x_tr_tl=en#part`,
the exact 4.1.177 thunk passes that wrapper URL to its policy evaluator.
The exact 4.1.246 normalizer supplies
`https://www.example.com/a?q=term#part`. The current code reconstructs
the destination hostname, retains its path, ordinary query parameters and
fragment, and removes `_x_tr_*` control parameters. A replay with the
setting disabled leaves the wrapper URL unchanged. This demonstrates a
destination-policy input change, without querying a category service or
asserting that the destination is blocked.

## Reproduction and scope

Run `node extensions/filter-audit-2026-11-03/goguardian-policy/replay.cjs`.
All six checks passed. The ignored sibling `replay.json` preserves the
source hashes, exact extracted expressions, character ranges and results.
The category service, managed policy, redirect implementation and Chrome
request dispatch remain outside this replay. No vendor network was used.

## Graphics paths and the offline startup failure

Both workers allocate an `OffscreenCanvas` while initializing their
screenshot module. The current image predictor also allocates a
224-by-224 canvas at construction. Civil's headless host lacks this API,
so the worker startup failure does not establish a policy decision.

Sixteen exact-code checks compare the screenshot converter and unloaded
image predictor. Both converters reduce the longest dimension to the
supplied maximum, preserve the aspect ratio and return a scale factor.
Both output JPEG at quality 0.8. The 4.1.246 converter also accepts a
flag selecting WebP. Malformed data URLs reject before drawing. Both
close the decoded bitmap after successful conversion. If conversion
rejects, neither selected function closes the bitmap in its error path.
The 4.1.246 predictor returns before decoding when its model is absent,
while 4.1.177 still decodes and processes the synthetic input before
returning no prediction.

These checks supply bitmap dimensions, drawing operations and conversion
results through mocks. They establish control flow and requested output
parameters. They do not validate pixels, model output, screenshot upload,
or student data collection. Run
`node extensions/filter-audit-2026-11-03/goguardian-graphics-replay.cjs`.
Its receipt records the worker hashes and exact source ranges. REA parsed
the four extracted expressions as inert JavaScript, retaining partial
static evidence
`ev_0970b53737d99e41ca8eecc54f225e7ad5c550a750def36c3f21be10d2deb70c`
in `goguardian-graphics-rea-evidence.json`.

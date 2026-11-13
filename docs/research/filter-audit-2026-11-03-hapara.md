# Hāpara Highlights Focus redirect tracking, 3 November 2026

The [Focus link comparison](filter-audit-2026-11-02-provenance.md#hāpara-focus-links) checked the URL comparator used for already-known links. This pass follows a separate path that learns destinations when a known link redirects, including the Forms short-link fallback. It uses synthetic URLs and a supplied Focus state.

| Version | Package basis | Shipped background | Redirect helper and map lookup |
|---|---|---|---|
| 5.0.62 | Signed exact-ID CRX3 | `background-971c4f4307330b739aed.js` and the additional shipped `background-dd9356e966e4afade7ff.js` | `z`, `x` |
| 6.2.7 | Signed exact-ID CRX3, CDN last modified 8 April 2025 | `background-f6f8c1f2f4f5d82fb934.js` | `$`, `x` |
| 6.9.0 | Local extracted cache | `background-1557afd5ab98bbb7d584.js` | `ne`, `R` |
| 6.10.2 | Signed exact-ID CRX from the vendor update response | `background-aa54b1fd11fbcf0264d3.js` | `ae`, `W` |

All listed files are under `webpack/`. The 5.0.62 manifest selects `background-971c4f4307330b739aed.js`. The replay also checks the second bundle as shipped code. SHA-256 for the 5.0.62 CRX is `2783affe2feb20a1b073804ba88e2b6b0c156ed04d47916d8ed7c8794c6f2197`. The 6.2.7 CRX hashes to `95db30d2396609da57ac5eb9ab61426191accebef2bd7aa1c2fffb4700027635` and its worker hashes to `9b539191502e867d9624c86206490b476750478dcf23549c44ef124f210ec3d1`. The retained CDN response dates the package bytes through `Last-Modified`. The 6.10.2 CRX hashes to `3852dfeb4d1de3a175123644fc62e8e2b9897cd785a924a4d592c6985ec55ef0`. The 6.9.0 cache supplies code for comparison. A signed CRX and release date for that build remain unverified. [Earlier package provenance](filter-audit-2026-10-30-core.md)

## Request and state path

Each background registers two WebRequest listeners. `onBeforeRedirect` passes the source and target URL to the redirect helper for main-frame requests associated with a tab. `onBeforeRequest` checks for active Focus state, a main-frame request and a valid tab ID. All five bundles recognize the same three special initiator and destination combinations.

- `https://forms.gle` initiates navigation to a URL with the Firebase bridge prefix `https://firebasehostingproxy.page.link`.
- `https://forms.gle` initiates navigation to a URL with the prefix `https://docs.google.com/forms/`.
- `https://docs.google.com` initiates navigation to a URL with the prefix `https://www.google.com/url`.

The special handler gets the source from the extension's tracked tab URL and passes it to the helper alongside the requested destination. In both 5.0.62 bundles the handler reads `get("url")` from the first matching tab without checking whether the lookup succeeded. By 6.2.7 the worker logs a warning and returns if the tracked tab is missing. All three 6.x workers also route a generic request through this helper when their destination whitelist and initiator admission predicates both pass. These predicates are `H` and `W` in 6.2.7, `B` and `G` in 6.9.0, and `J` and `Q` in 6.10.2.

The helper checks active session and source admission again. It resolves an existing key for the source using the shipped URL comparator. When that key exists, it merges the source's original allowed-link entries into the destination's map entry. The destination may reuse an equivalent existing key. A source admitted elsewhere in policy without a map entry produces no alias. The helper still calls the state-save function in that case. The Focus admission path can later consult the map through `x` in 5.0.62 and 6.2.7, `R` in 6.9.0 and `W` in 6.10.2.

## Replay

All **65 cases** passed across five backgrounds. The replay extracts the two listeners, the redirect helper, the map lookup and the comparator verbatim. It supplies stubbed session admission, whitelist results, tracked tabs, storage callback and Chrome registration APIs. Results cover each special request path, an unrelated initiator, inactive Focus, a subframe, a missing tracked tab, a rejected or unkeyed source, and the 6.x workers' generic branch. A synthetic two-hop chain carried the original allowed link into the final Forms entry. An alternate Forms account/action URL reused its existing key.

The map can distinguish a recognized redirect chain from a direct request to the same destination. A probe that supplies only the final URL cannot recover that state. The replay does not establish whether Chrome registers the selected listeners under a particular managed policy, whether actual Google redirects supply these event fields, or whether the browser permits the resulting navigation.

The script and receipt are under the ignored `extensions/filter-audit-2026-11-03/hapara/` directory. Run `node extensions/filter-audit-2026-11-03/hapara/replay.cjs`. The receipt records hashes, source offsets and case results. The script reads the 6.9.0 cache from `%USERPROFILE%/extensions/haparahighlights`.

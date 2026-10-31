# Filter extension audit: core vendor group

Audit date: 2026-10-30. This is a bounded static investigation, not a claim
that Civil is undetectable or that every important vendor file has been
fully understood. No vendor classification/report submission was made.

## Artifact coverage and provenance

The ignored local artifact root is
`extensions/filter-audit-2026-10-30/`. Each extension directory contains
`acquisition.json` (current update request, returned codebase, package SHA-256,
file hashes) and `important-files.json` (manifest-declared entry/content files,
selected support files, sizes and SHA-256 for every acquired version).
Cached packages came from the pre-existing `~/extensions` tree. Distinct copies
of the same release do not count as multiple versions. The later shared
`crx-integrity.json` receipt verifies covered CRX signatures, extension IDs and
unpacked-file equality, and rejects a tampered-archive control. Earlier
`signatureVerified: false` acquisition flags predate that separate verification.
This proves the recorded signature/identity relationship, not enterprise policy
or a first-release date. GitHub source copies have separate provenance checks.

| Extension | Acquired releases | Historical date evidence | Remaining acquisition gap |
| --- | --- | --- | --- |
| GoGuardian, `haldlgldplgnggkjaafhelgiaglafanh` | GitHub 3.0.6444.2 and 3.0.6445.1; official 4.0.7386.1 and 4.0.7393.1; cached 4.0.7422.1; current 4.1.246 | Vendor update-manifest captures on 2025-07-05 and 2025-08-09 date the two official historical packages. GitHub 3.0 snapshots date to 2023. | No authenticated first-release dates; the July 2025 package meets the approximately 1–2 year target. |
| Securly Filter, `ckecmkbnoanpgplccmnoikfmpcdladkc` | Official 3.0.0, 3.0.60, current 3.0.76 | 3.0.0 ZIP members are dated 2024-12-12; first-release date unknown. Cached 3.0.60 exactly matches the later official archive. | Independent publication-date corroboration of 3.0.0 remains incomplete. Related 2.98.43 GitHub source is a legacy-ID copy and is kept separate. |
| Securly Classroom, `hkobaiihndnbfhbkmjjfbdimfbdcppdh` | Official 1.32.0 and 1.36.1; cached 1.37.3; current 2.0.5 | All 40 official 1.32.0 archive files exactly match a GitHub subtree whose manifest was committed 2025-03-04. | First-release date and authenticity of the cached-only 1.37.3 copy remain separate questions. |
| Lightspeed Filter Agent, `ehnniokiiebpinnfegpkdlcamgdcaaje` | GitHub 4.1.1.1753957462 with matching manifest-key ID; cached 4.4.6.1785883975; official current 4.4.10.1792039522. Additional unkeyed source copies: 4.0.1, 4.3.0, 4.4.9. | The 4.1.1 manifest was committed 2025-08-25. Numeric version suffixes are not treated as independent dates. | Historical mirror lacks CRX/signature metadata; the matching manifest key associates identity but does not authenticate every byte. |
| Lightspeed Insight Agent, `njdniclgegijdcdliklgieicanpmcngj` | GitHub 3.7.6, GitHub 3.8.4, official current 3.11.0 | 3.7.6 code was committed 2025-02-23; 3.8.4 was committed 2026-04-08. Publisher-signed metadata authenticates matching code/WASM in both copies. | Mirrors contain specified manifest/icon/config changes; those changed bytes are excluded from authentic-source claims. |
| Hāpara Highlights, `aceopacgaepdcelohobicpffbbejnfac` | 5.0.62, cached 6.9.0, current 6.10.2 | Vendor support article updated 2025-10-21 refers to versions higher than 5.0.62. That establishes a historical version boundary, not the exact package publication date. | Exact 2024–2025 package timestamp not independently verified. |

GoGuardian historical packages were downloaded from the exact URLs returned by
the archived vendor manifests, not reconstructed version guesses:

- [July 2025 update manifest](https://web.archive.org/web/20250705160835id_/https://ext.goguardian.com/stable.xml), [4.0.7386.1 package](https://crx.goguardian.com/extension-m-4.0.7386.1-stable-crx2.crx). CRX SHA-256: `f60524f5f8832d0c9b2697b89c22fb505dfa49b0a51f6367e65b8794d9875889`.
- [August 2025 update manifest](https://web.archive.org/web/20250809053331id_/https://ext.goguardian.com/stable.xml), [4.0.7393.1 package](https://crx.goguardian.com/extension-m-4.0.7393.1-stable-crx2.crx). CRX SHA-256: `46f31d44ac3852afb1329bcf3d3f67a498d16f961f161bb00c77223054f2222b`.

The public keys in both CRX2 headers derive the exact requested GoGuardian ID.
The later shared CRX receipt also verifies both RSA-SHA1 archive signatures and
every extracted archive file. Its scope supersedes the initial key-only check.

The historical Hāpara package uses the same vendor CDN filename convention as
the current update response: [5.0.62 package](https://cdn.hapara.com/extensions/extension-prod/highlights-5.0.62.crx).
Its manifest says 5.0.62; package SHA-256 is
`2783affe2feb20a1b073804ba88e2b6b0c156ed04d47916d8ed7c8794c6f2197`.
The [vendor's chat FAQ](https://support.hapara.com/hc/en-us/articles/32664778499469-Highlights-Chat-Teacher-FAQ)
supplies the version boundary. The package is MV2; current 6.10.2 is MV3.

Securly 3.0.0 was retained at the vendor's public per-version package path:
[3.0.0 package](https://crextnaut.securly.com/apps/ckecmkbnoanpgplccmnoikfmpcdladkc/versions/3.0.0/extension.crx).
Its manifest confirms version 3.0.0 and MV3. CRX SHA-256:
`683177c41dc52fddd8bfd7951f05d75c68a721ab6841ac2f65ace22e9981b9ef`.
ZIP central-directory metadata dates all 26 Securly 3.0.0 members to
2024-12-12. The 446 Hāpara 5.0.62 members carry 2024-08-01. These are observed
package timestamps, not independently authenticated first-release dates.
The server returned no Last-Modified release-date evidence. Two published
2.98-era version numbers were not retained at this ID's package paths
(HTTP 404); Classroom 1.30.0 and 1.20.0 explicit version checks also returned
404. These checks were bounded rather than enumerating arbitrary releases.

The [Chrome-Stats Insight archive](https://chrome-stats.com/d/njdniclgegijdcdliklgieicanpmcngj/download)
lists 3.8.1 (2025-05-13) and 3.7.6 (2024-10-02), but labels both as paid-user
downloads. The public page lists only the latest three releases as free.
Those dated historical archives were not acquired; no access restriction was
bypassed. The later GitHub pass independently acquired 3.7.6 and 3.8.4 without
using that archive's restricted downloads. Its listed dates remain archive
metadata rather than vendor release attestations.

### Bounded historical searches

Saved `historical-cdx.json` and `historical-artifact-cdx.json` files record
Wayback searches for 2024–2025 update/package URLs. Exact current Securly
tenant update URLs, Securly per-ID versioned package paths, Hāpara fallback
and wildcard update/CDN paths, and the Insight extension-ID query returned
no matching snapshots within the selected date/status boundaries. That is
not proof that no historical package exists elsewhere. A direct public
Crx4Chrome lookup for the Hāpara ID returned HTTP 404.

One archived Lightspeed manifest dated 2025-09-27 names
`3.9.10.1753400683`, but its app ID is
`adkcpkpghahmbopkjchobieckeoaoeem`, different from the catalog's Filter Agent
ID. It is retained as historical research, and is not counted as a matching
release of the requested extension.

## Important files and observed detection paths

| Extension | Important file roles and examined paths | Findings and limits |
| --- | --- | --- |
| GoGuardian 4.0 family | `manifest.json` declares `background.html`/`background.js` and content scripts. `miner.js` extracts page content and reports changes through a runtime port. `admin.js`, `redirect.js`, `teacher.js`, privacy/explicit-image scripts and block-page assets support filtering and classroom features. | The background's proxy matcher reads remote `smartFilteringSettings.proxies.URLMatchers`: regex matches and/or required query-parameter names, with configured hostname exclusions. The filtering module consults custom policy before redirecting to a proxy block page. A separate metadata path attaches `isProxy` to reported entities. The matcher is present in both acquired 2025 backgrounds and cached 4.0.7422.1. Remote rule values were not acquired. Ancillary bundles were inventoried, not exhaustively reverse engineered. |
| GoGuardian 4.1.246 | `background.js` is the MV3 worker. `goguardian-1.js` is the all-frame content extractor; it reads visible text and tag properties, including non-visible `meta.content` and `script.src`. Other numbered scripts handle redirects, flagged terms, classroom UI, YouTube and related functions. | Content changes trigger a throttled runtime-port notification. The worker collects content from active frame documents, serializes `fullText` and DOM features, then calls `SmartAlertsPredict`. Predictions include separate proxy and game categories; sufficient confidence can create a report and redirect using an X3 report block reason. This is a major change from the old URL-rule module, not a filename-only rebuild. The remote classifier was not inspected or queried with Civil content. |
| Securly Filter | `securly.min.js` is the worker; `content11.min.js` is the all-frame proxy fingerprint detector. `conf.min.js`, `schema.json`, search/YouTube/AI content scripts, dynamically used image/content scripts and block assets affect policy, content analysis and UI. | In all three acquired releases, `content11` consumes remote DOM selectors/text/property rules, scans repeatedly after load, and sends a `proxyIdentified` port message on a match. The 3.0.0 worker reports domain/family/rules; later code adds encoded URL/category fields. Current code supports both legacy `/proxy` and Go-broker `/broker/extension/proxy` endpoint mappings. Other content scripts were inventoried and selectively searched; they were not all behaviorally validated. |
| Securly Classroom | `manifest.json`, `cs.js` and `background.js` establish the relevant path. Cached `.tmp` files contain readable helper copies but are not assumed to be authenticated shipped source. | `cs.js` reports an iframe-bearing page as suspicious. The background action closes the tab only when its top-level URL begins with `about:` and the opener does not match an ignored URL. This condition remains in 2.0.5. Merely seeing an iframe in an ordinary HTTP(S) Civil tab does not establish a proxy classification. Teacher-driven locking, screenshot and navigation controls remain a separate mechanism. |
| Lightspeed Filter Agent | `worker.js` is the worker, `content.js` the all-frame content bridge, `in_page.js` the readable page-side interaction/filtering bridge, `main.js` the large runtime bundle, and `filter.wasm` the compiled filtering engine. | The cached worker contains a proxy-detection report aggregation path (`proxy_detections`, `ResolveWithDetectReport`) and detected/score/reason/tab fields. `in_page.js` handles YouTube/video and image scanning and block presentation; this does not by itself establish a proxy fingerprint heuristic. The obfuscated worker and compiled engine have not been fully recovered; their detection coverage remains unresolved. |
| Lightspeed Insight Agent | `background.js` is a readable startup/collection worker; `js/user-interaction.js` reports interaction events and current URL through a runtime port. `js/filter-link.js` queries the separately installed Filter Agent. `js/speed_test.js`, Go `wasm_exec.js` and `client.wasm` implement a network speed test. | The content script reports click, keyup, touch and debounced scrolling activity. The worker queries Filter Agent action `scoreUrl`, then suppresses telemetry for a URL only when that agent reports it blocked. Missing agent, malformed reply, timeout or error preserves activity reporting. The WASM is a speed-test implementation rather than evidence of a separate proxy classifier; see the static pass below. |
| Hāpara Highlights | Versioned `webpack/background-*.js` workers/background pages, webpack chunks, extension policy/configuration and the blocked/frozen/closed/new-tab resources are important. Entry names are recorded per version in `important-files.json`. | Cached 6.9.0 and current 6.10.2 code retrieve configured blocked iframe URL prefixes, enumerate iframe `src` attributes through `chrome.scripting.executeScript`, and block a containing tab when any configured prefix matches. Configuration is gated by the `PS-3182-Iframe-blocking` feature flag and comes from `/admin/config/init`. The default prefix is a Google Sites resource path. The two feature/configuration strings are absent from the selected 5.0.62 background; other chunks were not fully compared. This is evidence of configured iframe blocking, not a generic inference that every iframe is a proxy. |

### Current GoGuardian reporting boundary

In 4.1.246 `background.js`, the relevant static source offsets are approximately:

- 56–64 KB: allowed-site checks, prediction request assembly, confidence gates,
  report creation and block redirect.
- 1,143,000 bytes: generated API route for report creation,
  `POST /v1/admin/smart-alerts/reports`.
- 1,147,000 bytes: requester maps `SmartAlertsPredict` to the GoX3Predictor
  service and permits any session type for prediction.
- 1,239,000 bytes: frame-port content collection and content-change handling.

These are source offsets, not runtime traces or stable locations across releases.
Current worker SHA-256:
`dd0b4d6e5683b4417a5682d2cdb4b417c0991add1cd6a6f4346fd768da0d61f6`.

## Public Securly fingerprint configuration

A read-only GET of [the shipped public configuration](https://cdn1.securly.com/config.json)
was retained as `securly/public-config.json`. SHA-256:
`d80ee9d3d5dd2d33d822cfb980b5a6a3337175f4961017362241f5542cf3d62e`.
It contained 106 proxy-family rules with the feature enabled. None explicitly
named Civil in that snapshot. This bounded string check does not establish
that no selector can match Civil.

Two families also use engine-path selectors (`/baremux/` and `/libcurl/`), but
each requires additional family-specific branding/markup conditions. A
separate active rule recognizes a YouTube DOM on a different origin through
three YouTube custom-element names. Proxied site DOM therefore remains a
classification surface independent of Civil's main script filenames.

The 3.0.60 detector hash is
`9cb6593f1bb84977c8e5542b4ee9f139e216fd85b3af4e65ef8eacfdbabf8380`;
3.0.76 is
`abe0948a6b561d5ef0ec4a439059956fad708c1856945d1ba6a9fe3a094120ad`.
The latter changes transpiler scaffolding and removes a stray global
assignment; the observed selector/reporting design remains the same.
In 3.0.0, the detector instead excludes any origin string containing
`securly.com`; current versions restrict the exclusion to the actual hostname
or a subdomain. The older detector SHA-256 is
`6620c4c479593c0418636d504afd4273426537ae408fb9398c3d275d183a8f9c`.

## Civil implications

Serving necessary engine scripts through the neutral aliases being added by
the root audit removes literal engine names from `script.src`, a feature
current GoGuardian explicitly collects. It also addresses the separately
traced iboss engine-name scanner. That is a concrete reduction of a known
signal; no live classifier verdict was obtained.

Civil's service worker and Hono middleware cannot intercept requests made by
an installed extension's background worker. Blocking vendor URLs inside
proxied traffic therefore cannot prevent these independent reports. Page
JavaScript also cannot redefine DOM APIs in an extension's isolated world.
Remote classifier updates, visible content, proxied third-party DOM,
reputation databases, network filtering and teacher-controlled actions remain
outside the protection established by these changes.

No core-vendor checker/middleware was changed in this group: no source-backed
check justified modifying the existing in-flight verdict refactor. The
confirmed update-XML single-quote parsing defect was handed to the root
agent for a shared downloader fix and regression test.

## REA evidence ledger

REA analyzed inert files without executing the extension packages. Selected
source paths leave other files explicit unknowns; retained semantic node and
unknown ceilings also mean partial graph coverage. IDs are same-session
references and require an exported evidence bundle for portable reuse.

| Package / scope | Parent evidence | Coverage |
| --- | --- | --- |
| Securly cached 3.0.60, selected worker/config/content files | `ev_a660d84153772bc4455dd15c4cc35c9249d2736caf0e93e3d2f42c59128aeebe` | Partial: 30-second worker timeout while processing `content5.min.js`; three JS files parsed, three skipped. Direct source inspection supplies the stated `content11` and worker traces. |
| Securly current 3.0.76, manifest and `content11.min.js` | `ev_6e8c70008b00adec3f1816cb93f87fa0fa30181d09435a4a3d6294615fee50bb` | Selected detector parsed; 22 other inventoried relevant files excluded. |
| Securly Classroom cached 1.37.3, manifest/background/`cs.js` | `ev_d7a2396294478533c521dbd52536ac03385dd679ce7d004208db259b6ed4e30f` | Two JS files parsed; remaining files excluded and semantic retention capped. |
| GoGuardian historical 4.0.7386.1, selected content files | `ev_3e408ff22bfae16f30c4806c5da21a438e5965b0a14cff82772c6aa7dbef567e` | Partial: 60-second timeout. No claim of complete application-graph comparison. |
| GoGuardian current 4.1.246, manifest and content extractor | `ev_5d42713526d0f45296920724a1f1555e7771f2eebadcb0877c2fadb0a18ba9ce` | Partial: 60-second timeout. Direct inert source inspection supplies the collector/request trace. |
| Securly 3.0.0, manifest and detector | `ev_4551569244fa63f4f57bedbbbcc5490a94b3c10335cd72cb04e70d881720634d` | Selected detector parsed; other relevant files excluded. |
| Securly 3.0.0 versus 3.0.76 selected-application comparison | `ev_b8af6ceb2cf9be4ac2d0418a6ce7d444a5f61841215502546dff5cfc475afc4a` | Partial: 13 semantic-key changed candidates, 50 unknown entities. No complete application equivalence or complete change list established. |
| Securly Classroom current 2.0.5, manifest/background/`cs.js` | `ev_8817252c20ec10298c57a121004c6cb32079d965f76c8d1cf1310904554e4f6c` | Two JS files parsed; unselected files and retention ceilings remain explicit. |
| Lightspeed Filter current 4.4.10.1792039522, manifest and page bridge | `ev_b05fa395612e07ba68bb74919ac7d966c89f7f5545afd9f3772037a0426f8124` | `in_page.js` parsed; worker/runtime/WASM excluded from this graph. |
| Lightspeed Insight 3.11.0, manifest/background/interaction script | `ev_b34489d4d0ddb8255f07d28e9da09181344ae3d9cddbeffb47af19f6dddb61f8` | Two JS files parsed; the remaining imported modules were not part of that graph. Later direct source/WASM inspection resolves the speed-test role. |
| Hāpara 5.0.62 manifest inventory | `ev_eee5928c910b45d51090acec81c6c61918c3117aeda561f0fe7e261d3111634a` | Metadata-only selection, not a recovered background graph. |
| Hāpara current 6.10.2, manifest and background | `ev_dc8c906054d8b8587e665821a4e5d84b9f113878f9c86bc8e693cfb97c0a3319` | Partial: 60-second worker timeout. Direct source inspection supports the stated iframe configuration path. |

Portable REA session evidence was exported to
`goguardian/core-rea-evidence.json` (29,280,782 bytes, 21 records). This preserves
the retained observations and their limitations beyond the live tool session.

Important remaining work includes independent publication-date corroboration
for the timestamped Securly package, stronger authentication of historical
Lightspeed Filter mirrors, deeper compiled support-engine recovery, complete
Hāpara chunk/policy comparison and controlled runtime validation with authentic
policy inputs.

## Follow-up: bounded WebAssembly static pass

The existing WABT **1.0.41** CLI was used as an explicit fallback. REA's WASM
provider requires configured WABT 1.0.42; neither tools nor server configuration
were installed or changed. Both current modules validated successfully.
`wasm-objdump -x` and `wasm2wat` decoded their full structure/text; no WASM
module was instantiated or executed. Decoded WAT is not original Go source.

Each vendor's `wasm-static/evidence.json` records exact input/tool/output
SHA-256, arguments, exit codes, elapsed time and the no-execution boundary.
The small inspector script lives in the ignored Filter Agent artifact folder.

| Binary | Validated static structure | Retained decoded output |
| --- | --- | --- |
| Filter Agent 4.4.10.1792039522 `filter.wasm`, SHA-256 `0b45f4e211ef5096e43249ea57a6b04c208be3b66cd21d7386a1bd5ecf3a523d` | 21 imported Go/JavaScript runtime functions, 3,207 defined functions, one memory. Only public function exports are `run`, `resume`, `getsp`, plus memory `mem`. Producer metadata names Go 1.23.5. Application function names are stripped/obfuscated. | `details.txt`: 11,840,675 bytes. `module.wat`: 179,112,406 bytes, SHA-256 `efdd96a12f1b0f7d71c7e1bdb4c5e2cbd7156741a42d3604798b129f65fa4853`. |
| Insight Agent 3.11.0 `client.wasm`, SHA-256 `78b1150e2d950d7640f90d862971c94ca20afd1bf7de6c29c9a067442b95b0f3` | 22 imported Go/JavaScript runtime functions, 6,215 defined functions, one memory. Same four Go runtime/memory exports. Retained names and build strings identify Go 1.26.0 and `github.com/Lightspeed-Systems/insight-speedtest`, version string `v1.0.7+dirty`. | `details.txt`: 25,545,854 bytes. `module.wat`: 331,663,431 bytes, SHA-256 `ee56463372fad3802b3379bbade9826e1b5eff327ad39cdbe85dc2507a4d911d`. |

The tool executable digests are:

- `wasm-objdump.exe`: `86cf62241354756ef3a29f8b70674cfe38a0cacdaee3da37a226e2e25de4a229`.
- `wasm2wat.exe`: `d9390afcdba5ab3721c0ea4593f84e445066d97a5e8689f387e7901d675d319c`.
- `wasm-validate.exe`: `29d930c7050e26148ce5d9df31cd4783f4c81722ed4d1e41e93a31bd406ef57d`.

### Insight: glue establishes a speed-test role

`js/speed_test.js` loads `client.wasm` with Go's `importObject`, invokes
`go.run`, then calls the JavaScript-visible `runSpeedtest` bridge. Its callback
parses a result and requires a transaction identifier. The worker calls that
wrapper with server/chunk/payload/adaptive-limit parameters from its configured
speed/location check.

The binary independently retains `main.main`, `main.wrapSpeedtest`,
`main.marshalResult` and `SpeedClient.RunSpeedTest` names. In the decoded WAT,
these are near lines 3,272,358–3,274,347; numeric function indices are 6229–6235
for the main wrappers and 6225 for `RunSpeedTest`. Numerous `Proxy` names belong
to Go's standard HTTP/environment-proxy support. Their presence alone does not
show school-proxy classification.

The actual filtering interaction is readable `js/filter-link.js`: external
messaging to extension ID `ehnniokiiebpinnfegpkdlcamgdcaaje`, action `scoreUrl`,
a three-second response timeout and a five-minute in-memory result cache.
`background.js` starts tracking a tab and discards its activity if the Filter
Agent subsequently reports that URL blocked. This is telemetry suppression
for already-blocked traffic, not a new classifier discovered in the WASM.

### Filter Agent: runtime bridge recovered, decision semantics incomplete

The worker's Go startup path instantiates its packaged WASM with a `Go`
`importObject`, then runs the instance. Imported `syscall/js` property/call
bridges explain why filtering methods need not appear as native WASM exports.
`LSFilter` occurs in the binary's data; the worker also contains calls such as
`ResolveWithDetectReport` and report/category handling. However, stripped or
obfuscated internal names and encoded strings prevent this pass from mapping
every category/proxy method to a fully interpreted WASM body. No claim about
the complete classifier, cryptography, signatures or policy enforcement is
made from those strings.

Correction to the opening pass: the Insight worker is readable JavaScript.
The earlier report's description of it as obfuscated was an inspection error,
not an observed property of the downloaded package.

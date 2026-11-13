# Historical recovery and LanSchool PNaCl, 1 November 2026

Status: partial. This extends the [continuation audit](filter-audit-2026-11-01.md). Eight signed historical/intermediate packages are available again, and the previously undecoded LanSchool Student payload now has complete retained disassembly. Selected native policy-message paths were traced; complete native semantics and managed-device enforcement remain unverified.

## Historical packages recovered

The acquisition uses previously documented public package URLs and concrete successful entries in the retained `version-probes.json`. It does not enumerate guessed version ranges or use authenticated archive services. `restore-core-history.cjs` checks the CRX publisher proof, derived extension ID, and exact manifest version before extraction. Every extracted path stays within its selected package directory, and the receipt records every file's SHA-256.

| Requested extension | Recovered version | Signature | Package SHA-256 |
|---|---|---|---|
| GoGuardian | 4.0.7386.1 | CRX2, valid requested-ID proof | `f60524f5f8832d0c9b2697b89c22fb505dfa49b0a51f6367e65b8794d9875889` |
| GoGuardian | 4.0.7393.1 | CRX2, valid requested-ID proof | `46f31d44ac3852afb1329bcf3d3f67a498d16f961f161bb00c77223054f2222b` |
| Hāpara Highlights | 5.0.62 | CRX3, valid requested-ID proof | `2783affe2feb20a1b073804ba88e2b6b0c156ed04d47916d8ed7c8794c6f2197` |
| Securly | 3.0.0 | CRX3, valid requested-ID proof | `683177c41dc52fddd8bfd7951f05d75c68a721ab6841ac2f65ace22e9981b9ef` |
| Securly | 3.0.46 | CRX3, valid requested-ID proof | `ae32c6110993e60b80832919f7ee539c092c2ae60cec7e473f4beea47c463809` |
| Securly | 3.0.65 | CRX3, valid requested-ID proof | `bba480b2737c9dcf846c15b017ada677fa313d29eebf37e6378c4bc8c4412aac` |
| Securly Classroom | 1.32.0 | CRX3, valid requested-ID proof | `6114f7e639289ae8721a01cdb69a09fe40a1a5613f969b18727de6cbb1363acb` |
| Securly Classroom | 1.36.1 | CRX3, valid requested-ID proof | `a75e79a7f479acabb43ab696a58b56303857a0d45f33ac35b6fe0767e8443294` |

Both GoGuardian archives, Hāpara 5.0.62 and Securly 3.0.0 exactly match the earlier report's recorded package hashes. The two GoGuardian versions retain the dated [July 2025](https://web.archive.org/web/20250705160835id_/https://ext.goguardian.com/stable.xml) and [August 2025](https://web.archive.org/web/20250809053331id_/https://ext.goguardian.com/stable.xml) vendor-manifest references from that investigation. Those references were not reacquired in this pass. The matching package hashes establish artifact continuity; they do not independently attest a first-release date.

The updated physical inventory is **51 distinct manifest versions across the 28 requested IDs**, plus the separately counted Lightspeed helper. The older 43-version figure describes the continuation's initial inventory. Remaining cached or mirror provenance limits still apply; this is not a count of 51 fully authenticated and fully analyzed releases.

Artifacts and per-version receipts are in the ignored `extensions/filter-audit-2026-11-01/<folder>/historical-*` paths. `restored-core-history.json` summarizes this pass, and `coverage.json` records the current version matrix.

## Securly: five-version fingerprint replay

The important `content11.min.js` path was compared across recovered 3.0.0, 3.0.46 and 3.0.65, cached 3.0.60, and current 3.0.76:

| Versions | Script SHA-256 | Observed reporting mechanism |
|---|---|---|
| 3.0.0 | `6620c4c479593c0418636d504afd4273426537ae408fb9398c3d275d183a8f9c` | Reports a match through `chrome.runtime.sendMessage` with `type: "proxyIdentified"`. |
| 3.0.46 and 3.0.60 | `9cb6593f1bb84977c8e5542b4ee9f139e216fd85b3af4e65ef8eacfdbabf8380` | Reports through the `proxyDetection` port, including `actionType`. |
| 3.0.65 and 3.0.76 | `abe0948a6b561d5ef0ec4a439059956fad708c1856945d1ba6a9fe3a094120ad` | Same port mechanism in the acquired script; contains the later generated async helper. |

The identical hashes establish byte equality for those pairs, not equivalence of their different background workers. All five scripts consume remotely supplied family/fingerprint selector rules behind a feature flag. The older 3.0.0 origin exclusion uses an `origin.includes("securly.com")` check; later acquired scripts check the hostname's exact vendor domain or subdomain boundary.

`securly/fingerprint-replay.cjs` executes each exact shipped script with mocked Chrome messaging and manually invoked interval callbacks. An **analyst-supplied**, enabled selector matching `script[src*="/epoxy/"]` reports the legacy resource URL in every version. The same selector does not match the neutral `/_runtime/socket/index.mjs` URL. Disabling the feature flag produces no report. All **15 assertions pass**.

The selector is a controlled test policy, not an observed Securly default or district rule. This replay verifies the reporting paths and the specific selector behavior; it does not establish that a real district config uses that selector or that its background/cloud would permit Civil. No additional production workaround follows from this comparison.

## PNaCl tool acquisition and decoding

LanSchool Student 8.0.2.15's `student.pexe` is **2,104,828 bytes**, SHA-256 `6794203ca95da677bc5b5ca50a543ca710f6236d41f3a2dd2d670836feb264f3`. It matches the current signed package and the earlier native report.

Google's old SDK manifest returned HTTP 403 `AccessDenied`. A separate public [Chromium toolchain record](https://chromium.googlesource.com/native_client/src/native_client/+/HEAD/toolchain_revisions/pnacl_newlib.json) supplies exact platform archives. Its Windows LLVM entry names [this archive](https://storage.googleapis.com/nativeclient-once/object/llvm_i686_w64_mingw32_9ae548f00262a846e72518ff202aa0f0c79ea37c.tgz), whose downloaded SHA-1 matches the published `d97ad46ed731bb19766d591a8530b66d03e4b1f0`. The local receipt also records SHA-256 values for the manifest, archive, binaries and decoded outputs.

Only the necessary analysis executables and their bundled DLLs were extracted into the ignored `pnacl-tools/windows/` directory. The archive's DLL hardlink was materialized as a byte-identical copy. No global installation, PATH change, REA configuration change, native Student execution or Chrome extension installation occurred. The legacy DLL fails inside the command sandbox with `Illegal System DLL Relocation`; the verified analysis tools were run outside that sandbox.

The tools identify themselves as LLVM **3.7.0svn**, built **13 December 2022**, target `i686-pc-windows-gnu`. Both static decoders exit 0 with empty diagnostic files:

```text
pnacl-bcdis.exe -no-records -o=student.pnacl.ll student.pexe
llvm-dis.exe -bitcode-format=pnacl -o=student.llvm.ll student.pexe
```

| Retained output | Bytes | SHA-256 |
|---|---:|---|
| PNaCl assembly `student.pnacl.ll` | 19,326,801 | `725b013ee5900237b96837ab3c23311b3a4c4d656e0f40590d25f75e464322d9` |
| LLVM IR `student.llvm.ll` | 22,694,125 | `41ac9a12f46ffff25dd2820f71b27d44199e99f7d627dee325a0c50a18d4fabf` |

The generated LLVM text contains **7,768 numeric globals and 3,327 function definitions**. The numeric identifiers below are local to this decoded build, not original C++ names or native addresses. Decoding the entire file is not equivalent to understanding every function.

## Selected native policy-message paths

`index-pnacl.cjs` records generated-text line ranges, referenced literals and direct-call candidates. Complete selected function bodies remain alongside its JSON index.

| LLVM function | Generated LLVM lines | Selected static behavior |
|---|---|---|
| `@7772` | 7920–8615 | Processes the Student instance's message path, including `hello`, `connect_lcs`, preference/channel changes, questions, thumbnail data and log requests. Its position in the retained Student-instance vtable supports the message-handler identification; original source names are not recovered. |
| `@7877` | 43393–43530 | Constructs `WEB_LIMITING::` plus two integer fields using `%d::%d`, then reaches the Pepper message wrapper. |
| `@7878` | 43532–43859 | Constructs `WEB_LIMITING_LIST::` with JSON-style `listType` and `entries` data and reaches the same wrapper. |
| `@7879` | 43861–43986 | Constructs `KEYSTROKE_ALERTING::{"enabled":…}`; object state determines enabled and, in the enabled branch, `captureScreen` before posting. Those fields are not evidence of the currently active policy. |
| `@7887` | 47993–48861 | Builds channel/unique-ID/banned-word data, handles string escaping, references `BANNED_WORD_LIST::`, and reaches the Pepper message wrapper. Full encoding/ownership semantics of its intermediate string helpers were not reconstructed. |
| `@7889` | 48891–49032 | Builds a `BANNED_WORD_COMMAND::` message carrying a unique identifier and reaches that wrapper. |
| `@8222` | 126727–126887 | Obtains `PPB_Messaging;1.2`, falls back to `PPB_Messaging;1.0`, and invokes the selected interface's message function. |

The JavaScript receiver independently corroborates the message boundary: `script/studentNACL.js:156–189` dispatches `WEB_LIMITING`, `WEB_LIMITING_LIST`, `BANNED_WORD_LIST`, `BANNED_WORD_COMMAND` and `KEYSTROKE_ALERTING` to their handlers. The earlier [native follow-up](filter-audit-2026-11-01-native.md) traces their downstream WebHelper behavior and gated input reporting.

The selected preference paths `@7882`/`@7883` reference `DEVICE`, `channel`, `use_proxy`, `proxy_host`, `proxy_port` and identity/cache configuration. Those proxy-related literals belong to inspected connection-preference handling; their presence does not establish page-proxy detection. This is a bounded statement about the selected functions, not a claim that no other native classifier exists.

These paths give concrete native producers for previously observed JavaScript bridge commands. They do not expose an origin-controlled method for changing teacher/native policy. The Student payload was parsed as data and was never executed. Network packet handling, all remaining native functions, runtime defaults, live policy transitions and architecture-specific translation remain unfinished.

## Reproduction and remaining scope

Evidence is retained under ignored `extensions/filter-audit-2026-11-01/`:

- `restore-core-history.cjs`, `restored-core-history.json`, and per-package CRX/inventories.
- `securly/fingerprint-replay.cjs` and its 15-case receipt.
- `pnacl-tools/toolchain-receipt.json`, original toolchain metadata and checksum-verified SDK archive.
- Both complete decoded files, `student-index.json`, and selected `function-*.ll` bodies.

The original objective remains open. More catalog IDs still need genuinely dated older/intermediate releases; five current channels remain unresolved; most decoded native functions and several large vendor dependencies remain unanalyzed; and real installed-extension/cloud/policy enforcement has not been verified. The completed production checks from the root continuation remain unchanged because this pass modifies research and ignored evidence only.

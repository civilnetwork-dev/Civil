# Native extension follow-up, 1 November 2026

Later continuation: [historical recovery and PNaCl](filter-audit-2026-11-01-history-native.md) obtains compatible official tools, decodes the complete LanSchool payload, and traces selected native policy-message producers. Its evidence supersedes this report's tool-availability and undecoded-payload boundaries, while full native semantics remain incomplete.

Status: partial. This extends the [ContentKeeper native addendum](filter-audit-2026-10-30-native.md) and the [network group report](filter-audit-2026-10-30-network.md). It reconstructs more of ContentKeeper's authentication codec, executes CK-Authenticator G3's shipped WASM offline, and traces LanSchool's policy-controlled input reporting. It does not complete the requested historical-version or native-code coverage. No production change follows from the inspected paths.

## Evidence and identity

Evidence is retained under the ignored `extensions/filter-audit-2026-11-01/native/` directory. Original ContentKeeper files came from `~/extensions/contentkeeper/`; G3 and LanSchool replays use the packages already acquired on 1 November. The older `extensions/filter-audit-2026-10-30/` evidence tree was absent from this checkout, so this pass rehashed the available artifacts instead of assuming its saved records still existed.

| Artifact | Bytes | SHA-256 |
|---|---:|---|
| ContentKeeper 2.1.4 `ckauth_x86_64.nexe` | 1,639,960 | `673c3616c51c6076ebb61627da5e8bbc964b9678d0c7a5f8e1121512f7e55df6` |
| ContentKeeper 2.1.4 `ckauth_unstripped_x86_64.nexe` | 5,774,801 | `cc6a29d5018503feb4d92b7ad7b21aa9025fea2c37ada6c65ce298aa3de91ea5` |
| CK-Authenticator G3 5.1 `ckenc.wasm` | 23,377 | `3148053fdd36cc956e1b5b60bbcc3699ce5d5bf15166c26b7098ba6e232d5033` |
| CK-Authenticator G3 5.1 `ckenc.js` | 15,469 | `84a24bc8776396c0152eb42f5875899ffc9e2a8583bf95fd9393b95dc01314b8` |
| LanSchool Student 8.0.2.15 `student.pexe` | 2,104,828 | `6794203ca95da677bc5b5ca50a543ca710f6236d41f3a2dd2d670836feb264f3` |
| LanSchool WebHelper 9.2.0.2 `js/background.js` | 48,390 | `6db0dadf065222d0a3eb7258ba6b83d4fac52450be7e0d90cae7a4cd07f781e7` |
| LanSchool WebHelper 9.2.0.2 `js/kl.js` | 997 | `effd540f6241f2dda68bf8a46ddf709643b2b257ee5698ea063d692a41a73cb7` |

The Ghidra project's recorded executable SHA-256 matches the ContentKeeper file above. The read-only ELF decoder again verifies matching `.text` and `.rodata` bytes between stripped and unstripped binaries, supporting symbol-to-address correspondence. It does not verify CRX signatures or release dates. The six inspected LanSchool files, including `student.pexe`, match the same-version current downloads byte for byte; that is not an additional historical release.

Correction to the earlier native addendum: `.rodata` has ELF virtual address **`0x10020200`**, not `0x10020000`. Its previously reported 93,528-byte size and SHA-256 remain correct. `native-inventory.json` records the section headers and hashes.

## ContentKeeper: deeper selected native reconstruction

The existing Ghidra 12.1.3 project was reused without imports, renames, scripts, or target execution. The earlier pass followed `CKAuthInstance::HandleMessage` through `ckCommHide` and `ckCommShow`. This pass examines the next layers:

| Address | Shipped symbol or observed role | Static observation |
|---|---|---|
| `0x21ec0` | `ckBlowFishEncode` | Copies the input string, reserves aligned capacity, calls `0x211e0` with mode 1, and resizes to the returned length. |
| `0x21e00` | `ckBlowFishDecode` | The corresponding wrapper calls `0x211e0` with mode 2. |
| `0x211e0` | Block-processing loop | Initializes a shared cipher state once, rounds partial inputs to eight-byte blocks with zero fill, loads/stores big-endian halves, and applies forward or reverse round-key traversal. The inspected loop does not chain a prior message block. |
| `0x20cc0` | Key schedule | Builds eighteen round words and four 256-entry substitution tables. Together with the shipped wrapper names and round arithmetic, this supports the Blowfish interpretation. |
| `0x22340` | `ckBase64Encode` | Encodes the binary output using the standard Base64 alphabet and `=` padding. |
| `0x22980` | `ckBase64Decode` | Reconstructs binary bytes through the reverse alphabet table and removes Base64 padding bytes. |
| `0x22860`, `0x22de0` | `ckCommEncode`, `ckCommDecode` | Separate wrappers call additional helpers before encryption or after decryption; those helpers were not reconstructed in this pass. They must not be conflated with `ckCommHide`/`ckCommShow`. |

The handler path established earlier is therefore supported by specific codec operations, rather than only cipher-related symbol names. This remains selected static decompilation. NaCl's sandbox register and indirect-return convention cause generic x86 decompiler warnings; inferred C++ types, return values, and pseudocode are not executable source. No native round-trip was run, and native/WASM wire equivalence was not established.

The inspected path carries authentication messages between the extension and gateway. It establishes no Civil DOM classifier and no page-origin mechanism for changing gateway policy. The remaining native functions and ARM/x86-32 variants remain outside this pass.

## CK-Authenticator G3: actual WASM codec replay

The installed WABT **1.0.41** tools validate and decode the complete 23,377-byte module to `ckenc.wat` and `ckenc.dcmp`. REA's WASM adapter requires 1.0.42; these are direct shell-tool results, not REA Evidence IDs. Tool paths and executable hashes are retained in `native-tools.json`.

The module contains 49 defined functions, five function imports, one fixed 256-page memory, and eleven exports. The shipped JavaScript glue maps `encryptData` to export `j` (function 45) and `decryptData` to `h` (function 53). Its five host imports implement C++ exceptions, abort, memory copying, and heap resizing. They provide no browser DOM or network interface in the inspected glue.

The selected decompilation traces comma-delimited token splitting, the Blowfish-shaped block routine (function 23), and Base64 conversion. This matches the service worker's two uses: independently encoded email/epoch credentials and an encoded XML identification payload. It is an authentication codec, not an autonomous page classifier.

`ck-g3-replay.cjs` executes the **unmodified shipped glue and WASM** in `node:vm` with supplied local WASM bytes. Vendor code receives no `process`, `require`, filesystem API, `fetch`, `XMLHttpRequest`, Chrome API, document, or timers. Node's VM is not an OS security boundary. No service worker, gateway request, or extension installation runs.

The replay verifies five nonempty round-trips: an ordinary hostname, an email/epoch pair, an XML identification sample, a UTF-8 hostname, and three comma-separated tokens. Repeated encryption of each sample is identical; token counts remain one, two, one, one, and three. All identities and addresses are analyst-provided test values. Empty input produces `Input data length is zero`; an input whose length cannot form Base64 groups produces `Input data is invalid`. The additional malformed-input observations in the receipt are not a complete validation audit.

This closes the earlier "WASM only inventoried" gap for the selected exported codec path. It does not reconstruct every allocator/exception branch, execute the G3 worker, prove all message encodings, or determine remote ContentKeeper categorization.

## LanSchool: policy-controlled input reporting

`student.pexe` is still a PNaCl payload with the previously recorded hash. No compatible `pnacl-dis` or `llvm-dis` was found in PATH, the checked Rust toolchain, or the existing Downloads tools. No replacement toolchain was installed. Its native semantics remain unresolved.

The JavaScript side provides a more concrete remaining signal than a generic claim about "monitoring":

- `studentNACL.js` handles native string messages for `BANNED_WORD_LIST`, `BANNED_WORD_COMMAND`, and `KEYSTROKE_ALERTING`, along with web-limit policies, thumbnails, and classroom state. These identify bridge capabilities, not the currently active district policy.
- WebHelper's manifest injects `js/kl.js` at document start into all frames, including matching `about:blank` frames. That script captures `keydown`, applies a 10 ms throttle, and sends `kl` runtime messages containing a key or modifier object.
- `js/background.js:999` forwards that data to `toKeylogQueue` at line 1039. The function acts only when `keystrokeInjectionActive` is true, ignores modifier combinations, lowercases characters, maintains a 50-character queue, and compares it with the supplied banned-word list. A match emits `BannedWordTyped` to the extension ID that supplied the list.
- Separate branches send navigation history and web-limit queries to the local Student application. On ChromeOS, the worker disables that HTTP path and instead enables the Chrome Student listeners. The native application and its policy remain separate evidence requirements.

`lanschool-input-replay.cjs` runs the exact content script and selected background functions with mocked DOM listener, Chrome storage, and runtime APIs. With an **analyst-configured** test word `proxy`, synthetic keys `PrOxY` produce one `BannedWordTyped` message while monitoring is enabled and none while disabled. The test word is not an observed vendor default or school policy. No real browser, PNaCl module, native Student application, or network service is executed.

This controlled replay demonstrates the inspected gated input path. Neutral runtime URLs and engine globals do not affect privileged content-script key capture. Civil's Host middleware cannot intercept an extension-to-extension runtime message or a direct extension request to a local application. No production workaround is justified by this evidence alone.

## Reproduction and residual work

From the repository root, the retained checks are:

```sh
node extensions/filter-audit-2026-11-01/native/native-inventory.cjs
node extensions/filter-audit-2026-11-01/native/ck-g3-replay.cjs
node extensions/filter-audit-2026-11-01/native/lanschool-input-replay.cjs
```

All three checks pass. WASM validation also exits 0. Complete Ghidra responses, including warnings, are preserved in `ghidra-*.json`; all replay inputs, source hashes, selected ranges, results, and limitations are preserved in the corresponding JSON receipts.

Remaining requirements: dated distinct historical packages for these IDs; LanSchool PNaCl translation; additional ContentKeeper native paths and architecture variants; complete G3 worker execution; an authorized managed Chrome run with installed extensions and representative policy; and gateway/native-application decisions. This pass supplies no managed-device unblock verdict.

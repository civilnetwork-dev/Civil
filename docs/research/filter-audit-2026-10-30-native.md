# ContentKeeper native addendum

Audit date: 30 October 2026. This extends the classroom-group report's initial native-code boundary. It is a selected static decompilation, not full native coverage or observed execution.

## Artifact and analysis identity

The existing `ContentKeeper-nexe-Decompilation` Ghidra project contained an analyzed `ckauth_x86_64.nexe`. Its recorded executable SHA-256 matches both the original user archive and the audit's cached ContentKeeper 2.1.4 package:

`673c3616c51c6076ebb61627da5e8bbc964b9678d0c7a5f8e1121512f7e55df6` (1,639,960 bytes).

The program metadata identifies ELF, x86-64, GCC and Ghidra 12.1.3; 2,933 functions were already analyzed. This existing analysis was reused without importing a duplicate, executing the extension, changing types/names, or enabling scripts. The REA native provider was not configured for this target; the connected Ghidra plugin supplied the decompilation fallback. Ghidra's script endpoint was disabled and remained disabled.

The package also ships `ckauth_unstripped_x86_64.nexe` (5,774,801 bytes), SHA-256 `cc6a29d5018503feb4d92b7ad7b21aa9025fea2c37ada6c65ce298aa3de91ea5`. A local ELF64 section/symbol decoder verified that stripped and unstripped files have identical `.text` and `.rodata` addresses, lengths and hashes:

| Section | Virtual address | Bytes | SHA-256 |
|---|---|---|---|
| `.text` | `0x20080` | 1,251,872 | `50e9cf0c4d2bd2235b6e2a24d35a721cbc13c2d4387ac0a233847648c3bc15d1` |
| `.rodata` | `0x10020000` | 93,528 | `4b84bae92dfcc99a8be323672ab8128c5fb1b1d23e7a9915ed6016e9e979a854` |

That correspondence supports mapping the shipped symbol table's names to the selected addresses in the stripped program. It does not authenticate a vendor signature or recover original C++ source.

## Selected native path

The unstripped symbol `_ZN14CKAuthInstance13HandleMessageERKN2pp3VarE` maps to `0x20400`, the Native Client `CKAuthInstance::HandleMessage` entry. The decompiled handler accepts a string message, splits on `|`, and selects `getip`, `decrypt` or `encrypt`. The `getip` branch constructs `locip|127.0.0.1`. Crypto branches process the payload after the delimiter, call their helper and construct a response with `decrypted|` or `encrypted|`; unknown commands produce an `unknown cmd` string. The reply path calls the Pepper messaging wrapper.

The handler's encryption branch calls `0x22920`, whose shipped symbol is `_Z10ckCommHideRSsS_`. Its selected decompilation calls `0x21ec0` (`_Z16ckBlowFishEncodeRKSsRSs`), checks the result and then calls `0x22340`. The decryption branch calls `0x22d80`, `_Z10ckCommShowRKSsRSs`, which calls `0x22980` and then `0x21e00`, `_Z16ckBlowFishDecodeRKSsRSs`. These names and calls support the inference that this native path wraps the JavaScript gateway-authentication messages with Blowfish-related transformations. Full encoding, key setup, error semantics and cryptographic behavior were not reconstructed or replayed.

The selected handler provides concrete native support for the authenticator role observed in `background.js` and `common.js`. No proxy-DOM classifier is established in this path. This is not a negative claim about every native function: the remaining functions, platform variants, runtime and gateway policy were not exhaustively analyzed. Native Client's sandbox register and indirect-call convention also leaves warnings in the generic x86 decompiler output; its pseudocode must not be treated as executable source.

## Retained evidence

The ignored artifact directory `extensions/filter-audit-2026-10-30/contentkeeper/` contains:

- `native-symbols.tmp.mjs`: runnable read-only ELF64 symbol/section decoder.
- `native-symbols.json`: source hashes, matching sections and selected original symbols.
- `native-decompilation.json`: unabridged Ghidra tool responses for `0x20400`, `0x22920` and `0x22d80`, including warnings.

No new production change follows from this addendum. The observed native path concerns extension authentication; it does not give Civil origin code control over extension-background requests or the school's gateway policy.

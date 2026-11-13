# LanSchool Student web-policy expiry, 3 November 2026

The [previous PNaCl pass](filter-audit-2026-11-01-history-native.md) found native producers for the web-limiting flags and list. This pass traces their stale-state caller in Student **8.0.2.15** and checks the companion WebHelper **9.2.0.2** reset handlers. The two timers distinguish policy expiry from a new decision on the current URL.

## Student native path

The shipped `student.pexe` matches SHA-256 `6794203ca95da677bc5b5ca50a543ca710f6236d41f3a2dd2d670836feb264f3`. Function numbers and line references below come from the retained `student.llvm.ll` (SHA-256 `41ac9a12f46ffff25dd2820f71b27d44199e99f7d627dee325a0c50a18d4fabf`).

1. In `@7812`, dispatch value 8 enters the flags branch. If the state at offset 252 is already nonzero, the incoming values at offsets 8 and 6 must match the stored values at offsets 252 and 256 before the branch proceeds. The branches that update the flags also write the current clock value to offset 488 and call `@7877`. Dispatch value 9 reaches the separate list branch, which also checks the two stored values before reaching `@7878`. This identifies state correlation checks. The original names and authority of the fields remain unknown. See LLVM lines 21902–21915, 24664–24841 and 25643–25653.
2. `@7873` posts the `@7874` callback with zero delay. The callback can post itself again with a 50 ms or 35,000 ms delay, depending on its branch. `@8227` resolves `PPB_MessageLoop;1.0` and calls slot 5 with the resource, callback and delay. See LLVM lines 41115–41145, 42487–42527 and 127165–127246. [Chromium's Pepper message-loop ABI](https://chromium.googlesource.com/chromium/src/+/8faa69a843a85e8f1d7f69df19a8b505b71a4b55/ppapi/c/ppb_message_loop.h)
3. `@7874` checks for a nonzero value at state offset 252 and tests whether the current whole-second clock value is strictly greater than the value at offset 488 plus 20. The function reads the 64-bit time value from the first field returned by slot 1 of the `nacl-irt-basic-0.1` table, whose ABI identifies the slot as `gettod`. On the stale branch it refreshes offset 488, zeroes offsets 252, 256, 260, 264 and 268, then calls `@7877` and `@7878`. This is a threshold evaluated when the callback runs. See LLVM lines 42529–42617 and 553059–553062. [Native Client IRT ABI](https://chromium.googlesource.com/arc/arc/+/f9448a4e3a4b6a413d0e4bc94ce64af2afd64a21/src/bare_metal/common/irt.h)
4. With those fields zeroed, `@7877` formats `WEB_LIMITING::0::1`. The first value comes from offset 260 and the second is the result of testing offset 252 for zero. `@7878` sends a `WEB_LIMITING_LIST` payload with string `listType` set to `"0"`. It reads the entry container from offset 272, which the stale branch leaves untouched. An empty list cannot be inferred from the reset. See LLVM lines 43434–43452 and 43576–43599.

## WebHelper receiver and fallback

Student's `script/studentNACL.js:156–165` dispatches both messages. Its `script/mainpage.js` forwards their payloads as `WebLimitFlags` and `WebLimitURLList` to the configured helper extension IDs. WebHelper routes external messages through a sender allowlist check in `js/background.js:957–962`. The flag handler at lines 729–751 splits the payload, stores both values, refreshes its last-flags timestamp and clears the IP and incognito restriction bits when the flags are zero. The list handler at lines 1412–1454 clears both prior arrays, reads the new type, calls `reEnableBrowsing` for type zero, processes any supplied entries and requests open-tab validation.

WebHelper also checks independently every **20 seconds**. The code sets its threshold to **30 seconds**, despite the adjacent 20-second comment. The comparison is strict greater-than and is skipped for a zero last-flags timestamp or a numeric zero list type. Expiry clears the type and the IP and incognito restrictions via `reEnableBrowsing`. See lines 230, 1256–1272 and 1400–1404.

The isolated replay executes the three shipped WebHelper function bodies with a fake clock and storage, icon and tab-validation stubs. All five checks passed. Exactly 30 seconds left the restrictions alone, 31 seconds cleared them, already-disabled state and absent timestamps were ignored, and an empty type-zero message called both array clears, re-enabled browsing and requested tab validation. The replay used `background.js` SHA-256 `6db0dadf065222d0a3eb7258ba6b83d4fac52450be7e0d90cae7a4cd07f781e7`.

## Scope

The trace supports a stale classroom-policy explanation for some changes in browsing behavior. It gives no evidence of Civil fingerprinting in these paths. A timed-out policy should therefore remain distinct from a URL classification result in probe evidence. Native execution, exact wire protocol and installed-device policy behavior remain open.

Retained evidence is under the ignored `extensions/filter-audit-2026-11-03/lanschool/` directory. `policy-expiry-ir.txt` holds selected LLVM slices. Run `node extensions/filter-audit-2026-11-03/lanschool/replay-policy-expiry.cjs` to reproduce the checked cases in `replay-policy-expiry.json`.

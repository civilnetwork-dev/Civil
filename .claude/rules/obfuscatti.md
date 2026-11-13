---
paths:
  - "misc/obfuscatti/**"
  - "misc/vite/obfuscateAssets.ts"
---
# Obfuscatti

- Load civil-obfuscatti skill before changing transform, engine or build.
- After any change to `misc/obfuscatti/src`, run `caveman-blocks run zig-test --step test` and `--step test-jsdefender`. Byte-for-byte parity with JSDefender Core 2.12.0 = acceptance target.
- Never edit `zig-pkg/` or `zig-out/`: fetched and built.
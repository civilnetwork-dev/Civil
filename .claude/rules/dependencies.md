---
paths:
  - "package.json"
  - "bun.lock"
  - "patches/**"
  - "misc/wisp/native/Cargo.toml"
  - "misc/*/build.zig.zon"
---
# Dependency files

- Follow civil-deps-upgrade skill for any version change.
- `overrides["@tanstack/router-core"]` = router-core version `@tanstack/solid-router` pins; `seroval` and `seroval-plugins` = version `solid-js` pins. Never set to newest release.
- Solid and Drizzle release candidates stay pinned exact (`bun add --exact`).
- Bumping package in `patchedDependencies` = port its patch with `bun patch` and `bun patch --commit`.
- Never hand-edit `bun.lock`: change `package.json`, then run `bun install`.
- After any install, `caveman-blocks run dep-pins` must return `"ok": true`.
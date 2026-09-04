# Extension host

Loads an unpacked Chrome/Safari extension folder and runs its real background
code in a `node:vm` sandbox — real `chrome`/`browser` API semantics, plus the
web platform underneath them, with no real Chromium or WebKit anywhere. Built
for testing filter-vendor extensions' declarativeNetRequest/storage/alarm
behavior without a browser.

All twenty-eight filter bundles tracked in
[Filter-Sources](https://github.com/civilnetwork-dev/Filter-Sources) run their
background code to completion in it, with nothing thrown and nothing
rejected.

## Usage

```ts
import { loadExtension } from "./misc/extensionHost";

const ext = await loadExtension({ dir: "path/to/unpacked-extension" });
ext.matchRequest("https://blocked.example/", { resourceType: "main_frame" });
// => { action: "block", matchedRuleId: 1 }
```

## The extension API

`runtime` (id, getManifest, getURL, sendMessage/onMessage, connect, ports,
getPlatformInfo, onInstalled — fired once after the background code loads,
matching real Chrome), `storage.{local,sync,session,managed}` (`managed` is
the enterprise-policy area, read-only and seeded via
`LoadOptions.managedStorage`), `alarms` (virtual clock, not real timers —
`ext.advanceTime(ms)`), `action`/`browserAction` (calls recorded, not
rendered), `tabs` (one synthetic tab, MV2 `executeScript`/`insertCSS`
included), `scripting`, `declarativeNetRequest` (real
`urlFilter`/`regexFilter` matching, real priority/action resolution),
`windows`, `identity`, `management`, `i18n` (reads the extension's own
`_locales`), `extension`, `system.{cpu,memory,storage,display,network}`, and
empty-but-real `history`/`downloads`/`bookmarks`/`cookies`/`sessions`/
`topSites`/`tabGroups`/`contextMenus`/`commands`/`notifications`.

Anything else — `webRequest`, `idle`, `proxy`, `enterprise`, ... — falls back
to a universal stub (`api/stub.ts`) that absorbs calls and property access
instead of throwing. The stub answers `undefined` to questions *about* the
object (`__esModule`, `default`); claiming otherwise made webpack-bundled
extensions read `chrome.default` and fail unrecognisably far downstream.

Both calling conventions work everywhere: promise style (MV3) and a trailing
callback (MV2's only style, and still common in MV3 bundles) — see
`api/callbacks.ts`. `runtime.onMessage` listeners get Chrome's three
arguments, `(message, sender, sendResponse)`, and — as in Chrome — do **not**
hear the extension's own `runtime.sendMessage`; those are recorded on
`ExtensionHandle.sentMessages` instead. `ExtensionHandle.sendMessage` stands
in for another context (a content script, a popup) and does reach them.

## The platform under it

`chrome.*` turned out to be the smaller half. `api/platform.ts` supplies what
a bare vm context doesn't: `Response`/`Request`/`Headers`/`FormData`,
`EventTarget`, streams, `WebAssembly` including the streaming entry points,
`XMLHttpRequest`, `location`, a Chromebook-shaped `navigator`, and
`importScripts`.

Which platform an extension gets depends on its manifest, because that is how
Chrome does it:

- **MV3 `service_worker`** — a ServiceWorkerGlobalScope: `self`, `clients`,
  `caches`, no `window`, no `document`. A bundle touching `document` there is
  broken in real Chrome too.
- **MV2 `scripts`/`page`** — a background *page*, so a real DOM (happy-dom),
  with `window` aliased to the global exactly as a browser does it, and the
  `<script>` tags Chrome's generated page would contain.

ES-module service workers and bundles that dynamic-`import()` their own chunks
are bundled through esbuild on the fly, which is what Chrome effectively does
when it loads a module worker.

Nothing reaches the network. `fetch` and `XMLHttpRequest` serve the
extension's **own** packaged files from disk — a real device reads its bundled
wasm and rule lists offline — and answer 503 for anything else. `WebSocket`
connects to nothing. `LoadOptions.allowNetwork` opts into real traffic, and
`LoadOptions.network` answers remote requests from a function instead, which
is how a vendor's server-side gate gets satisfied offline (see
`VENDOR_SETUP` in `filterCompat.test.ts` for Lightspeed Insight's).

## Verification

`filterCompat.test.ts` drives every assertion off a committed scan of what the
tracked bundles actually call (`fixtures/filterApiSurface.json`, regenerated
by `fixtures/buildFilterApiSurface.ts`), then — when a checkout of the bundles
is present — loads all twenty-eight for real and asserts they start up clean.

```sh
npx vitest run misc/extensionHost
CIVIL_FILTER_BUNDLES=/path/to/unpacked bun misc/extensionHost/fixtures/buildFilterApiSurface.ts
```

## Where it stops (ponytail: add when a real bundle needs it)

- **Rendering and navigation.** There is a DOM for MV2 backgrounds, but no
  layout, no painting, no page loads. `scripting.executeScript` records the
  call and runs nothing: content-script *behavior* against a real page belongs
  to the `window.open` emulation, not here.
- **IndexedDB.** No implementation; a bundle using it for its own caching
  logs an error and carries on.
- **Message delivery over ports.** `runtime.connect` returns a real
  port-shaped object, so the nine bundles that open one survive startup — but
  nothing travels over it, because there is no second realm to be the other
  end.
- **Multi-tab / multi-window state.** One synthetic tab and one synthetic
  window; `tabs.create` and `windows.create` return them rather than making
  anything.
- **A vendor's server.** One filter (Lightspeed Insight) will not start
  without an enterprise policy and two replies from `agent.catchon.com`.
  `LoadOptions.managedStorage` and `LoadOptions.network` supply both, and
  `filterCompat.test.ts` documents where every field came from — the
  bundle's own `schema.json`, its `env/*.json`, and the fields
  `background.js` reads. A vendor that changes its gate needs that updated.

/** Public script URLs must not advertise engine names to DOM classifiers. */
export const runtimeScripts = {
    engine: "/_runtime/engine.js",
    controller: "/_runtime/controller.js",
    start: "/_runtime/start.js",
    frame: "/_runtime/frame.js",
    wasm: "/_runtime/engine.wasm",
} as const;

/** Transport URLs also reach extension resource-timing collectors. */
export const runtimeAssets = {
    bare: "/_runtime/request",
    libcurl: "/_runtime/channel",
    epoxy: "/_runtime/socket",
    mux: "/_runtime/worker",
    muxTransport: "/_runtime/bridge",
} as const;

/**
 * Where proxied pages live. Every proxied frame's address starts with this
 * path, so an extension that reads frame navigations (webNavigation, a content
 * script's `location`) sees it on every page a student opens.
 */
export const PROXY_PREFIX = "/_p/";


/**
 * Names the engine bundles are served under (misc/runtimeScripts.ts rewrites
 * them). The engine defines these on the page and in every proxied frame, where
 * iboss (`name in window`) and Aristotle (`window.$scramjetController`) look
 * for the upstream names. `database` is the controller's cookie store: Aristotle
 * lists `indexedDB.databases()` and matches /scramjet/.
 */
export const engineNames = {
    engine: "$rtEngine",
    controller: "$rtController",
    database: "rt-controller",
    legacyDatabase: "__scramjet_controller",
    injected: "rt-injected",
    attribute: "rt-attr",
    wasmScript: "engine.wasm.js",
} as const;

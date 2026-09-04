export { compileUrlFilter } from "./api/declarativeNetRequest";
export {
    buildFetch,
    buildFreshConsole,
    buildOfflineWebSocket,
    buildXMLHttpRequest,
} from "./api/platform";
export { compileScript, loadExtension } from "./host";
export { loadManifest, ManifestError, resolveBackground } from "./manifest";
export type { DNRRuleset } from "./state";
export type {
    ActionCall,
    CapturedMessage,
    DNRMatchResult,
    ExtensionHandle,
    ExtensionTarget,
    LoadOptions,
} from "./types";

/** Same-origin path the server relays to PostHog. Must match
 *  `POSTHOG_PROXY_PREFIX` in `misc/analytics/posthogProxy.ts`. */
export const RELAY_PATH = "/api/relay";

const STATIC_PATH = `${RELAY_PATH}/static/`;
const ASSET_ALIAS_PATH = `${RELAY_PATH}/asset/`;

/**
 * PostHog's `prepare_external_dependency_script` hook. Moves an SDK script
 * from `/static/<name>` to `/asset/<base64url of name>`, which the relay maps
 * back. Ad-block lists match bundle file names on any host:
 * `/posthog-recorder.js` is in EasyPrivacy, so the recorder never loaded for
 * visitors with uBlock Origin and their sessions had no replay.
 */
export function aliasRelayScript(script: HTMLScriptElement): HTMLScriptElement {
    const url = new URL(script.src);
    if (!url.pathname.startsWith(STATIC_PATH)) return script;
    const name = url.pathname.slice(STATIC_PATH.length);
    const alias = btoa(name)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    url.pathname = `${ASSET_ALIAS_PATH}${alias}`;
    script.src = url.href;
    return script;
}

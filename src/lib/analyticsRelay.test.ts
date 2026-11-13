// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";

import { aliasRelayScript } from "./analyticsRelay";

function script(src: string): HTMLScriptElement {
    const element = document.createElement("script");
    element.src = src;
    return element;
}

describe("aliasRelayScript", () => {
    it("moves a relay bundle to a path without its file name", () => {
        const result = aliasRelayScript(
            script(
                "https://civil.quartinal.me/api/relay/static/posthog-recorder.js?v=1.440.0",
            ),
        );

        expect(result.src).toBe(
            "https://civil.quartinal.me/api/relay/asset/cG9zdGhvZy1yZWNvcmRlci5qcw?v=1.440.0",
        );
    });

    it("keeps a version folder inside the alias", () => {
        const result = aliasRelayScript(
            script(
                "https://civil.quartinal.me/api/relay/static/1.440.0/posthog-recorder.js",
            ),
        );
        const alias = result.src.split("/asset/")[1] ?? "";

        expect(atob(alias.replace(/-/g, "+").replace(/_/g, "/"))).toBe(
            "1.440.0/posthog-recorder.js",
        );
    });

    it("leaves a script outside the relay's /static/ path alone", () => {
        const src =
            "https://civil.quartinal.me/api/relay/array/phc_token/config.js";

        expect(aliasRelayScript(script(src)).src).toBe(src);
    });
});

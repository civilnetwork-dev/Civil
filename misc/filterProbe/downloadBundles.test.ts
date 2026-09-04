/**
 * The download helpers, without a network: Omaha URL construction, the
 * multi-app codebase scoping, and CRX header stripping. `main()` (the actual
 * fetching) is guarded behind a direct-invocation check, so importing this
 * module runs nothing.
 */

import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { buildOmahaUrl, codebaseForApp, zipFromCrx } from "./downloadBundles";

describe("buildOmahaUrl", () => {
    it("asks with v=0.0.0.0 so the server returns the full record", () => {
        const url = buildOmahaUrl(
            "https://clients2.google.com/service/update2/crx",
            "ghlpmldmjjhmdgmneoaibbegkjjbonbk",
        );
        expect(url).toContain(
            "x=id%3Dghlpmldmjjhmdgmneoaibbegkjjbonbk%26v%3D0.0.0.0",
        );
        expect(url).toContain("acceptformat=crx2,crx3");
    });
});

describe("codebaseForApp", () => {
    // The real regression Filter-Sources' omaha.zig scopes around: this
    // vendor endpoint returns three apps for any query, and the first is not
    // the one asked for.
    const MULTI_APP = `<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
<app appid="lehdheafjemnomjkncejplognngbabho"><updatecheck codebase="https://rogueone.aristotleinsight.com/Student/x.crx" version="18.14.0" /></app><app appid="mjkknmkfafjbnhndgpnjmkbfkiobcahh"><updatecheck codebase="https://rogueone.aristotleinsight.com/Educator/y.crx" version="11.0.0" /></app></gupdate>`;

    it("reads the codebase from the matching app block, not the first", () => {
        expect(
            codebaseForApp(MULTI_APP, "mjkknmkfafjbnhndgpnjmkbfkiobcahh"),
        ).toBe("https://rogueone.aristotleinsight.com/Educator/y.crx");
        expect(
            codebaseForApp(MULTI_APP, "lehdheafjemnomjkncejplognngbabho"),
        ).toBe("https://rogueone.aristotleinsight.com/Student/x.crx");
    });

    it("returns undefined for an id not in the response", () => {
        expect(codebaseForApp(MULTI_APP, "not-present")).toBeUndefined();
    });
});

describe("zipFromCrx", () => {
    /** A real ZIP payload to wrap. */
    const zip = zipSync({ "manifest.json": new TextEncoder().encode("{}") });

    /** Prefix `zip` with a CRX3 header of the given protobuf-header length. */
    function crx3(headerLen: number): Uint8Array {
        const out = new Uint8Array(12 + headerLen + zip.length);
        out.set([0x43, 0x72, 0x32, 0x34], 0); // "Cr24"
        new DataView(out.buffer).setUint32(4, 3, true); // version 3
        new DataView(out.buffer).setUint32(8, headerLen, true);
        out.set(zip, 12 + headerLen);
        return out;
    }

    it("strips a CRX3 header and returns the ZIP", () => {
        const recovered = zipFromCrx(crx3(40));
        expect([...recovered]).toEqual([...zip]);
    });

    it("passes through a bare ZIP (some vendor endpoints send one)", () => {
        expect([...zipFromCrx(zip)]).toEqual([...zip]);
    });

    it("rejects bytes that are neither CRX nor ZIP", () => {
        expect(() => zipFromCrx(new Uint8Array([1, 2, 3, 4]))).toThrow(
            /not a CRX/,
        );
    });
});

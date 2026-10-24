// @vitest-environment happy-dom
import { renderSolid } from "$tests/helpers/renderSolid";
import { flush } from "solid-js";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The two district-contribution toasts share their header, actions and
 * submit request (ContributionToast.tsx). These drive each one end to end:
 * what reaches the server, what comes back to the caller, and what the
 * student sees when the server refuses.
 */

const { default: IbossGatewayToast } = await import("./IbossGatewayToast");
const { default: GoGuardianManifestToast } =
    await import("./GoGuardianManifestToast");

/** Solid applies signal writes on flush, so let them land before reading. */
async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    flush();
}

async function typeInto(field: HTMLTextAreaElement, value: string) {
    field.value = value;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await settle();
}

function buttons(container: HTMLElement) {
    const [, skip, submit] = container.querySelectorAll("button");
    return {
        skip: skip as HTMLButtonElement,
        submit: submit as HTMLButtonElement,
    };
}

function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe("IbossGatewayToast", () => {
    const props = { districtName: "Knox County", leaId: "4702220" };

    it("keeps Submit disabled until a gateway host is entered", async () => {
        const { container, unmount } = renderSolid(() => (
            <IbossGatewayToast
                {...props}
                onDismiss={() => {}}
                onSubmit={() => {}}
            />
        ));
        expect(buttons(container).submit.disabled).toBe(true);
        const [host] = container.querySelectorAll("textarea");
        await typeInto(host!, "cn1-vnsg2.ibosscloud.com");
        expect(buttons(container).submit.disabled).toBe(false);
        unmount();
    });

    it("sends the host and key, then hands back the stored host", async () => {
        const fetchMock = stubFetch(
            Response.json({ gatewayHost: "cn1-vnsg2.ibosscloud.com" }),
        );
        const onSubmit = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <IbossGatewayToast
                {...props}
                onDismiss={() => {}}
                onSubmit={onSubmit}
            />
        ));
        const [host, key] = container.querySelectorAll("textarea");
        await typeInto(host!, " cn1-vnsg2.ibosscloud.com ");
        await typeInto(key!, "secret");
        buttons(container).submit.click();
        await settle();

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/iboss/submit-gateway");
        expect(JSON.parse(init.body as string)).toEqual({
            gatewayHost: "cn1-vnsg2.ibosscloud.com",
            securityKey: "secret",
            leaId: "4702220",
            districtName: "Knox County",
            source: "manual",
        });
        expect(onSubmit).toHaveBeenCalledWith("cn1-vnsg2.ibosscloud.com");
        unmount();
    });

    it("shows the server's reason when it refuses", async () => {
        stubFetch(new Response("Invalid iboss gateway host", { status: 400 }));
        const onSubmit = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <IbossGatewayToast
                {...props}
                onDismiss={() => {}}
                onSubmit={onSubmit}
            />
        ));
        const [host] = container.querySelectorAll("textarea");
        await typeInto(host!, "example.com");
        buttons(container).submit.click();
        await settle();

        expect(container.textContent).toContain("Invalid iboss gateway host");
        expect(onSubmit).not.toHaveBeenCalled();
        expect(buttons(container).submit.disabled).toBe(false);
        unmount();
    });

    it("dismisses from both the close button and Skip", () => {
        const onDismiss = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <IbossGatewayToast
                {...props}
                onDismiss={onDismiss}
                onSubmit={() => {}}
            />
        ));
        (
            container.querySelector(
                'button[aria-label="Dismiss"]',
            ) as HTMLButtonElement
        ).click();
        buttons(container).skip.click();
        expect(onDismiss).toHaveBeenCalledTimes(2);
        unmount();
    });
});

describe("GoGuardianManifestToast", () => {
    it("submits a pasted key and hands back the extension id", async () => {
        const fetchMock = stubFetch(Response.json({ extensionId: "abc123" }));
        const onSubmit = vi.fn();
        const { container, unmount } = renderSolid(() => (
            <GoGuardianManifestToast
                districtName="Knox County"
                leaId="4702220"
                onDismiss={() => {}}
                onSubmit={onSubmit}
            />
        ));
        const [key] = container.querySelectorAll("textarea");
        await typeInto(key!, "MIIBIjAN");
        buttons(container).submit.click();
        await settle();

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe("/api/goguardian/submit-manifest-key");
        expect(JSON.parse(init.body as string)).toEqual({
            manifestKey: "MIIBIjAN",
            leaId: "4702220",
            districtName: "Knox County",
        });
        expect(onSubmit).toHaveBeenCalledWith("abc123");
        unmount();
    });
});

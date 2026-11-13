import { z } from "zod";

const profileSchema = z.object({
    sub: z.string().min(1),
    email: z.email(),
    email_verified: z.boolean().optional(),
    name: z.string().optional(),
    picture: z.string().optional(),
});

/** UserInfo supplements an already verified ID token, never establishes identity. */
export async function classLinkUserInfo(
    issuer: string,
    subject: string,
    accessToken: string | undefined,
) {
    if (!accessToken?.trim()) return null;
    try {
        const signal = AbortSignal.timeout(5_000);
        const discovery = await fetch(
            `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
            {
                headers: { accept: "application/json" },
                redirect: "error",
                signal,
            },
        );
        if (!discovery.ok) return null;
        const metadata = z
            .object({
                issuer: z.literal(issuer),
                userinfo_endpoint: z.url(),
            })
            .safeParse(await discovery.json());
        if (!metadata.success) return null;
        const endpoint = new URL(metadata.data.userinfo_endpoint);
        if (
            endpoint.protocol !== "https:" ||
            endpoint.username ||
            endpoint.password ||
            endpoint.hash
        ) {
            return null;
        }
        const response = await fetch(endpoint, {
            headers: {
                accept: "application/json",
                authorization: `Bearer ${accessToken}`,
            },
            redirect: "error",
            signal,
        });
        if (!response.ok) return null;
        const profile = profileSchema.safeParse(await response.json());
        return profile.success && profile.data.sub === subject
            ? profile.data
            : null;
    } catch {
        return null;
    }
}

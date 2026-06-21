import { createAuthClient } from "better-auth/client";
import { genericOAuthClient } from "better-auth/client/plugins";
import { TbFillBrandPatreon } from "solid-icons/tb";
import { createSignal, onSettled, Show } from "solid-js";
import * as s from "~/styles/PatreonLoginButton.css";

type SessionUser = {
    id: string;
    name?: string | null;
    image?: string | null;
    isAnonymous?: boolean | null;
};

let _client: ReturnType<typeof createAuthClient> | null = null;
function getClient() {
    if (typeof window === "undefined") return null;
    _client ??= createAuthClient({
        baseURL: window.location.origin,
        plugins: [genericOAuthClient()],
    });
    return _client;
}

export default function PatreonLoginButton() {
    const [user, setUser] = createSignal<SessionUser | null>(null);
    const [loading, setLoading] = createSignal(true);

    onSettled(() => {
        const client = getClient();
        if (!client) {
            setLoading(false);
            return;
        }
        void client
            .getSession()
            .then((result: any) => {
                const data = result?.data ?? result;
                const u = data?.user as SessionUser | null | undefined;
                setUser(u && !u.isAnonymous ? u : null);
            })
            .catch(() => {
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });
    });

    const handleLogin = () => {
        const client = getClient();
        if (!client) return;
        (client.signIn as any)
            .oauth2({
                providerId: "patreon",
                callbackURL: window.location.pathname,
            })
            .catch(console.error);
    };

    const handleSignOut = () => {
        const client = getClient();
        if (!client) return;
        client
            .signOut()
            .then(() => {
                setUser(null);
            })
            .catch(console.error);
    };

    return (
        <Show
            when={!loading()}
            fallback={
                <button class={s.button} disabled type="button">
                    <TbFillBrandPatreon size={15} />
                    Login with Patreon
                </button>
            }
        >
            <Show
                when={user()}
                fallback={
                    <button
                        class={s.button}
                        onClick={handleLogin}
                        type="button"
                    >
                        <TbFillBrandPatreon size={15} />
                        Subscribed to me on Patreon? Log in
                    </button>
                }
            >
                {u => (
                    <div class={s.loggedIn}>
                        <Show
                            when={u().image}
                            fallback={
                                <div class={s.avatarFallback}>
                                    {u().name?.[0]?.toUpperCase() ?? "P"}
                                </div>
                            }
                        >
                            <img
                                class={s.avatar}
                                src={u().image!}
                                alt={u().name ?? "Patreon user"}
                            />
                        </Show>
                        <span class={s.userName}>{u().name}</span>
                        <div class={s.divider} />
                        <button
                            class={s.signOutBtn}
                            onClick={handleSignOut}
                            type="button"
                        >
                            Sign out
                        </button>
                    </div>
                )}
            </Show>
        </Show>
    );
}

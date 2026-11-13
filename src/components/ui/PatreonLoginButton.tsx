import { createSignal, onSettled, Show } from "solid-js";

import { IconPatreon } from "~/components/icons";
import { getAuthClient as getClient } from "~/lib/auth";

import * as s from "~/styles/PatreonLoginButton.css";

type SessionUser = {
    id: string;
    name?: string | null;
    image?: string | null;
    isAnonymous?: boolean | null;
};

function SignedInUser(props: { user: SessionUser; onSignOut: () => void }) {
    return (
        <div class={s.loggedIn}>
            <Show
                when={props.user.image}
                fallback={
                    <div class={s.avatarFallback}>
                        {props.user.name?.[0]?.toUpperCase() ?? "P"}
                    </div>
                }
            >
                <img
                    class={s.avatar}
                    src={props.user.image!}
                    alt={props.user.name ?? "Patreon user"}
                />
            </Show>
            <span class={s.userName}>{props.user.name}</span>
            <div class={s.divider} />
            <button
                class={s.signOutBtn}
                onClick={props.onSignOut}
                type="button"
            >
                Sign out
            </button>
        </div>
    );
}

/** The signed-in Patreon user, if any; anonymous sessions don't count. */
function usePatreonUser() {
    const [user, setUser] = createSignal<SessionUser | null>(null);
    const [loading, setLoading] = createSignal(true);
    const [linked, setLinked] = createSignal(false);

    onSettled(() => {
        const client = getClient();
        if (!client) {
            setLoading(false);
            return;
        }
        void client
            .getSession()
            .then(async (result: any) => {
                const data = result?.data ?? result;
                const u = data?.user as SessionUser | null | undefined;
                setUser(u && !u.isAnonymous ? u : null);
                if (u && !u.isAnonymous) {
                    const accounts = await client.listAccounts();
                    setLinked(
                        accounts.data?.some(
                            account => account.providerId === "patreon",
                        ) ?? false,
                    );
                }
            })
            .catch(() => {
                setUser(null);
            })
            .finally(() => {
                setLoading(false);
            });
    });

    return { user, setUser, loading, linked };
}

function login(signedIn: boolean) {
    const client = getClient();
    if (!client) return;
    const options = {
        provider: "patreon",
        callbackURL: window.location.pathname,
    };
    const request = signedIn
        ? client.linkSocial(options)
        : client.signIn.social(options);
    void request.catch(console.error);
}

export default function PatreonLoginButton() {
    const { user, setUser, loading, linked } = usePatreonUser();

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
                    <IconPatreon size={15} />
                    Login with Patreon
                </button>
            }
        >
            <Show
                when={linked() ? user() : null}
                fallback={
                    <button
                        class={s.button}
                        onClick={() => login(!!user())}
                        type="button"
                    >
                        <IconPatreon size={15} />
                        {user() ? "Connect Patreon" : "Log in with Patreon"}
                    </button>
                }
            >
                {u => <SignedInUser user={u()} onSignOut={handleSignOut} />}
            </Show>
        </Show>
    );
}

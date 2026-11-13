import { createEffect, createSignal, onSettled, Show } from "solid-js";

import {
    classLinkCallbackError,
    type CivilUser,
    getAuthClient,
    signInWithClassLink,
} from "~/lib/auth";

import * as c from "~/styles/SettingControls.css";

async function readAccount() {
    const auth = getAuthClient();
    if (!auth) throw new Error("Account controls are unavailable.");
    const session = await auth.getSession();
    if (session.error)
        throw new Error(
            "Couldn't load your Civil account. Reload to try again.",
        );
    const user = session.data?.user as CivilUser | undefined;
    if (!user || user.isAnonymous) return { user: null, linked: false };
    const accounts = await auth.listAccounts();
    if (accounts.error)
        throw new Error("Couldn't check linked accounts. Reload to try again.");
    return {
        user,
        linked:
            accounts.data?.some(
                account => account.providerId === "classlink",
            ) ?? false,
    };
}

async function classLinkAvailable() {
    try {
        const response = await fetch("/api/authProviders", {
            credentials: "same-origin",
        });
        return response.ok && (await response.json()).classlink === true;
    } catch {
        return false;
    }
}

function useClassLinkAccount(page: "/setup" | "/settings") {
    const [account, setAccount] = createSignal<{
        user: CivilUser | null;
        linked: boolean;
    }>({ user: null, linked: false });
    const [available, setAvailable] = createSignal(false);
    const [loading, setLoading] = createSignal(true);
    const [busy, setBusy] = createSignal(false);
    const [error, setError] = createSignal("");
    const [loadFailed, setLoadFailed] = createSignal(false);

    onSettled(() => {
        let disposed = false;
        setError(classLinkCallbackError(window.location.search));
        void Promise.allSettled([readAccount(), classLinkAvailable()]).then(
            ([state, capability]) => {
                if (disposed) return;
                if (state.status === "fulfilled") setAccount(state.value);
                else {
                    setLoadFailed(true);
                    setError(
                        "Couldn't load your Civil account. Reload to try again.",
                    );
                }
                setAvailable(
                    capability.status === "fulfilled" && capability.value,
                );
                setLoading(false);
            },
        );
        return () => {
            disposed = true;
        };
    });

    const act = async (signOut = false) => {
        if (busy() || loading() || loadFailed()) return;
        setBusy(true);
        setError("");
        try {
            if (signOut) {
                const result = await getAuthClient()!.signOut();
                if (result.error)
                    throw new Error("Couldn't sign out of Civil. Try again.");
                setAccount({ user: null, linked: false });
            } else {
                await signInWithClassLink(page, !!account().user);
            }
        } catch (e) {
            setError(
                e instanceof Error
                    ? e.message
                    : "ClassLink sign-in failed. Try again.",
            );
        } finally {
            setBusy(false);
        }
    };
    return { account, available, loading, busy, error, loadFailed, act };
}

type AccountState = ReturnType<typeof useClassLinkAccount>;

function AccountActions(props: { state: AccountState }) {
    const state = props.state;
    const label = () =>
        state.loading()
            ? "Checking ClassLink…"
            : state.busy()
              ? "Working…"
              : state.account().linked
                ? "ClassLink connected"
                : state.account().user
                  ? "Connect ClassLink"
                  : "Sign in with ClassLink";
    return (
        <div class={c.rowControl}>
            <button
                type="button"
                class={c.key}
                disabled={
                    state.loading() ||
                    state.busy() ||
                    state.loadFailed() ||
                    !state.available() ||
                    state.account().linked
                }
                onClick={() => void state.act()}
            >
                {label()}
            </button>
            <Show when={state.account().user}>
                <button
                    type="button"
                    class={c.key}
                    disabled={state.busy()}
                    onClick={() => void state.act(true)}
                >
                    Sign out of Civil
                </button>
            </Show>
        </div>
    );
}

export default function ClassLinkAccount(props: {
    page: "/setup" | "/settings";
    onAvailable?: (available: boolean) => void;
}) {
    const state = useClassLinkAccount(props.page);
    createEffect(state.available, available => {
        props.onAvailable?.(available);
    });
    return (
        <Show when={state.available()}>
            <div
                class={c.row}
                aria-busy={state.loading() || state.busy() ? "true" : "false"}
            >
                <div class={c.rowText}>
                    <span class={c.rowLabel}>ClassLink</span>
                    <span class={c.rowHint}>
                        Optional. Sign in on ClassLink's website, then return to
                        Civil.
                    </span>
                    <Show when={state.account().user}>
                        {user => (
                            <span class={c.rowHint}>
                                Signed in to Civil as{" "}
                                {user().email || user().name}.
                            </span>
                        )}
                    </Show>
                    <Show when={state.error()}>
                        <span class={c.rowError} role="alert">
                            {state.error()}
                        </span>
                    </Show>
                </div>
                <AccountActions state={state} />
            </div>
        </Show>
    );
}

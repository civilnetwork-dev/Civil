import { Show } from "solid-js";
import * as s from "~/styles/NewTabPage.css";
import SearchBarContainer from "./SearchBarContainer";

export default function NewTabPage() {
    return (
        <div class={s.newtabRoot}>
            <div class={s.welcomeText}>
                <h1>Welcome to Civil Proxy!</h1>
                <Show
                    when={
                        typeof window !== "undefined" &&
                        window.self !== window.top
                    }
                >
                    <div class={s.searchbarWrap}>
                        <SearchBarContainer inline />
                    </div>
                </Show>
                <p>
                    It's {"\u0020"}
                    <b>your</b>
                    {"\u0020"}web proxy.
                </p>
            </div>

            <span>
                Note that we now use HilltopAds to help us earn from this site,
                as it's open-source. You may get unnecessary advertisements at
                times.
            </span>
        </div>
    );
}

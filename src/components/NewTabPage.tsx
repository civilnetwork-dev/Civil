import { Show } from "solid-js";
import * as s from "~/styles/NewTabPage.css";
import SearchBarContainer from "./SearchBarContainer";

export default function NewTabPage() {
    return (
        <div class={s.newtabRoot}>
            <div class={s.welcomeText}>
                <h1>Welcome to Civil Proxy!</h1>
                <Show when={window.self !== window.top}>
                    <div class={s.searchbarWrap}>
                        <SearchBarContainer inline />
                    </div>
                </Show>
                <p>
                    It's <b>your</b> web proxy.
                </p>
            </div>
        </div>
    );
}

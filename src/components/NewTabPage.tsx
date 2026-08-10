import { Show } from "solid-js";
import * as s from "~/styles/NewTabPage.css";
import SearchBarContainer from "./SearchBarContainer";

export default function NewTabPage() {
    const inFrame = () =>
        typeof window !== "undefined" && window.self !== window.top;

    return (
        <div class={s.newtabRoot}>
            <div class={s.welcomeText}>
                <span class={s.eyebrow}>
                    <span class={s.eyebrowDot} />
                    Ready
                </span>
                <h1 class={s.wordmark}>Civil</h1>
                <span class={s.wordmarkRule} />
                <p class={s.tagline}>
                    It's <b>your</b> web proxy.
                </p>
            </div>

            <Show when={inFrame()}>
                <div class={s.searchbarWrap}>
                    <span class={[s.cornerBracket, s.cornerTL]} />
                    <span class={[s.cornerBracket, s.cornerTR]} />
                    <span class={[s.cornerBracket, s.cornerBL]} />
                    <span class={[s.cornerBracket, s.cornerBR]} />
                    <span class={[s.axisTick, s.axisTickLeft]} />
                    <span class={[s.axisTick, s.axisTickRight]} />
                    <SearchBarContainer inline />
                </div>
            </Show>

            <p class={s.adNotice}>Ads keep Civil free and open source.</p>
        </div>
    );
}

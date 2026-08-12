import { Show } from "solid-js";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import Unfold from "~/components/schematic/Unfold";
import * as s from "~/styles/NewTabPage.css";
import SearchBarContainer from "./SearchBarContainer";

/**
 * The title sheet.
 *
 * The one page where the title block sits bottom-left rather than at the top,
 * because that is where a drawing puts it. Everything above is deliberately
 * empty except the omnibox, which sits on the sheet's primary rule with
 * dimension caps marking its span.
 */
export default function NewTabPage() {
    const inFrame = () =>
        typeof window !== "undefined" && window.self !== window.top;

    return (
        <Sheet density="coarse" class={s.newtabSheet}>
            <div class={s.omniboxZone}>
                <Show when={inFrame()}>
                    <div class={s.omniboxWrap}>
                        <Rule caps class={s.omniboxRule} />
                        <SearchBarContainer inline />
                        <Unfold
                            label="Session detail"
                            summary={<Anno muted>session</Anno>}
                        >
                            <dl class={s.statusStrip}>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>engine</dt>
                                    <dd class={s.statusValue}>scramjet</dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>transport</dt>
                                    <dd class={s.statusValue}>epoxy</dd>
                                </div>
                                <div class={s.statusPair}>
                                    <dt class={s.statusKey}>wisp</dt>
                                    <dd class={s.statusValue}>2</dd>
                                </div>
                            </dl>
                        </Unfold>
                    </div>
                </Show>
            </div>

            <div class={s.titleZone}>
                <div class={s.titleBlockCorner}>
                    <Rule weight="major" class={s.titleRule} />
                    <h1 class={s.wordmark}>Civil</h1>
                    <Anno muted>rev 2.0 · your web proxy</Anno>
                </div>
                <p class={s.adNote}>
                    <Anno muted>
                        note 01 — ads keep Civil free and open source
                    </Anno>
                </p>
            </div>
        </Sheet>
    );
}

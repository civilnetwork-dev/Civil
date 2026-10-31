import { For, Show } from "solid-js";

import { IconAlert } from "~/components/icons";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import { TRANSPORT_OPTIONS } from "~/components/settingOptions";
import { displayUrl } from "~/lib/browserHelpers";
import { openInBrowser } from "~/lib/openInBrowser";
import { isTransport, type TransportName } from "~/lib/settings";

import * as s from "~/styles/ConnectionErrorPage.css";
import * as schematic from "~/styles/schematic.css";

/** Asks the chrome to load this tab's page again over `transport`
 *  (useIframeManager.ts handles `civil:nav-retry`). */
function retry(transport: TransportName) {
    window.parent.postMessage(
        { type: "civil:nav-retry", transport },
        window.location.origin,
    );
}

/** Every method by name; the one that just failed says "again". */
function MethodKeys(props: { failed?: TransportName }) {
    return (
        <div class={s.keys}>
            <For each={TRANSPORT_OPTIONS}>
                {option => (
                    <button
                        type="button"
                        class={s.key}
                        onClick={() => retry(option.value)}
                    >
                        {option.value === props.failed
                            ? `Try ${option.label} again`
                            : `Try ${option.label}`}
                    </button>
                )}
            </For>
        </div>
    );
}

/**
 * What a tab shows when a proxied page never arrived (useIframeManager.ts's
 * load watchdog). Rendered into the frame itself rather than over it: the
 * frame is the thing that failed, and an overlay would leave a blank page
 * underneath for anyone who dismissed it. Reload alone re-runs the method
 * that just failed, so the page offers every method by name.
 */
export default function ConnectionErrorPage({
    url,
    used,
}: {
    url: string;
    used: string;
}) {
    const failed = TRANSPORT_OPTIONS.find(
        option => isTransport(used) && option.value === used,
    );

    return (
        <Sheet>
            <TitleBlock
                title="Can't connect"
                meta={displayUrl(url)}
                icon={IconAlert}
                tint="sandstone"
            />

            <p class={schematic.lede}>
                The connection to Civil's proxy opened but never delivered the
                page
                <Show when={failed}>
                    {option => (
                        <>
                            {" over "}
                            <span class={s.method}>{option().label}</span>
                        </>
                    )}
                </Show>
                . Reloading won't help on its own, because the connection method
                has to change.
            </p>

            <Rule label="Try another connection method" weight="major" />
            <MethodKeys failed={failed?.value} />

            <p class={s.hint}>
                If every method fails, the network's filter is probably blocking
                Civil, not the site.
            </p>
            <button
                type="button"
                class={s.key}
                onClick={() =>
                    openInBrowser("browser:checkfilters", { newTab: false })
                }
            >
                Check this network
            </button>
        </Sheet>
    );
}

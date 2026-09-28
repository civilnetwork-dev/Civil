import { createSignal, onSettled, Show } from "solid-js";

import {
    type FullEvent,
    historyDismissFullEvent,
    historyFullEvent,
    onHistoryChange,
} from "~/api/history";
import { IconAlert } from "~/components/icons";
import { PLACE_NAMES } from "~/components/settingOptions";

import * as s from "~/styles/SettingControls.css";

/** What happened the last time history storage ran out, as one sentence. */
function describeFullEvent(e: FullEvent): string {
    const when = new Date(e.at).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
    const filled = `History storage filled up on ${when}.`;
    const oldest = `${e.removed.toLocaleString()} oldest ${e.removed === 1 ? "page" : "pages"}`;
    const place = PLACE_NAMES[e.location];
    switch (e.action) {
        case "trim":
            return `${filled} Civil removed the ${oldest}.`;
        case "wipe":
            return `${filled} Civil started history over in ${place}.`;
        case "wipe-best":
            return `${filled} Civil started history over in ${place}, the best place on this device at the time.`;
        case "spill":
            return e.removed
                ? `Both places for history were full on ${when}. Civil removed the ${oldest} and carried on in ${place}.`
                : `${filled} Civil carried on saving in ${place}.`;
        case "compress":
            return e.removed
                ? `${filled} Civil compressed history and removed the ${oldest}.`
                : `${filled} Civil compressed history to make room.`;
        case "stop":
            return "History storage is full, so new pages aren't being saved. Clear some history, raise the space limit in Settings, or choose what happens when space runs out.";
    }
}

/**
 * Says what Civil did the last time history storage ran out, until
 * dismissed. The user chose what should happen, so the page reports it
 * rather than doing it silently.
 */
export default function HistoryFullNotice() {
    const [event, setEvent] = createSignal(historyFullEvent());
    onSettled(() => onHistoryChange(() => setEvent(historyFullEvent())));

    return (
        <Show when={event()}>
            <div class={s.notice} role="status">
                <IconAlert size={15} class={s.noticeMark} />
                <p class={s.noticeText}>{describeFullEvent(event()!)}</p>
                <button
                    type="button"
                    class={s.noticeDismiss}
                    onClick={() => {
                        historyDismissFullEvent();
                        setEvent(null);
                    }}
                >
                    Dismiss
                </button>
            </div>
        </Show>
    );
}

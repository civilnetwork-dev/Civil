import { Dynamic } from "@solidjs/web";
import { For, Show } from "solid-js";
import {
    IconAlert,
    IconBan,
    IconCheck,
    IconClose,
    IconSpinnerFilled,
} from "~/components/icons";
import Anno from "~/components/schematic/Anno";
import Unfold from "~/components/schematic/Unfold";
import type { FilterResult, FilterStatus } from "~/lib/filterCheckVendors";
import * as s from "~/styles/FilterCheckPage.css";

/**
 * The report ledger.
 *
 * One row per vendor in aligned monospace columns, because the question a user
 * actually has is comparative — "which of these is blocking me" — and cards
 * make comparison impossible. The verdict keeps its status colour; everything
 * else is the annotation tier.
 *
 * The unfold carries the detail string, which is where the backend's typed
 * error discriminant surfaces. Every checker under misc/filters/ returns a
 * neverthrow Result with an error union (INVALID_URL | NETWORK | PARSE) and
 * vendor-specific verdicts; the previous card UI flattened all of it into a
 * colour.
 */

/**
 * One glyph per verdict, all five distinct.
 *
 * DESIGN.md's Redundant-Channel Rule requires text, glyph AND colour to each
 * carry the verdict independently. Two statuses sharing a glyph drops that to
 * two channels, which matters most to the ~1% of people with deuteranopia —
 * for them the colour channel is the weakest of the three.
 *
 * A lookup beats the nested ternaries this replaced: a collision is visible at
 * a glance here, and was not there.
 */
const STATUS_GLYPH: Record<FilterStatus, typeof IconCheck> = {
    allowed: IconCheck,
    blocked: IconBan,
    warned: IconAlert,
    error: IconClose,
    unknown: IconSpinnerFilled,
};

function StatusMark(props: { status: FilterStatus }) {
    return (
        <Dynamic
            component={STATUS_GLYPH[props.status]}
            size={13}
            class={s.markIcon[props.status]}
        />
    );
}

export default function FilterCheckResults(props: { results: FilterResult[] }) {
    return (
        <div class={s.ledger}>
            <div class={s.ledgerHead} aria-hidden="true">
                <span>vendor</span>
                <span>verdict</span>
                <span>cat</span>
            </div>
            <ul class={s.ledgerBody}>
                <For each={props.results} keyed={false}>
                    {result => (
                        <li class={s.ledgerRow}>
                            <Unfold
                                label={`${result().filterName} detail`}
                                summary={
                                    <span class={s.rowGrid}>
                                        <span class={s.rowVendor}>
                                            <StatusMark
                                                status={result().status}
                                            />
                                            {result().filterName}
                                        </span>
                                        <span
                                            class={
                                                s.rowVerdict[result().status]
                                            }
                                        >
                                            {result().status}
                                        </span>
                                        <span class={s.rowCat}>
                                            {/* String(), because Solid renders
                                                the number 0 as nothing at all.
                                                In an aligned ledger a blank
                                                cell reads as missing data
                                                rather than "no categories". */}
                                            {String(
                                                result().categories?.length ??
                                                    0,
                                            )}
                                        </span>
                                    </span>
                                }
                            >
                                <div class={s.rowDetail}>
                                    <Anno>{result().detail}</Anno>
                                    <Show
                                        when={
                                            result().categories &&
                                            result().categories!.length > 0
                                        }
                                    >
                                        <div class={s.catRow}>
                                            <For
                                                each={result().categories}
                                                keyed={false}
                                            >
                                                {cat => (
                                                    <span class={s.catChip}>
                                                        {cat()}
                                                    </span>
                                                )}
                                            </For>
                                        </div>
                                    </Show>
                                </div>
                            </Unfold>
                        </li>
                    )}
                </For>
            </ul>
        </div>
    );
}

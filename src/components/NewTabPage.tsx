import { For, Show } from "solid-js";

import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import { Wordmark } from "~/components/Wordmark";

import SearchBarContainer from "./SearchBarContainer";

import * as s from "~/styles/NewTabPage.css";

type BandTone = keyof typeof s.bandTone;

interface Bed {
    /** Relative thickness. Flex-grow, so the section always fills the viewport. */
    weight: number;
    tone: BandTone;
}

/**
 * The section behind the page, bed by bed. Pure ground — no figures, no
 * callouts, nothing that asks to be read.
 *
 * It used to carry a depth log (mono figures down the left margin) and a
 * sample callout naming the live proxy engine. Both were drawn for the
 * design's own story, and to a user they were the worst kind of decoration:
 * numbers that *look* like information. A student scanning this page is
 * looking for one thing — where to type — and every labelled mark competes
 * with that. The beds stay because quiet tone under a page is atmosphere;
 * the labels went because unexplained data is homework.
 *
 * Every value is a literal. This app server-side renders, and a randomised
 * field draws differently on the server and the client — a hydration mismatch
 * and a visible flicker on load. The thicknesses are deliberately uneven: an
 * even stack reads as a progress bar, and this is not one.
 */
const SECTION: Bed[] = [
    { weight: 7, tone: 0 },
    { weight: 4, tone: 1 },
    { weight: 11, tone: 0 },
    { weight: 5, tone: 2 },
    { weight: 16, tone: 1 },
    { weight: 6, tone: 3 },
    { weight: 9, tone: 1 },
    { weight: 4, tone: 2 },
    { weight: 13, tone: 0 },
];

/**
 * The title sheet, reduced to what a first-time user needs: the name of the
 * thing, and the box you type in. The omnibox sits on the horizon rule at the
 * vertical centre — the one control on an otherwise quiet page, which is what
 * makes it unmissable. The wordmark keeps the drawing's bottom-left title
 * block position; the ad note is the one line Civil owes the reader.
 */
export default function NewTabPage() {
    const inFrame = () =>
        typeof window !== "undefined" && window.self !== window.top;

    return (
        <Sheet density="coarse" class={s.newtabSheet}>
            <div class={s.pageGrid}>
                <div class={s.sectionLayer} aria-hidden="true">
                    <For each={SECTION}>
                        {bed => (
                            <div
                                class={`${s.band} ${s.bandTone[bed.tone]}`}
                                style={{ "flex-grow": bed.weight }}
                            />
                        )}
                    </For>
                </div>

                <div class={s.omniboxZone}>
                    <Show when={inFrame()}>
                        <div class={s.omniboxSeat}>
                            <SearchBarContainer inline />
                        </div>
                    </Show>
                    <div class={s.horizonRuleTrack}>
                        <Rule weight="major" />
                    </div>
                </div>

                <div class={s.titleZone}>
                    <div class={s.titleBlockCorner}>
                        <Rule weight="major" class={s.titleRule} />
                        <h1 class={s.wordmark}>
                            <Wordmark width={196} />
                        </h1>
                        {/* The house line. Filtering vendors describe what they
                            do in soft nouns — visibility, insights, wellbeing,
                            "observed" — for machinery that records screens
                            minute by minute and flags students for reading
                            college and therapy pages. Civil's voice is the
                            inverse: name the mechanism, state the number, claim
                            nothing that isn't built.

                            "nothing here is flagged" broke that last rule:
                            Civil keeps its own restricted-domain list, and
                            hitting it is exactly a flag - five strikes inside
                            24h and the account is banned (misc/violations.ts).
                            The line that survives is the one the proxy
                            actually delivers: the network filter upstream
                            resolves one hostname, Civil's, and sees nothing
                            of what is loaded through it. */}
                        <Anno muted>rev 2.0 · your filter sees one domain</Anno>
                    </div>
                    <p class={s.adNote}>
                        <Anno muted>
                            note 01 — ads keep Civil free and open source
                        </Anno>
                    </p>
                </div>
            </div>
        </Sheet>
    );
}

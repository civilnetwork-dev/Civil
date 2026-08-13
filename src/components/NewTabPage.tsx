import { For, Show } from "solid-js";
import Anno from "~/components/schematic/Anno";
import Rule from "~/components/schematic/Rule";
import Sheet from "~/components/schematic/Sheet";
import Unfold from "~/components/schematic/Unfold";
import * as s from "~/styles/NewTabPage.css";
import SearchBarContainer from "./SearchBarContainer";

type StarTier = "cinder" | "starlight" | "moonlight";

interface Star {
    x: number;
    y: number;
    r: number;
    tier: StarTier;
}

/**
 * The static star field, hand-placed rather than randomised.
 *
 * This app server-side renders; a `Math.random()` field would draw different
 * positions on the server and the client, producing a hydration mismatch and
 * a visible flicker on load. Every coordinate below is a literal — nothing
 * here is computed at render time. Positions avoid two bands: the vertical
 * centre (roughly y 32–60%, x 14–86%) where the omnibox and its status strip
 * sit, and the bottom strip (y 80%+) where the title block and ad note live.
 * Most stars sit at the two dimmest tiers — a sky is mostly faint stars, and
 * an even mix reads as noise rather than depth. `daylight`, the brightest
 * tier, is reserved for the one catalogued star below.
 */
const STARS: Star[] = [
    // Upper sky (y 3–30%), full width.
    { x: 5, y: 6, r: 0.6, tier: "cinder" },
    { x: 9, y: 18, r: 0.8, tier: "starlight" },
    { x: 14, y: 8, r: 0.6, tier: "cinder" },
    { x: 18, y: 24, r: 0.7, tier: "starlight" },
    { x: 22, y: 5, r: 0.9, tier: "moonlight" },
    { x: 27, y: 15, r: 0.6, tier: "cinder" },
    { x: 31, y: 27, r: 0.7, tier: "starlight" },
    { x: 35, y: 9, r: 0.6, tier: "cinder" },
    { x: 40, y: 19, r: 0.8, tier: "starlight" },
    { x: 44, y: 4, r: 0.6, tier: "cinder" },
    { x: 48, y: 25, r: 0.9, tier: "moonlight" },
    { x: 52, y: 12, r: 0.6, tier: "cinder" },
    { x: 57, y: 22, r: 0.7, tier: "starlight" },
    { x: 61, y: 6, r: 0.6, tier: "cinder" },
    { x: 63, y: 21, r: 0.6, tier: "cinder" },
    { x: 64, y: 28, r: 0.8, tier: "starlight" },
    { x: 75, y: 27, r: 0.6, tier: "cinder" },
    { x: 78, y: 6, r: 0.7, tier: "starlight" },
    { x: 83, y: 23, r: 0.6, tier: "cinder" },
    { x: 87, y: 9, r: 0.9, tier: "moonlight" },
    { x: 91, y: 19, r: 0.6, tier: "cinder" },
    { x: 95, y: 5, r: 0.7, tier: "starlight" },
    // Side rails (y 32–59%), clear of the omnibox column.
    { x: 5, y: 35, r: 0.6, tier: "cinder" },
    { x: 9, y: 44, r: 0.7, tier: "starlight" },
    { x: 4, y: 52, r: 0.6, tier: "cinder" },
    { x: 11, y: 58, r: 0.8, tier: "moonlight" },
    { x: 7, y: 38, r: 0.6, tier: "cinder" },
    { x: 92, y: 36, r: 0.6, tier: "cinder" },
    { x: 96, y: 46, r: 0.7, tier: "starlight" },
    { x: 89, y: 54, r: 0.6, tier: "cinder" },
    { x: 94, y: 59, r: 0.8, tier: "moonlight" },
    { x: 90, y: 40, r: 0.6, tier: "cinder" },
    // Lower gap (y 63–78%), full width, above the title strip.
    { x: 6, y: 65, r: 0.6, tier: "cinder" },
    { x: 12, y: 74, r: 0.7, tier: "starlight" },
    { x: 18, y: 68, r: 0.6, tier: "cinder" },
    { x: 24, y: 77, r: 0.8, tier: "moonlight" },
    { x: 29, y: 63, r: 0.6, tier: "cinder" },
    { x: 35, y: 71, r: 0.7, tier: "starlight" },
    { x: 41, y: 66, r: 0.6, tier: "cinder" },
    { x: 47, y: 76, r: 0.6, tier: "cinder" },
    { x: 53, y: 69, r: 0.7, tier: "starlight" },
    { x: 59, y: 64, r: 0.6, tier: "cinder" },
    { x: 65, y: 78, r: 0.8, tier: "moonlight" },
    { x: 71, y: 67, r: 0.6, tier: "cinder" },
    { x: 77, y: 72, r: 0.7, tier: "starlight" },
    { x: 83, y: 65, r: 0.6, tier: "cinder" },
    { x: 89, y: 75, r: 0.7, tier: "starlight" },
    { x: 95, y: 69, r: 0.6, tier: "cinder" },
];

/**
 * The one catalogued star — the page's single creative flourish. Static
 * here; Task 9b swaps `CATALOGUE_LABEL` for the live proxy engine.
 */
const CATALOGUE_STAR = { x: 70, y: 10, r: 1.4 };
/** Leader-line endpoint. Mirrored by `catalogueLabel`'s top/left in the CSS. */
const CATALOGUE_LEADER = { x: 77, y: 18 };
const CATALOGUE_LABEL = "SJ-2 · scramjet";

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
            <div class={s.pageGrid}>
                <div class={s.starLayer}>
                    <svg class={s.starField} aria-hidden="true">
                        <For each={STARS} keyed={false}>
                            {star => (
                                <circle
                                    cx={`${star().x}%`}
                                    cy={`${star().y}%`}
                                    r={star().r}
                                    class={s.starTier[star().tier]}
                                />
                            )}
                        </For>
                        <line
                            x1={`${CATALOGUE_STAR.x}%`}
                            y1={`${CATALOGUE_STAR.y}%`}
                            x2={`${CATALOGUE_LEADER.x}%`}
                            y2={`${CATALOGUE_LEADER.y}%`}
                            class={s.leaderLine}
                        />
                        <circle
                            cx={`${CATALOGUE_STAR.x}%`}
                            cy={`${CATALOGUE_STAR.y}%`}
                            r={CATALOGUE_STAR.r}
                            class={s.starTier.daylight}
                        />
                    </svg>
                    <Anno class={s.catalogueLabel}>{CATALOGUE_LABEL}</Anno>
                </div>

                <div class={s.omniboxZone}>
                    <div class={s.horizonRuleTrack}>
                        <Rule weight="major" />
                    </div>
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
                        {/* The house line. Filtering vendors describe what they
                            do in soft nouns — visibility, insights, wellbeing,
                            "observed" — for machinery that records screens
                            minute by minute and flags students for reading
                            college and therapy pages. Civil's voice is the
                            inverse: name the mechanism, state the number, claim
                            nothing that isn't built. */}
                        <Anno muted>rev 2.0 · nothing here is flagged</Anno>
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

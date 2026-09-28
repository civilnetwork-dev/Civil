import type { JSX } from "@solidjs/web";
import {
    createEffect,
    createSignal,
    createUniqueId,
    For,
    Show,
} from "solid-js";

import {
    historyAutoLocate,
    historyGetMethod,
    historyMoveTo,
} from "~/api/history";
import {
    IconCheck,
    IconClock,
    IconLink,
    IconLock,
    IconSearch,
    IconSliders,
    IconWorld,
} from "~/components/icons";
import { ChoiceRow, TextRow, ToggleRow } from "~/components/SettingControls";
import {
    BAR_OPTIONS,
    dayLabel,
    FORMAT_OPTIONS,
    LIMIT_OPTIONS,
    LOCATION_OPTIONS,
    MOTION_OPTIONS,
    SEARCH_OPTIONS,
    STARTUP_OPTIONS,
    TIMEOUT_OPTIONS,
    TRANSPORT_NOTES,
    TRANSPORT_OPTIONS,
    WHEN_FULL_NOTES,
    WHEN_FULL_OPTIONS,
    WISP_NOTE,
    WISP_OPTIONS,
} from "~/components/settingOptions";
import Specimen, { type Glyph, type Tint } from "~/components/Specimen";
import { Wordmark } from "~/components/Wordmark";
import {
    getSetting,
    isSearchTemplate,
    markSetupComplete,
    needsSetup,
    type SettingKey,
    setSetting,
    type SettingValue,
} from "~/lib/settings";
import {
    pickSetupDefaults,
    readSetupEnv,
    type SetupPicks,
} from "~/lib/setupDefaults";

import * as s from "~/styles/SetupPage.css";

interface Step {
    title: string;
    lede: string;
    icon: Glyph;
    tint: Tint;
    keys: readonly SettingKey[];
}

const STEPS: readonly Step[] = [
    {
        title: "How do you like to search?",
        lede: "When what you type isn't a web address, Civil searches for it here.",
        icon: IconSearch,
        tint: "cobalt",
        keys: ["search", "searchTemplate", "suggestLive", "suggestHistory"],
    },
    {
        title: "How should Civil connect?",
        lede: "Civil can reach sites a few different ways, and some work better on some networks.",
        icon: IconLink,
        tint: "stone",
        keys: [
            "transportAuto",
            "transport",
            "transportFailover",
            "transportRemember",
            "navTimeout",
            "wispVersion",
        ],
    },
    {
        title: "Keep a history of pages you visit?",
        lede: "History helps you find a page again. It stays on this device.",
        icon: IconClock,
        tint: "juniper",
        keys: [
            "historyEnabled",
            "historyDays",
            "historyLocation",
            "historyFormat",
            "historyLimitKb",
            "historyWhenFull",
        ],
    },
    {
        title: "How should Civil open and look?",
        lede: "Choose what you see when Civil starts, and how much it moves.",
        icon: IconSliders,
        tint: "stone",
        keys: ["startup", "bookmarksBar", "motion"],
    },
    {
        title: "Help Civil work better?",
        lede: "Civil can share how sites load and how you use it, and look for filters so it can warn you about them.",
        icon: IconLock,
        tint: "stone",
        keys: ["compatReports", "filterDetect", "analytics"],
    },
];

const STEP_KEYS = STEPS.flatMap(step => step.keys);

type Draft = { [K in SettingKey]: SettingValue<K> };
type Phase = "welcome" | number | "summary";

const onOff = (on: boolean) => (on ? "On" : "Off");
const labelOf = <T,>(
    options: readonly { value: T; label: string }[],
    value: T,
) => options.find(o => o.value === value)?.label ?? String(value);

/** One question as a row of stone cards over native radios. */
function Cards<T extends string | number | boolean>(props: {
    legend: string;
    value: T;
    options: readonly { value: T; label: string; note?: string }[];
    suggested?: T;
    reason?: string;
    onChange: (value: T) => void;
}) {
    const name = createUniqueId();
    return (
        <fieldset class={s.group}>
            <legend class={s.groupLegend}>{props.legend}</legend>
            <div class={s.cards}>
                <For each={props.options}>
                    {option => (
                        // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- wraps its radio, and its text is option.label, which the rule can't see through the expression
                        <label class={s.card}>
                            <input
                                type="radio"
                                class={s.cardInput}
                                name={name}
                                checked={option.value === props.value}
                                onChange={() => props.onChange(option.value)}
                            />
                            <span class={s.cardFace}>
                                <span class={s.cardTitle}>
                                    {option.label}
                                    <IconCheck size={14} class={s.cardMark} />
                                </span>
                                <Show when={option.note}>
                                    <span class={s.cardNote}>
                                        {option.note}
                                    </span>
                                </Show>
                                <Show when={option.value === props.suggested}>
                                    <span class={s.suggested}>Suggested</span>
                                </Show>
                            </span>
                        </label>
                    )}
                </For>
            </div>
            <Show when={props.reason}>
                <p class={s.why}>{props.reason}</p>
            </Show>
        </fieldset>
    );
}

function More(props: { children: JSX.Element }) {
    return (
        <details class={s.advanced}>
            <summary class={s.advancedSummary}>More options</summary>
            {props.children}
        </details>
    );
}

export default function SetupPage() {
    // A first run starts from what Civil detects; a re-run from the
    // settings the visitor already has.
    const firstRun = needsSetup();

    const [phase, setPhase] = createSignal<Phase>("welcome");
    const [draft, setDraft] = createSignal<Draft>(
        Object.fromEntries(STEP_KEYS.map(k => [k, getSetting(k)])) as Draft,
    );
    const [picks, setPicks] = createSignal<SetupPicks | null>(null);
    /** Settings whose value came from skipping, so the summary says why. */
    const [picked, setPicked] = createSignal<ReadonlySet<SettingKey>>(
        new Set(),
    );
    const [done, setDone] = createSignal<ReadonlySet<number>>(new Set());
    const [waiting, setWaiting] = createSignal(false);
    const touched = new Set<SettingKey>();

    const detected = readSetupEnv().then(pickSetupDefaults);
    void detected.then(p => {
        setPicks(p);
        if (!firstRun) return;
        setDraft(d => {
            const next = { ...d } as Record<SettingKey, unknown>;
            for (const key of STEP_KEYS) {
                if (!touched.has(key) && p[key]) next[key] = p[key]!.value;
            }
            return next as Draft;
        });
    });

    const set = <K extends SettingKey>(key: K, value: SettingValue<K>) => {
        touched.add(key);
        setDraft(d => ({ ...d, [key]: value }));
        setPicked(prev => new Set([...prev].filter(k => k !== key)));
    };
    const d = () => draft();
    const pick = <K extends SettingKey>(key: K) =>
        picks()?.[key] as
            | { value: SettingValue<K>; reason: string }
            | undefined;

    /** Let Civil choose everything in these steps. */
    const autoPick = async (steps: readonly number[]) => {
        setWaiting(true);
        const p = await detected;
        setWaiting(false);
        const keys = steps.flatMap(i => STEPS[i].keys).filter(k => p[k]);
        setDraft(prev => {
            const next = { ...prev } as Record<SettingKey, unknown>;
            for (const key of keys) next[key] = p[key]!.value;
            return next as Draft;
        });
        setPicked(prev => new Set([...prev, ...keys]));
        setDone(prev => new Set([...prev, ...steps]));
    };

    const forward = (from: number) =>
        setPhase(from + 1 < STEPS.length ? from + 1 : "summary");

    const skipStep = async (i: number) => {
        await autoPick([i]);
        forward(i);
    };

    const nextStep = (i: number) => {
        setDone(prev => new Set([...prev, i]));
        forward(i);
    };

    const skipSetup = async () => {
        await autoPick(STEPS.map((_, i) => i).filter(i => !done().has(i)));
        setPhase("summary");
    };

    const back = () => {
        const p = phase();
        if (p === "summary") setPhase(STEPS.length - 1);
        else if (typeof p === "number") setPhase(p === 0 ? "welcome" : p - 1);
    };

    const finish = async () => {
        setWaiting(true);
        const values = draft();
        for (const key of STEP_KEYS) {
            setSetting(key, values[key] as never);
        }
        // Where history lives is a move, not just a value.
        try {
            if (values.historyLocation === "auto") await historyAutoLocate();
            else if (values.historyLocation !== historyGetMethod()) {
                await historyMoveTo(values.historyLocation);
            }
        } catch {}
        markSetupComplete();
        window.location.replace("/");
    };

    // Keyboard and screen reader users land on the new question.
    let heading: HTMLHeadingElement | undefined;
    let settled = false;
    createEffect(phase, () => {
        if (settled) heading?.focus();
        settled = true;
    });

    const step = () => {
        const p = phase();
        return typeof p === "number" ? STEPS[p] : undefined;
    };

    const title = () =>
        phase() === "welcome"
            ? "Welcome to Civil."
            : phase() === "summary"
              ? "You're all set."
              : step()!.title;

    const lede = () =>
        phase() === "welcome"
            ? "A few quick choices and Civil works the way you like. It takes about a minute, and you can change any of it later in Settings."
            : phase() === "summary"
              ? "Here's how Civil will work. Anything marked picked for you was chosen from this device and network."
              : step()!.lede;

    const why = (key: SettingKey) =>
        picked().has(key) ? picks()?.[key]?.reason : undefined;

    const summary = (): { name: string; value: string; reason?: string }[] => {
        const v = d();
        const method = labelOf(TRANSPORT_OPTIONS, v.transport);
        return [
            {
                name: "Search",
                value:
                    v.search === "custom"
                        ? v.searchTemplate || "Custom"
                        : labelOf(SEARCH_OPTIONS, v.search),
                reason: why("search"),
            },
            {
                name: "Search suggestions",
                value: onOff(v.suggestLive),
                reason: why("suggestLive"),
            },
            {
                name: "Connection",
                value: v.transportAuto
                    ? `Automatic, starting with ${method}`
                    : `Always ${method}`,
                reason: why("transport") ?? why("transportAuto"),
            },
            {
                name: "Slow pages",
                value: `Give up after ${labelOf(TIMEOUT_OPTIONS, v.navTimeout).toLowerCase()}`,
                reason: why("navTimeout"),
            },
            {
                name: "History",
                value: !v.historyEnabled
                    ? "Not saved"
                    : v.historyDays
                      ? `Kept for ${dayLabel(v.historyDays)}`
                      : "Kept until you clear it",
                reason: why("historyDays") ?? why("historyEnabled"),
            },
            {
                name: "When Civil opens",
                value: labelOf(STARTUP_OPTIONS, v.startup),
                reason: why("startup"),
            },
            {
                name: "Bookmarks bar",
                value: labelOf(BAR_OPTIONS, v.bookmarksBar),
                reason: why("bookmarksBar"),
            },
            {
                name: "Motion",
                value: labelOf(MOTION_OPTIONS, v.motion),
                reason: why("motion"),
            },
            {
                name: "Compatibility reports",
                value: onOff(v.compatReports),
                reason: why("compatReports"),
            },
            {
                name: "Filter check at startup",
                value: onOff(v.filterDetect),
                reason: why("filterDetect"),
            },
            {
                name: "Usage analytics",
                value: onOff(v.analytics),
                reason: why("analytics"),
            },
        ];
    };

    return (
        <main class={s.page}>
            <header class={s.top}>
                <Wordmark width={120} />
                <Show when={typeof phase() === "number"}>
                    <button
                        type="button"
                        class={s.textKey}
                        disabled={waiting()}
                        onClick={() => void skipSetup()}
                    >
                        Skip setup
                    </button>
                </Show>
            </header>

            <section class={s.plate} aria-labelledby="setup-title">
                <Show when={typeof phase() === "number"}>
                    {/* Drawn only: "Step 2 of 5" below says the same in text. */}
                    <ol class={s.progress} aria-hidden="true">
                        <For each={STEPS}>
                            {(_, i) => (
                                <li
                                    class={[
                                        s.progressStep,
                                        {
                                            [s.progressDone]:
                                                i() <= (phase() as number),
                                        },
                                    ]}
                                />
                            )}
                        </For>
                    </ol>
                </Show>

                <div class={s.head}>
                    {/* Specimen draws its glyph once, so each phase gets a
                        fresh one: the keyed list swaps it when phase changes. */}
                    <For each={[phase()]}>
                        {p => (
                            <Specimen
                                icon={
                                    typeof p === "number"
                                        ? STEPS[p].icon
                                        : p === "summary"
                                          ? IconCheck
                                          : IconWorld
                                }
                                tint={
                                    typeof p === "number"
                                        ? STEPS[p].tint
                                        : p === "summary"
                                          ? "juniper"
                                          : "cobalt"
                                }
                                size={56}
                                idle={p === "welcome"}
                            />
                        )}
                    </For>
                    <Show when={typeof phase() === "number"}>
                        <span class={s.stepLabel}>
                            Step {(phase() as number) + 1} of {STEPS.length}
                        </span>
                    </Show>
                </div>

                <h1
                    id="setup-title"
                    class={s.title}
                    tabindex={-1}
                    ref={heading}
                >
                    {title()}
                </h1>
                <p class={s.lede}>{lede()}</p>

                <Show when={phase() === 0}>
                    <Cards
                        legend="Search with"
                        value={d().search}
                        options={SEARCH_OPTIONS.filter(
                            o => o.value !== "custom",
                        )}
                        suggested={pick("search")?.value}
                        reason={pick("search")?.reason}
                        onChange={v => set("search", v)}
                    />
                    <More>
                        <TextRow
                            label="Custom search address"
                            hint="Use your own search engine. Put %s where the search goes."
                            placeholder="https://example.com/search?q=%s"
                            type="url"
                            value={d().searchTemplate}
                            check={value =>
                                !value || isSearchTemplate(value)
                                    ? null
                                    : "Use a web address with %s where the search goes."
                            }
                            onCommit={value => {
                                set("searchTemplate", value);
                                if (value) set("search", "custom");
                            }}
                        />
                        <ToggleRow
                            label="Suggest searches as you type"
                            hint="Sends what you type to Civil's server to fetch suggestions."
                            checked={d().suggestLive}
                            onChange={on => set("suggestLive", on)}
                        />
                        <ToggleRow
                            label="Suggest pages from your history"
                            checked={d().suggestHistory}
                            onChange={on => set("suggestHistory", on)}
                        />
                    </More>
                </Show>

                <Show when={phase() === 1}>
                    <Cards
                        legend="Choose how"
                        value={d().transportAuto}
                        options={[
                            {
                                value: true,
                                label: "Automatically",
                                note: "Civil tests each new site and uses what works best. Recommended.",
                            },
                            {
                                value: false,
                                label: "Always the same way",
                                note: "You pick one method, and Civil sticks to it.",
                            },
                        ]}
                        suggested={pick("transportAuto")?.value}
                        reason={pick("transport")?.reason}
                        onChange={v => set("transportAuto", v)}
                    />
                    <Show when={!d().transportAuto}>
                        <Cards
                            legend="Method"
                            value={d().transport}
                            options={TRANSPORT_OPTIONS.map(o => ({
                                ...o,
                                note: TRANSPORT_NOTES[o.value],
                            }))}
                            suggested={pick("transport")?.value}
                            onChange={v => set("transport", v)}
                        />
                    </Show>
                    <More>
                        <Show when={d().transportAuto}>
                            <ChoiceRow
                                label="Starting method"
                                hint={TRANSPORT_NOTES[d().transport]}
                                value={d().transport}
                                options={TRANSPORT_OPTIONS}
                                onChange={v => set("transport", v)}
                            />
                        </Show>
                        <ToggleRow
                            label="Switch methods when a page doesn't load"
                            hint="Otherwise you choose one on the error page."
                            checked={d().transportFailover}
                            onChange={on => set("transportFailover", on)}
                        />
                        <ToggleRow
                            label="Remember the method that worked"
                            checked={d().transportRemember}
                            disabled={!d().transportFailover}
                            onChange={on => set("transportRemember", on)}
                        />
                        <ChoiceRow
                            label="Give up on a page after"
                            value={d().navTimeout}
                            options={TIMEOUT_OPTIONS}
                            onChange={v => set("navTimeout", v)}
                        />
                        <ChoiceRow
                            label="Wisp version"
                            hint={WISP_NOTE}
                            value={d().wispVersion}
                            options={WISP_OPTIONS}
                            onChange={v => set("wispVersion", v)}
                        />
                    </More>
                </Show>

                <Show when={phase() === 2}>
                    <Cards
                        legend="Save history"
                        value={d().historyEnabled}
                        options={[
                            {
                                value: true,
                                label: "Yes, keep history",
                                note: "Find pages you visited again.",
                            },
                            {
                                value: false,
                                label: "No",
                                note: "Pages you visit aren't saved.",
                            },
                        ]}
                        suggested={pick("historyEnabled")?.value}
                        onChange={v => set("historyEnabled", v)}
                    />
                    <Show when={d().historyEnabled}>
                        <Cards
                            legend="Delete pages after"
                            value={d().historyDays}
                            options={[30, 90, 365, 0].map(days => ({
                                value: days,
                                label: days ? dayLabel(days) : "Never",
                            }))}
                            suggested={pick("historyDays")?.value}
                            reason={pick("historyDays")?.reason}
                            onChange={v => set("historyDays", v)}
                        />
                        <More>
                            <ChoiceRow
                                label="Where to save it"
                                hint="Automatic picks whichever place has room and is fastest on this device."
                                value={d().historyLocation}
                                options={LOCATION_OPTIONS}
                                onChange={v => set("historyLocation", v)}
                            />
                            <ChoiceRow
                                label="Format"
                                hint={pick("historyFormat")?.reason}
                                value={d().historyFormat}
                                options={FORMAT_OPTIONS}
                                onChange={v => set("historyFormat", v)}
                            />
                            <ChoiceRow
                                label="Space for history"
                                value={d().historyLimitKb}
                                options={LIMIT_OPTIONS}
                                onChange={v => set("historyLimitKb", v)}
                            />
                            <ChoiceRow
                                label="When space runs out"
                                hint={WHEN_FULL_NOTES[d().historyWhenFull]}
                                value={d().historyWhenFull}
                                options={WHEN_FULL_OPTIONS}
                                onChange={v => set("historyWhenFull", v)}
                            />
                        </More>
                    </Show>
                </Show>

                <Show when={phase() === 3}>
                    <Cards
                        legend="When Civil opens"
                        value={d().startup}
                        options={STARTUP_OPTIONS.filter(
                            o => o.value !== "page",
                        )}
                        suggested={pick("startup")?.value}
                        onChange={v => set("startup", v)}
                    />
                    <Cards
                        legend="Bookmarks bar"
                        value={d().bookmarksBar}
                        options={BAR_OPTIONS}
                        suggested={pick("bookmarksBar")?.value}
                        reason={pick("bookmarksBar")?.reason}
                        onChange={v => set("bookmarksBar", v)}
                    />
                    <Cards
                        legend="Motion"
                        value={d().motion}
                        options={MOTION_OPTIONS}
                        suggested={pick("motion")?.value}
                        reason={pick("motion")?.reason}
                        onChange={v => set("motion", v)}
                    />
                </Show>

                <Show when={phase() === 4}>
                    <ToggleRow
                        label="Send site compatibility reports"
                        hint="After a page loads, Civil tells its server how well it worked, including the address, so it picks better methods for everyone."
                        checked={d().compatReports}
                        onChange={on => set("compatReports", on)}
                    />
                    <ToggleRow
                        label="Check for filters when Civil opens"
                        hint="Looks for filter extensions such as GoGuardian so Civil can warn you."
                        checked={d().filterDetect}
                        onChange={on => set("filterDetect", on)}
                    />
                    <ToggleRow
                        label="Share usage analytics"
                        hint="Sends how you use Civil to its analytics service, PostHog, including pages viewed, clicks and session recordings, so problems get found and fixed."
                        checked={d().analytics}
                        onChange={on => set("analytics", on)}
                    />
                </Show>

                <Show when={phase() === "summary"}>
                    <dl class={s.summary}>
                        <For each={summary()}>
                            {row => (
                                <div class={s.summaryRow}>
                                    <dt class={s.summaryName}>{row.name}</dt>
                                    <dd class={s.summaryValue}>
                                        {row.value}
                                        <Show when={row.reason}>
                                            <span class={s.suggested}>
                                                Picked for you
                                            </span>
                                            <span class={s.why}>
                                                {row.reason}
                                            </span>
                                        </Show>
                                    </dd>
                                </div>
                            )}
                        </For>
                    </dl>
                </Show>

                <Show when={waiting()}>
                    <p class={s.busy} role="status">
                        Checking this device and network.
                    </p>
                </Show>

                <footer class={s.footer}>
                    <Show
                        when={phase() !== "welcome"}
                        fallback={
                            <div class={s.keys}>
                                <button
                                    type="button"
                                    class={s.next}
                                    onClick={() => setPhase(0)}
                                >
                                    Set up Civil
                                </button>
                                <button
                                    type="button"
                                    class={s.back}
                                    disabled={waiting()}
                                    onClick={() => void skipSetup()}
                                >
                                    Pick for me
                                </button>
                            </div>
                        }
                    >
                        <button type="button" class={s.back} onClick={back}>
                            Back
                        </button>
                        <div class={s.footerEnd}>
                            <Show
                                when={phase() !== "summary"}
                                fallback={
                                    <button
                                        type="button"
                                        class={s.next}
                                        disabled={waiting()}
                                        onClick={() => void finish()}
                                    >
                                        Start browsing
                                    </button>
                                }
                            >
                                <button
                                    type="button"
                                    class={s.textKey}
                                    disabled={waiting()}
                                    onClick={() =>
                                        void skipStep(phase() as number)
                                    }
                                >
                                    Skip this step
                                </button>
                                <button
                                    type="button"
                                    class={s.next}
                                    onClick={() => nextStep(phase() as number)}
                                >
                                    Next
                                </button>
                            </Show>
                        </div>
                    </Show>
                </footer>
                <Show when={phase() === "welcome"}>
                    <p class={s.why}>
                        Pick for me looks at this device and network and chooses
                        for you. You'll see what it picked before anything is
                        saved.
                    </p>
                </Show>
            </section>
        </main>
    );
}

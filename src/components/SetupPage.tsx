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
import {
    ChoiceRow,
    TextRow,
    ToggleRow,
    TraitList,
} from "~/components/SettingControls";
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
    type Traits,
    TRANSPORT_NOTES,
    TRANSPORT_OPTIONS,
    TRANSPORT_TRAITS,
    WHEN_FULL_NOTES,
    WHEN_FULL_OPTIONS,
    WISP_NOTE,
    WISP_OPTIONS,
    WISP_TRAITS,
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
        lede: "Civil can share how you use it, and look for filters so it can warn you about them.",
        icon: IconLock,
        tint: "stone",
        keys: ["filterDetect", "analytics"],
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
    options: readonly {
        value: T;
        label: string;
        note?: string;
        traits?: Traits;
    }[];
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
                                <Show when={option.traits}>
                                    {traits => (
                                        <span class={s.cardNote}>
                                            <TraitList traits={traits()} />
                                        </span>
                                    )}
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

function useSetupDraft() {
    // A first run starts from what Civil detects; a re-run from the
    // settings the visitor already has.
    const firstRun = needsSetup();

    const [draft, setDraft] = createSignal<Draft>(
        Object.fromEntries(STEP_KEYS.map(k => [k, getSetting(k)])) as Draft,
    );
    const [picks, setPicks] = createSignal<SetupPicks | null>(null);
    /** Settings whose value came from skipping, so the summary says why. */
    const [picked, setPicked] = createSignal<ReadonlySet<SettingKey>>(
        new Set(),
    );
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
    const pick = <K extends SettingKey>(key: K) =>
        picks()?.[key] as
            | { value: SettingValue<K>; reason: string }
            | undefined;

    /** Takes Civil's choice for every one of these settings. */
    const applyPicks = async (keys: readonly SettingKey[]) => {
        const p = await detected;
        const chosen = keys.filter(k => p[k]);
        setDraft(prev => {
            const next = { ...prev } as Record<SettingKey, unknown>;
            for (const key of chosen) next[key] = p[key]!.value;
            return next as Draft;
        });
        setPicked(prev => new Set([...prev, ...chosen]));
    };

    const why = (key: SettingKey) =>
        picked().has(key) ? picks()?.[key]?.reason : undefined;

    return { d: draft, set, pick, applyPicks, why };
}

type SetupDraft = ReturnType<typeof useSetupDraft>;

async function finishSetup(values: Draft) {
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
}

function useSetupFlow(draft: SetupDraft) {
    const [phase, setPhase] = createSignal<Phase>("welcome");
    const [done, setDone] = createSignal<ReadonlySet<number>>(new Set());
    const [waiting, setWaiting] = createSignal(false);

    /** Let Civil choose everything in these steps. */
    const autoPick = async (steps: readonly number[]) => {
        setWaiting(true);
        await draft.applyPicks(steps.flatMap(i => STEPS[i].keys));
        setWaiting(false);
        setDone(prev => new Set([...prev, ...steps]));
    };

    const forward = (from: number) =>
        setPhase(from + 1 < STEPS.length ? from + 1 : "summary");

    return {
        phase,
        setPhase,
        waiting,
        skipStep: async (i: number) => {
            await autoPick([i]);
            forward(i);
        },
        nextStep: (i: number) => {
            setDone(prev => new Set([...prev, i]));
            forward(i);
        },
        skipSetup: async () => {
            await autoPick(STEPS.map((_, i) => i).filter(i => !done().has(i)));
            setPhase("summary");
        },
        back: () => {
            const p = phase();
            if (p === "summary") setPhase(STEPS.length - 1);
            else if (typeof p === "number")
                setPhase(p === 0 ? "welcome" : p - 1);
        },
        finish: async () => {
            setWaiting(true);
            await finishSetup(draft.d());
        },
    };
}

type SetupFlow = ReturnType<typeof useSetupFlow>;

function titleOf(phase: Phase) {
    if (phase === "welcome") return "Welcome to Civil.";
    if (phase === "summary") return "You're all set.";
    return STEPS[phase].title;
}

function ledeOf(phase: Phase) {
    if (phase === "welcome")
        return "A few quick choices and Civil works the way you like. It takes about a minute, and you can change any of it later in Settings.";
    if (phase === "summary")
        return "Here's how Civil will work. Anything marked picked for you was chosen from this device and network.";
    return STEPS[phase].lede;
}

interface SummaryRow {
    name: string;
    value: string;
    reason?: string;
}

type Why = (key: SettingKey) => string | undefined;

function browsingRows(v: Draft, why: Why): SummaryRow[] {
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
            value:
                v.transport === "epoxy"
                    ? `${method}, on Wisp ${labelOf(WISP_OPTIONS, v.wispVersion).toLowerCase()}`
                    : method,
            reason: why("transport") ?? why("wispVersion"),
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
    ];
}

function preferenceRows(v: Draft, why: Why): SummaryRow[] {
    return [
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
}

function Progress(props: { phase: number }) {
    return (
        <ol class={s.progress} aria-hidden="true">
            <For each={STEPS}>
                {(_, i) => (
                    <li
                        class={[
                            s.progressStep,
                            { [s.progressDone]: i() <= props.phase },
                        ]}
                    />
                )}
            </For>
        </ol>
    );
}

function SetupHead(props: { phase: Phase }) {
    return (
        <div class={s.head}>
            {/* Specimen draws its glyph once, so each phase gets a
                fresh one: the keyed list swaps it when phase changes. */}
            <For each={[props.phase]}>
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
            <Show when={typeof props.phase === "number"}>
                <span class={s.stepLabel}>
                    Step {(props.phase as number) + 1} of {STEPS.length}
                </span>
            </Show>
        </div>
    );
}

function SearchStep(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    const set = props.draft.set;
    return (
        <>
            <Cards
                legend="Search with"
                value={d().search}
                options={SEARCH_OPTIONS.filter(o => o.value !== "custom")}
                suggested={props.draft.pick("search")?.value}
                reason={props.draft.pick("search")?.reason}
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
        </>
    );
}

const METHOD_OPTIONS = TRANSPORT_OPTIONS.map(o => ({
    ...o,
    note: TRANSPORT_NOTES[o.value],
    traits: TRANSPORT_TRAITS[o.value],
}));

function ConnectionMore(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    const set = props.draft.set;
    return (
        <More>
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
                hint={
                    <>
                        {WISP_NOTE}
                        <TraitList traits={WISP_TRAITS[d().wispVersion]} />
                    </>
                }
                value={d().wispVersion}
                options={WISP_OPTIONS}
                onChange={v => set("wispVersion", v)}
            />
        </More>
    );
}

function ConnectionStep(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    return (
        <>
            <Cards
                legend="Method"
                value={d().transport}
                options={METHOD_OPTIONS}
                suggested={props.draft.pick("transport")?.value}
                reason={props.draft.pick("transport")?.reason}
                onChange={v => props.draft.set("transport", v)}
            />
            <ConnectionMore draft={props.draft} />
        </>
    );
}

const KEEP_OPTIONS = [
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
];

const KEEP_FOR_OPTIONS = [30, 90, 365, 0].map(days => ({
    value: days,
    label: days ? dayLabel(days) : "Never",
}));

function HistoryMore(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    const set = props.draft.set;
    return (
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
                hint={props.draft.pick("historyFormat")?.reason}
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
    );
}

function HistoryStep(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    return (
        <>
            <Cards
                legend="Save history"
                value={d().historyEnabled}
                options={KEEP_OPTIONS}
                suggested={props.draft.pick("historyEnabled")?.value}
                onChange={v => props.draft.set("historyEnabled", v)}
            />
            <Show when={d().historyEnabled}>
                <Cards
                    legend="Delete pages after"
                    value={d().historyDays}
                    options={KEEP_FOR_OPTIONS}
                    suggested={props.draft.pick("historyDays")?.value}
                    reason={props.draft.pick("historyDays")?.reason}
                    onChange={v => props.draft.set("historyDays", v)}
                />
                <HistoryMore draft={props.draft} />
            </Show>
        </>
    );
}

function LookStep(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    const set = props.draft.set;
    return (
        <>
            <Cards
                legend="When Civil opens"
                value={d().startup}
                options={STARTUP_OPTIONS.filter(o => o.value !== "page")}
                suggested={props.draft.pick("startup")?.value}
                onChange={v => set("startup", v)}
            />
            <Cards
                legend="Bookmarks bar"
                value={d().bookmarksBar}
                options={BAR_OPTIONS}
                suggested={props.draft.pick("bookmarksBar")?.value}
                reason={props.draft.pick("bookmarksBar")?.reason}
                onChange={v => set("bookmarksBar", v)}
            />
            <Cards
                legend="Motion"
                value={d().motion}
                options={MOTION_OPTIONS}
                suggested={props.draft.pick("motion")?.value}
                reason={props.draft.pick("motion")?.reason}
                onChange={v => set("motion", v)}
            />
        </>
    );
}

function HelpStep(props: { draft: SetupDraft }) {
    const d = () => props.draft.d();
    const set = props.draft.set;
    return (
        <>
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
        </>
    );
}

function Summary(props: { draft: SetupDraft }) {
    const rows = () => [
        ...browsingRows(props.draft.d(), props.draft.why),
        ...preferenceRows(props.draft.d(), props.draft.why),
    ];
    return (
        <dl class={s.summary}>
            <For each={rows()}>
                {row => (
                    <div class={s.summaryRow}>
                        <dt class={s.summaryName}>{row.name}</dt>
                        <dd class={s.summaryValue}>
                            {row.value}
                            <Show when={row.reason}>
                                <span class={s.suggested}>Picked for you</span>
                                <span class={s.why}>{row.reason}</span>
                            </Show>
                        </dd>
                    </div>
                )}
            </For>
        </dl>
    );
}

function WelcomeKeys(props: { flow: SetupFlow }) {
    return (
        <div class={s.keys}>
            <button
                type="button"
                class={s.next}
                onClick={() => props.flow.setPhase(0)}
            >
                Set up Civil
            </button>
            <button
                type="button"
                class={s.back}
                disabled={props.flow.waiting()}
                onClick={() => void props.flow.skipSetup()}
            >
                Pick for me
            </button>
        </div>
    );
}

function StepKeys(props: { flow: SetupFlow }) {
    const flow = () => props.flow;
    return (
        <Show
            when={flow().phase() !== "summary"}
            fallback={
                <button
                    type="button"
                    class={s.next}
                    disabled={flow().waiting()}
                    onClick={() => void flow().finish()}
                >
                    Start browsing
                </button>
            }
        >
            <button
                type="button"
                class={s.textKey}
                disabled={flow().waiting()}
                onClick={() => void flow().skipStep(flow().phase() as number)}
            >
                Skip this step
            </button>
            <button
                type="button"
                class={s.next}
                onClick={() => flow().nextStep(flow().phase() as number)}
            >
                Next
            </button>
        </Show>
    );
}

function SetupFooter(props: { flow: SetupFlow }) {
    return (
        <footer class={s.footer}>
            <Show
                when={props.flow.phase() !== "welcome"}
                fallback={<WelcomeKeys flow={props.flow} />}
            >
                <button
                    type="button"
                    class={s.back}
                    onClick={() => props.flow.back()}
                >
                    Back
                </button>
                <div class={s.footerEnd}>
                    <StepKeys flow={props.flow} />
                </div>
            </Show>
        </footer>
    );
}

function StepBody(props: { phase: Phase; draft: SetupDraft }) {
    return (
        <>
            <Show when={props.phase === 0}>
                <SearchStep draft={props.draft} />
            </Show>
            <Show when={props.phase === 1}>
                <ConnectionStep draft={props.draft} />
            </Show>
            <Show when={props.phase === 2}>
                <HistoryStep draft={props.draft} />
            </Show>
            <Show when={props.phase === 3}>
                <LookStep draft={props.draft} />
            </Show>
            <Show when={props.phase === 4}>
                <HelpStep draft={props.draft} />
            </Show>
            <Show when={props.phase === "summary"}>
                <Summary draft={props.draft} />
            </Show>
        </>
    );
}

function SetupTop(props: { flow: SetupFlow }) {
    return (
        <header class={s.top}>
            <Wordmark width={180} />
            <Show when={typeof props.flow.phase() === "number"}>
                <button
                    type="button"
                    class={s.textKey}
                    disabled={props.flow.waiting()}
                    onClick={() => void props.flow.skipSetup()}
                >
                    Skip setup
                </button>
            </Show>
        </header>
    );
}

export default function SetupPage() {
    const draft = useSetupDraft();
    const flow = useSetupFlow(draft);
    const phase = flow.phase;

    // Keyboard and screen reader users land on the new question.
    let heading: HTMLHeadingElement | undefined;
    let settled = false;
    createEffect(phase, () => {
        if (settled) heading?.focus();
        settled = true;
    });

    return (
        <main class={s.page}>
            <SetupTop flow={flow} />

            <section class={s.plate} aria-labelledby="setup-title">
                <Show when={typeof phase() === "number"}>
                    {/* Drawn only: "Step 2 of 5" below says the same in text. */}
                    <Progress phase={phase() as number} />
                </Show>

                <SetupHead phase={phase()} />

                <h1
                    id="setup-title"
                    class={s.title}
                    tabindex={-1}
                    ref={heading}
                >
                    {titleOf(phase())}
                </h1>
                <p class={s.lede}>{ledeOf(phase())}</p>

                <StepBody phase={phase()} draft={draft} />

                <Show when={flow.waiting()}>
                    <p class={s.busy} role="status">
                        Checking this device and network.
                    </p>
                </Show>

                <SetupFooter flow={flow} />
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

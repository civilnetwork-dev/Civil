import type { JSX } from "@solidjs/web";
import { createMemo, createSignal, For, onSettled, Show } from "solid-js";

import {
    historyApplyLimits,
    historyAutoLocate,
    historyClear,
    historyDeleteSite,
    historyGetAll,
    historyMoveTo,
    historyRankLocations,
    historySetFormat,
    type HistoryStatus,
    historyStatus,
    type MoveResult,
    onHistoryChange,
} from "~/api/history";
import {
    budgetFor,
    type HistoryLocation,
    type LocationReport,
} from "~/api/historyStorage";
import HistoryFullNotice from "~/components/HistoryFullNotice";
import { IconClose, IconSliders } from "~/components/icons";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import {
    ActionRow,
    ArmedKey,
    ChoiceRow,
    HostForm,
    type Option,
    Select,
    TextRow,
    ToggleRow,
    TraitList,
} from "~/components/SettingControls";
import {
    APPS_OPEN_OPTIONS,
    BAR_OPTIONS,
    checkDays,
    DAY_PRESETS,
    dayLabel,
    FORMAT_OPTIONS,
    LIMIT_OPTIONS,
    LOCATION_OPTIONS,
    MAX_OPTIONS,
    MOTION_OPTIONS,
    PLACE_NAMES,
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
import { onLsChange } from "~/lib/reactiveStorage";
import {
    getSetting,
    isSearchTemplate,
    isStartPage,
    onSite,
    resetSettings,
    type SettingKey,
    setSetting,
    type SettingValue,
    type TransportName,
    useSetting,
} from "~/lib/settings";
import { exportSettings, importSettings } from "~/lib/settingsTransfer";
import { lastTransportChoice, type TransportSource } from "~/lib/transport";

import * as schematic from "~/styles/schematic.css";
import * as c from "~/styles/SettingControls.css";
import * as s from "~/styles/SettingsPage.css";

const SECTIONS = [
    ["search", "Search"],
    ["connection", "Connection"],
    ["history", "History"],
    ["tabs", "Tabs and appearance"],
    ["privacy", "Privacy"],
    ["backup", "Backup"],
    ["setup", "Setup"],
] as const;

const SOURCE: Record<TransportSource, string> = {
    site: "your rule for that site",
    failover: "switched to after a page didn't load",
    default: "the default method",
    retry: "chosen on the error page",
};

const capital = (text: string) => text[0].toUpperCase() + text.slice(1);

function formatSize(units: number): string {
    if (!Number.isFinite(units)) return "plenty";
    if (units < 1024) return `${units} B`;
    if (units < 1024 ** 2) return `${Math.round(units / 1024)} KB`;
    if (units < 1024 ** 3) return `${(units / 1024 ** 2).toFixed(1)} MB`;
    return `${(units / 1024 ** 3).toFixed(1)} GB`;
}

const ms = (t: number) =>
    Number.isFinite(t) ? `${t < 10 ? t.toFixed(1) : Math.round(t)} ms` : "n/a";

const otherThan = (loc: HistoryLocation): HistoryLocation =>
    loc === "localstorage" ? "indexeddb" : "localstorage";

function Section(props: {
    id: string;
    title: string;
    /** Set between the title and the tablet, such as a notice. */
    before?: JSX.Element;
    children: JSX.Element;
}) {
    return (
        <section
            id={props.id}
            class={s.section}
            aria-labelledby={`${props.id}-title`}
        >
            <h2 id={`${props.id}-title`} class={s.sectionTitle}>
                {props.title}
            </h2>
            {props.before}
            <div class={s.tablet}>{props.children}</div>
        </section>
    );
}

/** What happened when history was asked to move to `to`. */
const moveNote = (result: MoveResult, to: HistoryLocation) =>
    result.ok
        ? `New pages are saved in ${PLACE_NAMES[to]} now.`
        : result.reason === "full"
          ? `History doesn't fit in ${PLACE_NAMES[to]} under the current space limit, so it stayed where it was.`
          : `History couldn't be moved to ${PLACE_NAMES[to]}, so it stayed where it was.`;

/** Where history lives, and how much of it there is, in a sentence. */
const statusSentence = (st: HistoryStatus, compressed: boolean) => {
    const pages = st.pages.localstorage + st.pages.indexeddb;
    const size = st.size.localstorage + st.size.indexeddb;
    const other = otherThan(st.writer);
    const split =
        st.pages[other] > 0
            ? ` ${st.pages[other].toLocaleString()} of them are in ${PLACE_NAMES[other]}.`
            : "";
    const where = `New pages are saved in ${PLACE_NAMES[st.writer]}.`;
    if (!pages) return `${where} History is empty.`;
    return `${where} History holds ${pages.toLocaleString()} ${pages === 1 ? "page" : "pages"} in ${formatSize(size)}, ${compressed ? "compressed" : "as plain JSON"}.${split}`;
};

type Save = <K extends SettingKey>(key: K, value: SettingValue<K>) => void;

/** Every option's traits side by side, so the choice is an informed one. */
function Compare<T extends string>(props: {
    label: string;
    options: readonly Option<T>[];
    traits: Record<T, Traits>;
}) {
    return (
        <div class={s.readout}>
            <ul class={s.compare} aria-label={props.label}>
                <For each={props.options}>
                    {option => (
                        <li>
                            <span class={s.readoutName}>{option.label}</span>
                            <TraitList traits={props.traits[option.value]} />
                        </li>
                    )}
                </For>
            </ul>
        </div>
    );
}

function useLastChoice() {
    const [lastChoice, setLastChoice] = createSignal(lastTransportChoice());
    onSettled(() =>
        onLsChange("civil:transport-last", () =>
            setLastChoice(lastTransportChoice()),
        ),
    );
    return lastChoice;
}

function TransportRule(props: {
    host: string;
    method: TransportName;
    onChange: (method: TransportName) => void;
    onRemove: () => void;
}) {
    return (
        <li class={s.ruleItem}>
            <span class={s.ruleHost}>{props.host}</span>
            <Select
                label={`Method for ${props.host}`}
                value={props.method}
                options={TRANSPORT_OPTIONS}
                onChange={value => props.onChange(value)}
            />
            <button
                type="button"
                class={s.ruleRemove}
                aria-label={`Remove the rule for ${props.host}`}
                onClick={() => props.onRemove()}
            >
                <IconClose size={14} />
            </button>
        </li>
    );
}

function TransportRules(props: { save: Save }) {
    const sites = useSetting("transportSites");
    const [newMethod, setNewMethod] = createSignal<TransportName>("libcurl");
    const siteList = () =>
        Object.entries(sites()).toSorted(([a], [b]) => a.localeCompare(b));

    const addRule = (host: string) =>
        props.save("transportSites", { ...sites(), [host]: newMethod() });

    const setRule = (host: string, method: TransportName) =>
        props.save("transportSites", { ...sites(), [host]: method });

    const removeRule = (host: string) => {
        const next = { ...sites() };
        delete next[host];
        props.save("transportSites", next);
    };

    return (
        <div class={s.rules}>
            <span class={s.rulesLabel}>Sites with their own method</span>
            <span class={s.rulesHint}>
                These sites always use the method set here, whatever the
                settings above say.
            </span>
            <Show when={siteList().length > 0}>
                <ul class={s.ruleList}>
                    <For each={siteList()}>
                        {([host, method]) => (
                            <TransportRule
                                host={host}
                                method={method}
                                onChange={value => setRule(host, value)}
                                onRemove={() => removeRule(host)}
                            />
                        )}
                    </For>
                </ul>
            </Show>
            <HostForm label="Site" submitLabel="Add site" onAdd={addRule}>
                <Select
                    label="Method for the new site"
                    value={newMethod()}
                    options={TRANSPORT_OPTIONS}
                    onChange={setNewMethod}
                />
            </HostForm>
        </div>
    );
}

function FailoverRows(props: { save: Save }) {
    const failover = useSetting("transportFailover");
    const remember = useSetting("transportRemember");
    const navTimeout = useSetting("navTimeout");
    return (
        <>
            <ToggleRow
                label="Switch methods when a page doesn't load"
                hint="Tries the next method once on its own. Turned off, you choose one on the error page instead. Never overrides a site's own method."
                checked={failover()}
                onChange={on => props.save("transportFailover", on)}
            />
            <ToggleRow
                label="Remember the method that worked"
                hint="Makes the method Civil switched to your default, so the next visit starts with it."
                checked={remember()}
                disabled={!failover()}
                onChange={on => props.save("transportRemember", on)}
            />
            <ChoiceRow
                label="Give up on a page after"
                hint="How long a page can take before Civil counts it as failed."
                value={navTimeout()}
                options={TIMEOUT_OPTIONS}
                onChange={value => props.save("navTimeout", value)}
            />
        </>
    );
}

/** How proxied pages are fetched, and what Civil does when one fails. */
function ConnectionSection(props: { save: Save }) {
    const transport = useSetting("transport");
    const wisp = useSetting("wispVersion");
    const lastChoice = useLastChoice();

    return (
        <Section id="connection" title="Connection">
            <ChoiceRow
                label="Default method"
                hint={
                    <>
                        {TRANSPORT_NOTES[transport()]}
                        <Show when={lastChoice()}>
                            {` The last site, ${lastChoice()!.host}, used ${lastChoice()!.transport} (${SOURCE[lastChoice()!.source]}).`}
                        </Show>
                    </>
                }
                value={transport()}
                options={TRANSPORT_OPTIONS}
                onChange={value => props.save("transport", value)}
            />
            <Compare
                label="How the methods compare"
                options={TRANSPORT_OPTIONS}
                traits={TRANSPORT_TRAITS}
            />
            <TransportRules save={props.save} />
            <ChoiceRow
                label="Wisp version"
                hint={WISP_NOTE}
                value={wisp()}
                options={WISP_OPTIONS}
                onChange={value => props.save("wispVersion", value)}
            />
            <Compare
                label="How the Wisp versions compare"
                options={WISP_OPTIONS}
                traits={WISP_TRAITS}
            />
            <FailoverRows save={props.save} />
        </Section>
    );
}

interface Page {
    save: Save;
    setNote: (note: string) => void;
}

function SearchSection(props: { save: Save }) {
    const search = useSetting("search");
    const searchTemplate = useSetting("searchTemplate");
    const suggestLive = useSetting("suggestLive");
    const suggestHistory = useSetting("suggestHistory");
    return (
        <Section id="search" title="Search">
            <ChoiceRow
                label="Search engine"
                hint="Where a search goes when what you type isn't a web address."
                value={search()}
                options={SEARCH_OPTIONS}
                onChange={value => props.save("search", value)}
            />
            <Show when={search() === "custom"}>
                <TextRow
                    label="Custom search address"
                    hint="Put %s where the search goes. Until this is set, searches use Google."
                    placeholder="https://example.com/search?q=%s"
                    type="url"
                    value={searchTemplate()}
                    check={value =>
                        isSearchTemplate(value)
                            ? null
                            : "Use a web address with %s where the search goes."
                    }
                    onCommit={value => props.save("searchTemplate", value)}
                />
            </Show>
            <ToggleRow
                label="Suggest searches as you type"
                hint="Sends what you type to Civil's server to fetch suggestions."
                checked={suggestLive()}
                onChange={on => props.save("suggestLive", on)}
            />
            <ToggleRow
                label="Suggest pages from your history"
                hint="Matches what you type in the address bar against pages you visited."
                checked={suggestHistory()}
                onChange={on => props.save("suggestHistory", on)}
            />
        </Section>
    );
}

const isCustomDays = () =>
    !(DAY_PRESETS as readonly number[]).includes(getSetting("historyDays"));

function useHistoryStatus() {
    const [status, setStatus] = createSignal<HistoryStatus | null>(null);
    const refresh = () => {
        void historyStatus().then(setStatus);
    };
    onSettled(() => {
        refresh();
        return onHistoryChange(refresh);
    });
    return { status, refresh };
}

function useHistoryControls(page: Page) {
    const { status, refresh } = useHistoryStatus();
    const [ranking, setRanking] = createSignal<{
        best: HistoryLocation;
        reports: LocationReport[];
    } | null>(null);
    const [busy, setBusy] = createSignal(false);
    const [customDays, setCustomDays] = createSignal(isCustomDays());

    const work = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
        } finally {
            setBusy(false);
            refresh();
        }
    };

    /** Puts history where `value` says, and says what happened. */
    const relocate = async (value: SettingValue<"historyLocation">) => {
        if (value !== "auto")
            return moveNote(await historyMoveTo(value), value);
        const result = await historyAutoLocate();
        setRanking(result);
        return moveNote(result.moved, result.best);
    };

    return {
        status,
        ranking,
        busy,
        customDays,
        setCustomDays,
        work,
        relocate,
        rank: () =>
            work(async () => {
                setRanking(await historyRankLocations());
            }),
        changeLimit: <K extends "historyDays" | "historyMax">(
            key: K,
            value: SettingValue<K>,
        ) => {
            page.save(key, value);
            void historyApplyLimits();
        },
    };
}

type HistoryControls = ReturnType<typeof useHistoryControls>;

function RankingReadout(props: { page: Page; hist: HistoryControls }) {
    const ranking = () => props.hist.ranking()!;
    const moveTo = (to: HistoryLocation) =>
        props.hist.work(async () => {
            props.page.setNote(moveNote(await historyMoveTo(to), to));
        });
    return (
        <div class={s.readout}>
            <ul class={s.readoutList}>
                <For each={ranking().reports}>
                    {r => (
                        <li class={s.numbers}>
                            <span class={s.readoutName}>
                                {capital(PLACE_NAMES[r.location])}
                            </span>
                            {r.available
                                ? `: ${formatSize(r.room)} of room, writes in ${ms(r.writeMs)}, reads in ${ms(r.readMs)}.`
                                : ": not available in this browser."}
                        </li>
                    )}
                </For>
            </ul>
            <Show
                when={ranking().best !== props.hist.status()?.writer}
                fallback="History is already in the best place."
            >
                {`${capital(PLACE_NAMES[ranking().best])} is the better place right now. `}
                <button
                    type="button"
                    class={c.key}
                    disabled={props.hist.busy()}
                    onClick={() => void moveTo(ranking().best)}
                >
                    Move history there
                </button>
            </Show>
        </div>
    );
}

function HistoryStorageRows(props: { page: Page; hist: HistoryControls }) {
    const location = useSetting("historyLocation");
    const format = useSetting("historyFormat");

    const changeLocation = (value: SettingValue<"historyLocation">) =>
        props.hist.work(async () => {
            props.page.save("historyLocation", value);
            props.page.setNote(await props.hist.relocate(value));
        });

    const changeFormat = (value: SettingValue<"historyFormat">) =>
        props.hist.work(async () => {
            const ok = await historySetFormat(value);
            props.page.setNote(
                ok
                    ? ""
                    : "History wouldn't fit in that format under the current space limit, so nothing changed.",
            );
        });

    return (
        <>
            <ChoiceRow
                label="Where to save it"
                hint="Local storage is quick but small, about 5 MB shared with your bookmarks and extensions. IndexedDB holds far more. Automatic picks whichever has room and is fastest on this device. Changing this moves your history."
                value={location()}
                options={LOCATION_OPTIONS}
                disabled={props.hist.busy()}
                onChange={value => void changeLocation(value)}
            >
                <button
                    type="button"
                    class={c.key}
                    disabled={props.hist.busy()}
                    onClick={() => void props.hist.rank()}
                >
                    Check now
                </button>
            </ChoiceRow>
            <Show when={props.hist.ranking()}>
                <RankingReadout page={props.page} hist={props.hist} />
            </Show>
            <ChoiceRow
                label="Format"
                hint="Compressed history takes a fraction of the space and costs a little time on every visit."
                value={format()}
                options={FORMAT_OPTIONS}
                disabled={props.hist.busy()}
                onChange={value => void changeFormat(value)}
            />
        </>
    );
}

const DAY_OPTIONS = [
    ...DAY_PRESETS.map(d => ({ value: d as number, label: dayLabel(d) })),
    { value: -1, label: "Custom" },
];

function HistoryLimitRows(props: { page: Page; hist: HistoryControls }) {
    const limit = useSetting("historyLimitKb");
    const whenFull = useSetting("historyWhenFull");
    const days = useSetting("historyDays");
    const max = useSetting("historyMax");
    return (
        <>
            <ChoiceRow
                label="Space for history"
                hint="Automatic allows 2 MB in local storage, leaving room for everything else there, and whatever the browser allows in IndexedDB. Takes effect with the next page you visit."
                value={limit()}
                options={LIMIT_OPTIONS}
                onChange={value => props.page.save("historyLimitKb", value)}
            />
            <ChoiceRow
                label="When space runs out"
                hint={WHEN_FULL_NOTES[whenFull()]}
                value={whenFull()}
                options={WHEN_FULL_OPTIONS}
                onChange={value => props.page.save("historyWhenFull", value)}
            />
            <ChoiceRow
                label="Delete pages older than"
                hint="Keeps history short enough that space never runs out."
                value={props.hist.customDays() ? -1 : days()}
                options={DAY_OPTIONS}
                onChange={value => {
                    props.hist.setCustomDays(value === -1);
                    if (value !== -1)
                        props.hist.changeLimit("historyDays", value);
                }}
            />
            <Show when={props.hist.customDays()}>
                <TextRow
                    label="Number of days"
                    type="number"
                    value={days() ? String(days()) : ""}
                    placeholder="45"
                    check={checkDays}
                    onCommit={value =>
                        props.hist.changeLimit("historyDays", Number(value))
                    }
                />
            </Show>
            <ChoiceRow
                label="Keep at most"
                hint="The oldest pages go first."
                value={max()}
                options={MAX_OPTIONS}
                onChange={value => props.hist.changeLimit("historyMax", value)}
            />
        </>
    );
}

function useLeftOut(page: Page) {
    const excluded = useSetting("historyExclude");

    /** A site just left out that already has pages saved. */
    const [leftOut, setLeftOut] = createSignal<{
        site: string;
        pages: number;
    } | null>(null);

    const excludeSite = async (site: string) => {
        if (!excluded().includes(site)) {
            page.save("historyExclude", [...excluded(), site].toSorted());
        }
        const pages = (await historyGetAll()).filter(e =>
            onSite(e.url, site),
        ).length;
        setLeftOut(pages ? { site, pages } : null);
    };

    const deleteLeftOut = async (site: string) => {
        const removed = await historyDeleteSite(site);
        setLeftOut(null);
        page.setNote(
            `Deleted ${removed.toLocaleString()} ${removed === 1 ? "page" : "pages"} from ${site}.`,
        );
    };

    return { excluded, leftOut, excludeSite, deleteLeftOut };
}

function LeftOutOffer(props: {
    leftOut: { site: string; pages: number };
    onDelete: (site: string) => void;
}) {
    const one = () => props.leftOut.pages === 1;
    return (
        <p class={s.offer}>
            {`${props.leftOut.pages.toLocaleString()} ${one() ? "page" : "pages"} from ${props.leftOut.site} ${one() ? "is" : "are"} already saved. `}
            <button
                type="button"
                class={c.key}
                onClick={() => props.onDelete(props.leftOut.site)}
            >
                Delete {one() ? "it" : "them"}
            </button>
        </p>
    );
}

function ExcludedSites(props: { page: Page }) {
    const sites = useLeftOut(props.page);
    return (
        <div class={s.rules}>
            <span class={s.rulesLabel}>Don't save these sites</span>
            <span class={s.rulesHint}>
                Pages from these sites, and from their subdomains, never go into
                history.
            </span>
            <Show when={sites.excluded().length > 0}>
                <ul class={s.ruleList}>
                    <For each={sites.excluded()}>
                        {site => (
                            <li class={s.ruleItem}>
                                <span class={s.ruleHost}>{site}</span>
                                <button
                                    type="button"
                                    class={s.ruleRemove}
                                    aria-label={`Save ${site} in history again`}
                                    onClick={() =>
                                        props.page.save(
                                            "historyExclude",
                                            sites
                                                .excluded()
                                                .filter(x => x !== site),
                                        )
                                    }
                                >
                                    <IconClose size={14} />
                                </button>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
            <HostForm
                label="Site to leave out of history"
                submitLabel="Leave out"
                onAdd={site => void sites.excludeSite(site)}
            />
            <Show when={sites.leftOut()}>
                <LeftOutOffer
                    leftOut={sites.leftOut()!}
                    onDelete={site => void sites.deleteLeftOut(site)}
                />
            </Show>
        </div>
    );
}

function HistoryMeter(props: { hist: HistoryControls }) {
    const limit = useSetting("historyLimitKb");

    // The meter reads the space limit live, so changing it moves the bar
    // without waiting for the next visit to rewrite history.
    const meter = createMemo(() => {
        const st = props.hist.status();
        if (!st) return null;
        const capacity = Math.min(st.quota, budgetFor(st.writer, limit()));
        if (!Number.isFinite(capacity) || capacity <= 0) return null;
        const used = st.size[st.writer];
        const ratio = Math.min(used / capacity, 1);
        return { where: st.writer, used, capacity, ratio, full: ratio >= 0.8 };
    });

    return (
        <Show when={meter()}>
            <div class={s.meter}>
                <p class={[s.meterLabel, s.numbers]}>
                    <span>{capital(PLACE_NAMES[meter()!.where])}</span>
                    <span>
                        {`${meter()!.full ? "Nearly full: " : ""}${formatSize(meter()!.used)} of ${formatSize(meter()!.capacity)}`}
                    </span>
                </p>
                {/* The label above says it in words; the bar repeats it for
                    the eye, so it stays out of the a11y tree. */}
                <div
                    class={s.meterTrack}
                    data-full={meter()!.full ? "" : undefined}
                    aria-hidden="true"
                >
                    <div
                        class={s.meterFill}
                        style={{
                            // A sliver stays visible however small the share:
                            // an empty-looking bar would say nothing is
                            // stored.
                            width: meter()!.used
                                ? `max(4px, ${meter()!.ratio * 100}%)`
                                : "0",
                        }}
                    />
                </div>
            </div>
        </Show>
    );
}

function HistorySection(props: { page: Page; hist: HistoryControls }) {
    const historyEnabled = useSetting("historyEnabled");
    const format = useSetting("historyFormat");
    return (
        <Section id="history" title="History" before={<HistoryFullNotice />}>
            <p class={[s.summary, s.numbers]}>
                {props.hist.status()
                    ? statusSentence(
                          props.hist.status()!,
                          format() === "compressed",
                      )
                    : "Reading history."}
            </p>
            <HistoryMeter hist={props.hist} />
            <ToggleRow
                label="Save history"
                hint="Turned off, pages you visit aren't added. What's already saved stays."
                checked={historyEnabled()}
                onChange={on => props.page.save("historyEnabled", on)}
            />
            <HistoryStorageRows page={props.page} hist={props.hist} />
            <HistoryLimitRows page={props.page} hist={props.hist} />
            <ExcludedSites page={props.page} />
            <ActionRow
                label="Clear history"
                hint="Deletes every saved page, wherever it's stored."
            >
                <ArmedKey
                    label="Clear all"
                    armedLabel="Click again to delete"
                    onConfirm={() =>
                        void historyClear().then(() =>
                            props.page.setNote("History cleared."),
                        )
                    }
                />
            </ActionRow>
        </Section>
    );
}

function TabsSection(props: { save: Save }) {
    const startup = useSetting("startup");
    const startupUrl = useSetting("startupUrl");
    const bookmarksBar = useSetting("bookmarksBar");
    const appsOpenIn = useSetting("appsOpenIn");
    const motion = useSetting("motion");
    return (
        <Section id="tabs" title="Tabs and appearance">
            <ChoiceRow
                label="When Civil opens"
                value={startup()}
                options={STARTUP_OPTIONS}
                onChange={value => props.save("startup", value)}
            />
            <Show when={startup() === "page"}>
                <TextRow
                    label="Page to open"
                    placeholder="example.com"
                    value={startupUrl()}
                    check={value =>
                        isStartPage(value)
                            ? null
                            : "Enter a web address, like example.com."
                    }
                    onCommit={value => props.save("startupUrl", value)}
                />
            </Show>
            <ChoiceRow
                label="Bookmarks bar"
                value={bookmarksBar()}
                options={BAR_OPTIONS}
                onChange={value => props.save("bookmarksBar", value)}
            />
            <ChoiceRow
                label="Open apps in"
                hint="Where a site you pick on the Apps page opens."
                value={appsOpenIn()}
                options={APPS_OPEN_OPTIONS}
                onChange={value => props.save("appsOpenIn", value)}
            />
            <ChoiceRow
                label="Motion"
                hint="Reduce motion stops Civil's animations even when this device doesn't ask for that."
                value={motion()}
                options={MOTION_OPTIONS}
                onChange={value => props.save("motion", value)}
            />
        </Section>
    );
}

function PrivacySection(props: { save: Save }) {
    const filterDetect = useSetting("filterDetect");
    const analytics = useSetting("analytics");
    const ads = useSetting("ads");
    return (
        <Section id="privacy" title="Privacy">
            <ToggleRow
                label="Check for filters when Civil opens"
                hint="Looks for filter extensions such as GoGuardian so Civil can warn you about them. Filter check still runs when you open it."
                checked={filterDetect()}
                onChange={on => props.save("filterDetect", on)}
            />
            <ToggleRow
                label="Share usage analytics"
                hint="Sends how you use Civil to its analytics service, PostHog, including pages viewed, clicks and session recordings, so problems get found and fixed. Also looks up your school district from your approximate location. Turned off, PostHog stops at once."
                checked={analytics()}
                onChange={on => props.save("analytics", on)}
            />
            <ToggleRow
                label="Show ads"
                hint="Ads keep Civil free and open source. Turned off, the browser doesn't load its ad scripts, starting the next time Civil opens."
                checked={ads()}
                onChange={on => props.save("ads", on)}
            />
        </Section>
    );
}

function download() {
    const url = URL.createObjectURL(
        new Blob([exportSettings()], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "civil-settings.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copySettings(setNote: (note: string) => void) {
    try {
        await navigator.clipboard.writeText(exportSettings());
        setNote("Settings copied. Paste them somewhere safe.");
    } catch {
        setNote(
            "This browser didn't allow copying. Download the file instead.",
        );
    }
}

function useRestore(page: Page, hist: HistoryControls) {
    const [pasting, setPasting] = createSignal(false);

    const restore = (text: string) => {
        const before = getSetting("historyLocation");
        const result = importSettings(text);
        if (!result.ok) {
            page.setNote(result.reason);
            return;
        }
        setPasting(false);
        hist.setCustomDays(isCustomDays());
        const skipped = result.skipped.length
            ? ` Skipped ${result.skipped.length} this version of Civil doesn't recognise.`
            : "";
        const restored = `Restored ${result.applied.length} ${result.applied.length === 1 ? "setting" : "settings"}.${skipped}`;
        page.setNote(restored);
        // Where history is saved is a move, not just a value.
        const after = getSetting("historyLocation");
        if (after !== before) {
            void hist.work(async () => {
                page.setNote(`${restored} ${await hist.relocate(after)}`);
            });
        }
    };

    return { pasting, setPasting, restore };
}

function RestoreRow(props: { backup: ReturnType<typeof useRestore> }) {
    let fileInput: HTMLInputElement | undefined;
    return (
        <ActionRow
            label="Restore settings"
            hint="From a file or text saved here before. Anything this version of Civil doesn't recognise is skipped."
        >
            <button
                type="button"
                class={c.key}
                onClick={() => fileInput?.click()}
            >
                Choose file
            </button>
            <input
                ref={fileInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={e => {
                    const file = e.currentTarget.files?.[0];
                    e.currentTarget.value = "";
                    if (file) void file.text().then(props.backup.restore);
                }}
            />
            <button
                type="button"
                class={c.key}
                aria-expanded={props.backup.pasting() ? "true" : "false"}
                onClick={() => props.backup.setPasting(!props.backup.pasting())}
            >
                Paste text
            </button>
        </ActionRow>
    );
}

function PasteBox(props: { onRestore: (text: string) => void }) {
    let pasteArea: HTMLTextAreaElement | undefined;
    return (
        <div class={s.paste}>
            <textarea
                ref={pasteArea}
                class={c.area}
                aria-label="Settings text"
                placeholder='{"format": "civil-settings", ...}'
                spellcheck={false}
            />
            <button
                type="button"
                class={c.key}
                onClick={() => props.onRestore(pasteArea?.value ?? "")}
            >
                Restore
            </button>
        </div>
    );
}

function BackupSection(props: { page: Page; hist: HistoryControls }) {
    const backup = useRestore(props.page, props.hist);
    return (
        <Section id="backup" title="Backup">
            <ActionRow
                label="Save your settings"
                hint="As a file, or as text to keep somewhere safe, for a Chromebook that clears itself at sign-out or for another browser. History, bookmarks and tabs aren't included."
            >
                <button type="button" class={c.key} onClick={download}>
                    Download file
                </button>
                <button
                    type="button"
                    class={c.key}
                    onClick={() => void copySettings(props.page.setNote)}
                >
                    Copy as text
                </button>
            </ActionRow>
            <RestoreRow backup={backup} />
            <Show when={backup.pasting()}>
                <PasteBox onRestore={backup.restore} />
            </Show>
        </Section>
    );
}

function SetupSection(props: { page: Page; hist: HistoryControls }) {
    return (
        <Section id="setup" title="Setup">
            <ActionRow
                label="Run setup again"
                hint="Answer the first-run questions again. Your history, bookmarks and tabs stay."
            >
                <button
                    type="button"
                    class={c.key}
                    onClick={() => {
                        (window.top ?? window).location.href = "/setup";
                    }}
                >
                    Start setup
                </button>
            </ActionRow>
            <ActionRow
                label="Reset all settings"
                hint="Puts every setting on this page back to its default. History, bookmarks and tabs aren't touched."
            >
                <ArmedKey
                    label="Reset settings"
                    armedLabel="Click again to reset"
                    onConfirm={() => {
                        resetSettings();
                        props.hist.setCustomDays(false);
                        props.page.setNote(
                            "Every setting is back to its default.",
                        );
                    }}
                />
            </ActionRow>
        </Section>
    );
}

export default function SettingsPage() {
    const [note, setNote] = createSignal("");
    const save = <K extends SettingKey>(key: K, value: SettingValue<K>) => {
        if (!setSetting(key, value)) {
            setNote(
                "That change didn't save. This browser's storage is full or blocked.",
            );
        }
    };
    const page: Page = { save, setNote };
    const hist = useHistoryControls(page);

    return (
        <Sheet>
            <TitleBlock title="Settings" icon={IconSliders} tint="stone" />
            <p class={s.status} role="status">
                {note()}
            </p>

            <nav class={s.jump} aria-label="Settings sections">
                <For each={SECTIONS}>
                    {([id, title]) => (
                        <a class={schematic.chip} href={`#${id}`}>
                            {title}
                        </a>
                    )}
                </For>
            </nav>

            <SearchSection save={save} />
            <ConnectionSection save={save} />
            <HistorySection page={page} hist={hist} />
            <TabsSection save={save} />
            <PrivacySection save={save} />
            <BackupSection page={page} hist={hist} />
            <SetupSection page={page} hist={hist} />
        </Sheet>
    );
}

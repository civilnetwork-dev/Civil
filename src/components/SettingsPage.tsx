import type { JSX } from "@solidjs/web";
import { createSignal, For, onSettled, Show } from "solid-js";

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
import type { HistoryLocation, LocationReport } from "~/api/historyStorage";
import HistoryFullNotice from "~/components/HistoryFullNotice";
import { IconClose, IconSliders } from "~/components/icons";
import Sheet from "~/components/schematic/Sheet";
import TitleBlock from "~/components/schematic/TitleBlock";
import {
    ActionRow,
    ArmedKey,
    ChoiceRow,
    HostForm,
    Select,
    TextRow,
    ToggleRow,
} from "~/components/SettingControls";
import {
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
    TRANSPORT_NOTES,
    TRANSPORT_OPTIONS,
    WHEN_FULL_NOTES,
    WHEN_FULL_OPTIONS,
    WISP_NOTE,
    WISP_OPTIONS,
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
    auto: "picked automatically",
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

export default function SettingsPage() {
    const [note, setNote] = createSignal("");
    const save = <K extends SettingKey>(key: K, value: SettingValue<K>) => {
        if (!setSetting(key, value)) {
            setNote(
                "That change didn't save. This browser's storage is full or blocked.",
            );
        }
    };

    const search = useSetting("search");
    const searchTemplate = useSetting("searchTemplate");
    const suggestLive = useSetting("suggestLive");
    const suggestHistory = useSetting("suggestHistory");
    const transportAuto = useSetting("transportAuto");
    const transport = useSetting("transport");
    const sites = useSetting("transportSites");
    const failover = useSetting("transportFailover");
    const remember = useSetting("transportRemember");
    const navTimeout = useSetting("navTimeout");
    const historyEnabled = useSetting("historyEnabled");
    const location = useSetting("historyLocation");
    const format = useSetting("historyFormat");
    const limit = useSetting("historyLimitKb");
    const whenFull = useSetting("historyWhenFull");
    const days = useSetting("historyDays");
    const max = useSetting("historyMax");
    const startup = useSetting("startup");
    const startupUrl = useSetting("startupUrl");
    const bookmarksBar = useSetting("bookmarksBar");
    const motion = useSetting("motion");
    const compatReports = useSetting("compatReports");
    const filterDetect = useSetting("filterDetect");
    const wisp = useSetting("wispVersion");
    const excluded = useSetting("historyExclude");
    const analytics = useSetting("analytics");
    const ads = useSetting("ads");

    /* Connection */

    const [lastChoice, setLastChoice] = createSignal(lastTransportChoice());
    onSettled(() =>
        onLsChange("civil:transport-last", () =>
            setLastChoice(lastTransportChoice()),
        ),
    );

    const [newMethod, setNewMethod] = createSignal<TransportName>("libcurl");
    const siteList = () =>
        Object.entries(sites()).toSorted(([a], [b]) => a.localeCompare(b));

    const addRule = (host: string) =>
        save("transportSites", { ...sites(), [host]: newMethod() });

    const setRule = (host: string, method: TransportName) =>
        save("transportSites", { ...sites(), [host]: method });

    const removeRule = (host: string) => {
        const next = { ...sites() };
        delete next[host];
        save("transportSites", next);
    };

    /* History */

    const [status, setStatus] = createSignal<HistoryStatus | null>(null);
    const [ranking, setRanking] = createSignal<{
        best: HistoryLocation;
        reports: LocationReport[];
    } | null>(null);
    const [busy, setBusy] = createSignal(false);

    const refresh = () => {
        void historyStatus().then(setStatus);
    };
    onSettled(() => {
        refresh();
        return onHistoryChange(refresh);
    });

    const work = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
        } finally {
            setBusy(false);
            refresh();
        }
    };

    const moveNote = (result: MoveResult, to: HistoryLocation) =>
        result.ok
            ? `New pages are saved in ${PLACE_NAMES[to]} now.`
            : result.reason === "full"
              ? `History doesn't fit in ${PLACE_NAMES[to]} under the current space limit, so it stayed where it was.`
              : `History couldn't be moved to ${PLACE_NAMES[to]}, so it stayed where it was.`;

    /** Puts history where `value` says, and says what happened. */
    const relocate = async (value: SettingValue<"historyLocation">) => {
        if (value !== "auto")
            return moveNote(await historyMoveTo(value), value);
        const result = await historyAutoLocate();
        setRanking(result);
        return moveNote(result.moved, result.best);
    };

    const changeLocation = (value: SettingValue<"historyLocation">) =>
        work(async () => {
            save("historyLocation", value);
            setNote(await relocate(value));
        });

    const moveTo = (to: HistoryLocation) =>
        work(async () => {
            setNote(moveNote(await historyMoveTo(to), to));
        });

    const rank = () =>
        work(async () => {
            setRanking(await historyRankLocations());
        });

    const changeFormat = (value: SettingValue<"historyFormat">) =>
        work(async () => {
            const ok = await historySetFormat(value);
            setNote(
                ok
                    ? ""
                    : "History wouldn't fit in that format under the current space limit, so nothing changed.",
            );
        });

    const changeLimit = <K extends "historyDays" | "historyMax">(
        key: K,
        value: SettingValue<K>,
    ) => {
        save(key, value);
        void historyApplyLimits();
    };

    const [customDays, setCustomDays] = createSignal(
        !(DAY_PRESETS as readonly number[]).includes(getSetting("historyDays")),
    );
    const dayOptions = [
        ...DAY_PRESETS.map(d => ({ value: d as number, label: dayLabel(d) })),
        { value: -1, label: "Custom" },
    ];

    /** A site just left out that already has pages saved. */
    const [leftOut, setLeftOut] = createSignal<{
        site: string;
        pages: number;
    } | null>(null);

    const excludeSite = async (site: string) => {
        if (!excluded().includes(site)) {
            save("historyExclude", [...excluded(), site].toSorted());
        }
        const pages = (await historyGetAll()).filter(e =>
            onSite(e.url, site),
        ).length;
        setLeftOut(pages ? { site, pages } : null);
    };

    const deleteLeftOut = async (site: string) => {
        const removed = await historyDeleteSite(site);
        setLeftOut(null);
        setNote(
            `Deleted ${removed.toLocaleString()} ${removed === 1 ? "page" : "pages"} from ${site}.`,
        );
    };

    /* Backup */

    const [pasting, setPasting] = createSignal(false);
    let fileInput: HTMLInputElement | undefined;
    let pasteArea: HTMLTextAreaElement | undefined;

    const download = () => {
        const url = URL.createObjectURL(
            new Blob([exportSettings()], { type: "application/json" }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = "civil-settings.json";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(exportSettings());
            setNote("Settings copied. Paste them somewhere safe.");
        } catch {
            setNote(
                "This browser didn't allow copying. Download the file instead.",
            );
        }
    };

    const restore = (text: string) => {
        const before = getSetting("historyLocation");
        const result = importSettings(text);
        if (!result.ok) {
            setNote(result.reason);
            return;
        }
        setPasting(false);
        setCustomDays(
            !(DAY_PRESETS as readonly number[]).includes(
                getSetting("historyDays"),
            ),
        );
        const skipped = result.skipped.length
            ? ` Skipped ${result.skipped.length} this version of Civil doesn't recognise.`
            : "";
        const restored = `Restored ${result.applied.length} ${result.applied.length === 1 ? "setting" : "settings"}.${skipped}`;
        setNote(restored);
        // Where history is saved is a move, not just a value.
        const after = getSetting("historyLocation");
        if (after !== before) {
            void work(async () => {
                setNote(`${restored} ${await relocate(after)}`);
            });
        }
    };

    const statusSentence = (st: HistoryStatus) => {
        const pages = st.pages.localstorage + st.pages.indexeddb;
        const size = st.size.localstorage + st.size.indexeddb;
        const other = otherThan(st.writer);
        const split =
            st.pages[other] > 0
                ? ` ${st.pages[other].toLocaleString()} of them are in ${PLACE_NAMES[other]}.`
                : "";
        const where = `New pages are saved in ${PLACE_NAMES[st.writer]}.`;
        if (!pages) return `${where} History is empty.`;
        return `${where} History holds ${pages.toLocaleString()} ${pages === 1 ? "page" : "pages"} in ${formatSize(size)}, ${format() === "compressed" ? "compressed" : "as plain JSON"}.${split}`;
    };

    return (
        <Sheet>
            <TitleBlock title="Settings" icon={IconSliders} tint="stone" />
            <p class={s.status} role="status">
                {note()}
            </p>

            <nav class={s.jump} aria-label="Settings sections">
                <For each={SECTIONS}>
                    {([id, title]) => (
                        <a class={s.jumpLink} href={`#${id}`}>
                            {title}
                        </a>
                    )}
                </For>
            </nav>

            <Section id="search" title="Search">
                <ChoiceRow
                    label="Search engine"
                    hint="Where a search goes when what you type isn't a web address."
                    value={search()}
                    options={SEARCH_OPTIONS}
                    onChange={value => save("search", value)}
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
                        onCommit={value => save("searchTemplate", value)}
                    />
                </Show>
                <ToggleRow
                    label="Suggest searches as you type"
                    hint="Sends what you type to Civil's server to fetch suggestions."
                    checked={suggestLive()}
                    onChange={on => save("suggestLive", on)}
                />
                <ToggleRow
                    label="Suggest pages from your history"
                    hint="Matches what you type in the address bar against pages you visited."
                    checked={suggestHistory()}
                    onChange={on => save("suggestHistory", on)}
                />
            </Section>

            <Section id="connection" title="Connection">
                <ToggleRow
                    label="Pick a method for each site automatically"
                    hint={
                        <>
                            Civil tests each new site and uses the method it
                            loads best with. Turned off, every site uses the
                            default method and addresses aren't sent for
                            testing.
                            <Show when={lastChoice()}>
                                {` The last site, ${lastChoice()!.host}, used ${lastChoice()!.transport} (${SOURCE[lastChoice()!.source]}).`}
                            </Show>
                        </>
                    }
                    checked={transportAuto()}
                    onChange={on => save("transportAuto", on)}
                />
                <ChoiceRow
                    label="Default method"
                    hint={TRANSPORT_NOTES[transport()]}
                    value={transport()}
                    options={TRANSPORT_OPTIONS}
                    onChange={value => save("transport", value)}
                />
                <div class={s.rules}>
                    <span class={s.rulesLabel}>
                        Sites with their own method
                    </span>
                    <span class={s.rulesHint}>
                        These sites always use the method set here, whatever the
                        settings above say.
                    </span>
                    <Show when={siteList().length > 0}>
                        <ul class={s.ruleList}>
                            <For each={siteList()}>
                                {([host, method]) => (
                                    <li class={s.ruleItem}>
                                        <span class={s.ruleHost}>{host}</span>
                                        <Select
                                            label={`Method for ${host}`}
                                            value={method}
                                            options={TRANSPORT_OPTIONS}
                                            onChange={value =>
                                                setRule(host, value)
                                            }
                                        />
                                        <button
                                            type="button"
                                            class={s.ruleRemove}
                                            aria-label={`Remove the rule for ${host}`}
                                            onClick={() => removeRule(host)}
                                        >
                                            <IconClose size={14} />
                                        </button>
                                    </li>
                                )}
                            </For>
                        </ul>
                    </Show>
                    <HostForm
                        label="Site"
                        submitLabel="Add site"
                        onAdd={addRule}
                    >
                        <Select
                            label="Method for the new site"
                            value={newMethod()}
                            options={TRANSPORT_OPTIONS}
                            onChange={setNewMethod}
                        />
                    </HostForm>
                </div>
                <ChoiceRow
                    label="Wisp version"
                    hint={WISP_NOTE}
                    value={wisp()}
                    options={WISP_OPTIONS}
                    onChange={value => save("wispVersion", value)}
                />
                <ToggleRow
                    label="Switch methods when a page doesn't load"
                    hint="Tries the next method once on its own. Turned off, you choose one on the error page instead. Never overrides a site's own method."
                    checked={failover()}
                    onChange={on => save("transportFailover", on)}
                />
                <ToggleRow
                    label="Remember the method that worked"
                    hint="Makes the method Civil switched to your default, so the next visit starts with it."
                    checked={remember()}
                    disabled={!failover()}
                    onChange={on => save("transportRemember", on)}
                />
                <ChoiceRow
                    label="Give up on a page after"
                    hint="How long a page can take before Civil counts it as failed."
                    value={navTimeout()}
                    options={TIMEOUT_OPTIONS}
                    onChange={value => save("navTimeout", value)}
                />
            </Section>

            <Section
                id="history"
                title="History"
                before={<HistoryFullNotice />}
            >
                <p class={[s.summary, s.numbers]}>
                    {status() ? statusSentence(status()!) : "Reading history."}
                </p>
                <ToggleRow
                    label="Save history"
                    hint="Turned off, pages you visit aren't added. What's already saved stays."
                    checked={historyEnabled()}
                    onChange={on => save("historyEnabled", on)}
                />
                <ChoiceRow
                    label="Where to save it"
                    hint="Local storage is quick but small, about 5 MB shared with your bookmarks and extensions. IndexedDB holds far more. Automatic picks whichever has room and is fastest on this device. Changing this moves your history."
                    value={location()}
                    options={LOCATION_OPTIONS}
                    disabled={busy()}
                    onChange={value => void changeLocation(value)}
                >
                    <button
                        type="button"
                        class={c.key}
                        disabled={busy()}
                        onClick={() => void rank()}
                    >
                        Check now
                    </button>
                </ChoiceRow>
                <Show when={ranking()}>
                    <div class={s.readout}>
                        <ul class={s.readoutList}>
                            <For each={ranking()!.reports}>
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
                            when={ranking()!.best !== status()?.writer}
                            fallback="History is already in the best place."
                        >
                            {`${capital(PLACE_NAMES[ranking()!.best])} is the better place right now. `}
                            <button
                                type="button"
                                class={c.key}
                                disabled={busy()}
                                onClick={() => void moveTo(ranking()!.best)}
                            >
                                Move history there
                            </button>
                        </Show>
                    </div>
                </Show>
                <ChoiceRow
                    label="Format"
                    hint="Compressed history takes a fraction of the space and costs a little time on every visit."
                    value={format()}
                    options={FORMAT_OPTIONS}
                    disabled={busy()}
                    onChange={value => void changeFormat(value)}
                />
                <ChoiceRow
                    label="Space for history"
                    hint="Automatic allows 2 MB in local storage, leaving room for everything else there, and whatever the browser allows in IndexedDB. Takes effect with the next page you visit."
                    value={limit()}
                    options={LIMIT_OPTIONS}
                    onChange={value => save("historyLimitKb", value)}
                />
                <ChoiceRow
                    label="When space runs out"
                    hint={WHEN_FULL_NOTES[whenFull()]}
                    value={whenFull()}
                    options={WHEN_FULL_OPTIONS}
                    onChange={value => save("historyWhenFull", value)}
                />
                <ChoiceRow
                    label="Delete pages older than"
                    hint="Keeps history short enough that space never runs out."
                    value={customDays() ? -1 : days()}
                    options={dayOptions}
                    onChange={value => {
                        setCustomDays(value === -1);
                        if (value !== -1) changeLimit("historyDays", value);
                    }}
                />
                <Show when={customDays()}>
                    <TextRow
                        label="Number of days"
                        type="number"
                        value={days() ? String(days()) : ""}
                        placeholder="45"
                        check={checkDays}
                        onCommit={value =>
                            changeLimit("historyDays", Number(value))
                        }
                    />
                </Show>
                <ChoiceRow
                    label="Keep at most"
                    hint="The oldest pages go first."
                    value={max()}
                    options={MAX_OPTIONS}
                    onChange={value => changeLimit("historyMax", value)}
                />
                <div class={s.rules}>
                    <span class={s.rulesLabel}>Don't save these sites</span>
                    <span class={s.rulesHint}>
                        Pages from these sites, and from their subdomains, never
                        go into history.
                    </span>
                    <Show when={excluded().length > 0}>
                        <ul class={s.ruleList}>
                            <For each={excluded()}>
                                {site => (
                                    <li class={s.ruleItem}>
                                        <span class={s.ruleHost}>{site}</span>
                                        <button
                                            type="button"
                                            class={s.ruleRemove}
                                            aria-label={`Save ${site} in history again`}
                                            onClick={() =>
                                                save(
                                                    "historyExclude",
                                                    excluded().filter(
                                                        x => x !== site,
                                                    ),
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
                        onAdd={site => void excludeSite(site)}
                    />
                    <Show when={leftOut()}>
                        <p class={s.offer}>
                            {`${leftOut()!.pages.toLocaleString()} ${leftOut()!.pages === 1 ? "page" : "pages"} from ${leftOut()!.site} ${leftOut()!.pages === 1 ? "is" : "are"} already saved. `}
                            <button
                                type="button"
                                class={c.key}
                                onClick={() =>
                                    void deleteLeftOut(leftOut()!.site)
                                }
                            >
                                Delete {leftOut()!.pages === 1 ? "it" : "them"}
                            </button>
                        </p>
                    </Show>
                </div>
                <ActionRow
                    label="Clear history"
                    hint="Deletes every saved page, wherever it's stored."
                >
                    <ArmedKey
                        label="Clear all"
                        armedLabel="Click again to delete"
                        onConfirm={() =>
                            void historyClear().then(() =>
                                setNote("History cleared."),
                            )
                        }
                    />
                </ActionRow>
            </Section>

            <Section id="tabs" title="Tabs and appearance">
                <ChoiceRow
                    label="When Civil opens"
                    value={startup()}
                    options={STARTUP_OPTIONS}
                    onChange={value => save("startup", value)}
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
                        onCommit={value => save("startupUrl", value)}
                    />
                </Show>
                <ChoiceRow
                    label="Bookmarks bar"
                    value={bookmarksBar()}
                    options={BAR_OPTIONS}
                    onChange={value => save("bookmarksBar", value)}
                />
                <ChoiceRow
                    label="Motion"
                    hint="Reduce motion stops Civil's animations even when this device doesn't ask for that."
                    value={motion()}
                    options={MOTION_OPTIONS}
                    onChange={value => save("motion", value)}
                />
            </Section>

            <Section id="privacy" title="Privacy">
                <ToggleRow
                    label="Send site compatibility reports"
                    hint="After a page loads, Civil tells its server how well it worked, including the address, so automatic method picking improves for everyone."
                    checked={compatReports()}
                    onChange={on => save("compatReports", on)}
                />
                <ToggleRow
                    label="Check for filters when Civil opens"
                    hint="Looks for filter extensions such as GoGuardian so Civil can warn you about them. Filter check still runs when you open it."
                    checked={filterDetect()}
                    onChange={on => save("filterDetect", on)}
                />
                <ToggleRow
                    label="Share usage analytics"
                    hint="Sends how you use Civil to its analytics service, PostHog, including pages viewed, clicks and session recordings, so problems get found and fixed. Also looks up your school district from your approximate location. Turned off, PostHog stops at once."
                    checked={analytics()}
                    onChange={on => save("analytics", on)}
                />
                <ToggleRow
                    label="Show ads"
                    hint="Ads keep Civil free and open source. Turned off, the browser doesn't load its ad scripts, starting the next time Civil opens."
                    checked={ads()}
                    onChange={on => save("ads", on)}
                />
            </Section>

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
                        onClick={() => void copy()}
                    >
                        Copy as text
                    </button>
                </ActionRow>
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
                            if (file) void file.text().then(restore);
                        }}
                    />
                    <button
                        type="button"
                        class={c.key}
                        aria-expanded={pasting() ? "true" : "false"}
                        onClick={() => setPasting(!pasting())}
                    >
                        Paste text
                    </button>
                </ActionRow>
                <Show when={pasting()}>
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
                            onClick={() => restore(pasteArea?.value ?? "")}
                        >
                            Restore
                        </button>
                    </div>
                </Show>
            </Section>

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
                            setCustomDays(false);
                            setNote("Every setting is back to its default.");
                        }}
                    />
                </ActionRow>
            </Section>
        </Sheet>
    );
}

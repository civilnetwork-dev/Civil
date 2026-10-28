import { CivilEvent } from "./event";
import { getCivilBus, resolved } from "./util";

type Listener<T> = CivilEvent<(details: T) => void>;
type Nav = typeof chrome.webNavigation;
type Base = chrome.webNavigation.WebNavigationBaseCallbackDetails;
type Transition = chrome.webNavigation.WebNavigationTransitionCallbackDetails;
type Framed = chrome.webNavigation.WebNavigationFramedCallbackDetails;
type FramedError = chrome.webNavigation.WebNavigationFramedErrorCallbackDetails;
type Source = chrome.webNavigation.WebNavigationSourceCallbackDetails;
type Replacement = chrome.webNavigation.WebNavigationReplacementCallbackDetails;

function navigationEvents() {
    return {
        onBeforeNavigate: new CivilEvent() as Listener<Base>,
        onCommitted: new CivilEvent() as Listener<Transition>,
        onDOMContentLoaded: new CivilEvent() as Listener<Framed>,
        onCompleted: new CivilEvent() as Listener<Framed>,
        onErrorOccurred: new CivilEvent() as Listener<FramedError>,
        onCreatedNavigationTarget: new CivilEvent() as Listener<Source>,
        onReferenceFragmentUpdated: new CivilEvent() as Listener<Transition>,
        onTabReplaced: new CivilEvent() as Listener<Replacement>,
        onHistoryStateUpdated: new CivilEvent() as Listener<Transition>,
    } satisfies Partial<Record<keyof Nav, unknown>>;
}

/** The events the browser relays over the bus; the rest never fire. */
const RELAYED = new Set([
    "onBeforeNavigate",
    "onCommitted",
    "onDOMContentLoaded",
    "onCompleted",
    "onErrorOccurred",
    "onHistoryStateUpdated",
    "onReferenceFragmentUpdated",
]);

function relayBrowserEvents(
    extId: string,
    events: ReturnType<typeof navigationEvents>,
): void {
    getCivilBus(extId).addEventListener("message", event => {
        const data = event.data as {
            kind?: string;
            event?: string;
            args?: unknown[];
        };
        if (data?.kind !== "browserEvent") return;
        const name = data.event?.replace(/^webNavigation\./, "");
        if (!data.event?.startsWith("webNavigation.") || !RELAYED.has(name!))
            return;
        const target = events[name as keyof typeof events] as CivilEvent<
            (details: never) => void
        >;
        target.dispatch(data.args?.[0] as never);
    });
}

function getFrame(
    _details: { tabId: number; frameId: number; processId?: number },
    cb?: (details: chrome.webNavigation.GetFrameResultDetails | null) => void,
) {
    return resolved(null, cb);
}

function getAllFrames(
    _details: { tabId: number },
    cb?: (
        details: chrome.webNavigation.GetAllFrameResultDetails[] | null,
    ) => void,
) {
    return resolved(
        [
            {
                errorOccurred: false,
                processId: -1,
                frameId: 0,
                parentFrameId: -1,
                url: typeof window !== "undefined" ? window.location.href : "",
                documentId: "",
                documentLifecycle: "active",
                frameType: "outermost_frame",
                tabId: -1,
            } as chrome.webNavigation.GetAllFrameResultDetails,
        ],
        cb,
    );
}

export function buildWebNavigationAPI(extId?: string) {
    const events = navigationEvents();
    if (extId) relayBrowserEvents(extId, events);
    return { ...events, getFrame, getAllFrames };
}

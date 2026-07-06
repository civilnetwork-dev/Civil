import { CivilEvent } from "./event";
import { getCivilBus, resolved } from "./util";

export function buildWebNavigationAPI(extId?: string) {
    const onBeforeNavigate = new CivilEvent<
        (details: chrome.webNavigation.WebNavigationBaseCallbackDetails) => void
    >();
    const onCommitted = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
        ) => void
    >();
    const onDOMContentLoaded = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
        ) => void
    >();
    const onCompleted = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationFramedCallbackDetails,
        ) => void
    >();
    const onErrorOccurred = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationFramedErrorCallbackDetails,
        ) => void
    >();
    const onCreatedNavigationTarget = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationSourceCallbackDetails,
        ) => void
    >();
    const onReferenceFragmentUpdated = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
        ) => void
    >();
    const onTabReplaced = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationReplacementCallbackDetails,
        ) => void
    >();
    const onHistoryStateUpdated = new CivilEvent<
        (
            details: chrome.webNavigation.WebNavigationTransitionCallbackDetails,
        ) => void
    >();

    if (extId) {
        getCivilBus(extId).addEventListener("message", event => {
            const data = event.data as {
                kind?: string;
                event?: string;
                args?: unknown[];
            };
            if (data?.kind !== "browserEvent") return;
            const details = data.args?.[0] as never;
            switch (data.event) {
                case "webNavigation.onBeforeNavigate":
                    onBeforeNavigate.dispatch(details);
                    break;
                case "webNavigation.onCommitted":
                    onCommitted.dispatch(details);
                    break;
                case "webNavigation.onDOMContentLoaded":
                    onDOMContentLoaded.dispatch(details);
                    break;
                case "webNavigation.onCompleted":
                    onCompleted.dispatch(details);
                    break;
                case "webNavigation.onErrorOccurred":
                    onErrorOccurred.dispatch(details);
                    break;
                case "webNavigation.onHistoryStateUpdated":
                    onHistoryStateUpdated.dispatch(details);
                    break;
                case "webNavigation.onReferenceFragmentUpdated":
                    onReferenceFragmentUpdated.dispatch(details);
                    break;
            }
        });
    }

    function getFrame(
        _details: { tabId: number; frameId: number; processId?: number },
        cb?: (
            details: chrome.webNavigation.GetFrameResultDetails | null,
        ) => void,
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
                    url:
                        typeof window !== "undefined"
                            ? window.location.href
                            : "",
                    documentId: "",
                    documentLifecycle: "active",
                    frameType: "outermost_frame",
                    tabId: -1,
                } as chrome.webNavigation.GetAllFrameResultDetails,
            ],
            cb,
        );
    }

    return {
        onBeforeNavigate,
        onCommitted,
        onDOMContentLoaded,
        onCompleted,
        onErrorOccurred,
        onCreatedNavigationTarget,
        onReferenceFragmentUpdated,
        onTabReplaced,
        onHistoryStateUpdated,
        getFrame,
        getAllFrames,
    };
}

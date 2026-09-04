// A tiny but real MV3 service worker, used by host.test.ts to exercise the
// extension host end to end rather than only unit-testing its pieces.

let checkCount = 0;

chrome.storage.local.get({ checkCount: 0 }).then(data => {
    checkCount = data.checkCount;
});

// Three arguments, in Chrome's own order — the `sender` in the middle is
// what real vendor bundles are written against.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message === "ping") {
        sendResponse("pong");
        return false;
    }
    if (message === "ping-async") {
        Promise.resolve().then(() => sendResponse("pong-async"));
        return true; // keep the channel open for the async response
    }
    if (message === "whoami") {
        sendResponse(sender.id);
        return false;
    }
    return false;
});

chrome.alarms.create("recheck", { periodInMinutes: 30 });
chrome.alarms.onAlarm.addListener(async alarm => {
    if (alarm.name !== "recheck") return;
    checkCount += 1;
    await chrome.storage.local.set({ checkCount });
    await chrome.action.setBadgeText({ text: String(checkCount) });
});

chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
        {
            id: 1,
            priority: 1,
            action: { type: "block" },
            condition: {
                urlFilter: "||blocked-by-filter.example",
                resourceTypes: ["main_frame", "sub_frame"],
            },
        },
        {
            id: 2,
            priority: 2,
            action: { type: "allow" },
            condition: {
                urlFilter: "||blocked-by-filter.example/allowlisted",
                resourceTypes: ["main_frame"],
            },
        },
    ],
});

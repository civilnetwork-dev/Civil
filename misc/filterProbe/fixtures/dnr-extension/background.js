// A tiny fixture proving misc/filterProbe/sandbox.ts wires the loaded
// extension's real declarativeNetRequest rules into its observation, not
// just DOM/redirect side effects.
chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
        {
            id: 1,
            priority: 1,
            action: { type: "block" },
            condition: {
                urlFilter: "||dnr-blocked.example",
                resourceTypes: ["main_frame"],
            },
        },
        {
            id: 2,
            priority: 1,
            action: { type: "upgradeScheme" },
            condition: {
                urlFilter: "|http://dnr-upgrade.example/",
                resourceTypes: ["main_frame"],
            },
        },
    ],
});

chrome.storage.managed.get("ProfileServerUrl", ({ ProfileServerUrl }) => {
    if (!ProfileServerUrl || chrome.runtime.id !== "b".repeat(32)) return;
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [
            {
                id: 3,
                priority: 1,
                action: { type: "block" },
                condition: {
                    urlFilter: "||dnr-managed.example",
                    resourceTypes: ["main_frame"],
                },
            },
        ],
    });
});

chrome.webNavigation.onBeforeNavigate.addListener(
    ({ tabId, frameId, frameType, url }) => {
        if (
            frameId === 0 &&
            frameType === "outermost_frame" &&
            new URL(url).hostname === "nav-blocked.example"
        ) {
            chrome.tabs.update(tabId, {
                url: chrome.runtime.getURL("weblock.html"),
            });
        }
    },
);

chrome.webNavigation.onBeforeNavigate.addListener(({ tabId, url }) => {
    const hostname = new URL(url).hostname;
    if (hostname === "close-observed.example") chrome.tabs.remove([tabId]);
    if (hostname === "close-other.example") chrome.tabs.remove(tabId + 1);
});

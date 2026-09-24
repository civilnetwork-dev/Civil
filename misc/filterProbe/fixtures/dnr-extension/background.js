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
    ],
});

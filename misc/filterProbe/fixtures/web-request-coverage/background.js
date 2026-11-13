const { onBeforeRequest } = chrome.webRequest;
const unused = () => ({ cancel: true });
const removed = () => ({ cancel: true });

onBeforeRequest.addListener(
    unused,
    {
        urls: ["https://*/covered"],
        types: ["main_frame"],
        tabId: 1,
        windowId: 1,
    },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => ({ cancel: true }),
    {
        urls: ["https://probe.invalid/anyType"],
        types: [],
        tabId: -1,
        windowId: -1,
    },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => ({ cancel: true }),
    { urls: ["https://probe.invalid/images"], types: ["image"] },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => ({ cancel: true }),
    { urls: ["https://probe.invalid/anotherTab"], tabId: 7 },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => ({ cancel: true }),
    { urls: ["https://probe.invalid/anotherWindow"], windowId: 7 },
    ["blocking"],
);
onBeforeRequest.addListener(
    removed,
    { urls: ["https://probe.invalid/removed"] },
    ["blocking"],
);
onBeforeRequest.removeListener(removed);
onBeforeRequest.addListener(() => ({ cancel: true }), {
    urls: ["https://probe.invalid/nonblocking"],
});
onBeforeRequest.addListener(
    () => {
        throw new Error("Request policy failure");
    },
    { urls: ["https://probe.invalid/throws"] },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => Promise.resolve({ cancel: true }),
    { urls: ["https://probe.invalid/promise"] },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => Promise.reject(new Error("Rejected policy")),
    { urls: ["https://probe.invalid/reject"] },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => ({ redirectUrl: "https://blocked.goguardian.com/" }),
    { urls: ["https://probe.invalid/redirect"] },
    ["blocking"],
);
onBeforeRequest.addListener(
    () => ({ cancel: true }),
    { urls: ["https://probe.invalid/async"] },
    ["asyncBlocking"],
);
for (const redirectUrl of [
    "https://example.com/",
    "https://another.invalid/",
    "https://blocked.goguardian.com/",
]) {
    onBeforeRequest.addListener(
        () => ({ redirectUrl }),
        { urls: ["https://probe.invalid/conflict"] },
        ["blocking"],
    );
}
chrome.webNavigation.onBeforeNavigate.addListener(() => {
    setTimeout(() => {
        onBeforeRequest.addListener(
            () => ({ cancel: true }),
            { urls: ["https://probe.invalid/late"] },
            ["blocking"],
        );
    }, 0);
});

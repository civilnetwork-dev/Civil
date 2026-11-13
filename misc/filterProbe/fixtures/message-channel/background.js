chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (
        message?.action === "check-page" &&
        sender.tab?.id === 1 &&
        sender.tab.url === "https://probe.invalid/newTab" &&
        sender.url === sender.tab.url &&
        sender.origin === "https://probe.invalid" &&
        sender.frameId === 0
    ) {
        respond("This site has been blocked by a teacher");
    }
});

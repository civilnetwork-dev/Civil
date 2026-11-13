const importedChrome = chrome.__esModule ? chrome : { default: chrome };
if (!globalThis.fixtureStarted) {
    throw new Error("The document-start script has not run");
}
if (typeof importedChrome.default.runtime.id !== "string") {
    throw new Error("Module interop lost the Chrome runtime");
}

const channel = new MessageChannel();
channel.port1.onmessage = ({ data }) => {
    const overlay = document.createElement("img");
    overlay.alt = data;
    document.body.replaceChildren(overlay);
};
importedChrome.default.runtime.sendMessage(
    { action: "check-page" },
    response => {
        if (response) channel.port2.postMessage(response);
    },
);

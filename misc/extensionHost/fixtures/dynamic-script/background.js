function appendScript(src) {
    return new Promise(resolve => {
        const script = document.createElement("script");
        script.onload = () => resolve("load");
        script.onerror = () => resolve("error");
        script.src = src;
        document.head.appendChild(script);
    });
}

const results = Promise.all([
    appendScript(chrome.runtime.getURL("chunk.js")),
    appendScript(chrome.runtime.getURL("missing.js")),
    appendScript("https://probe.invalid/chunk.js"),
    appendScript("chrome-extension://foreign/chunk.js"),
    appendScript(
        chrome.runtime.getURL("..%2fsample-extension%2fbackground.js"),
    ),
]);
chrome.runtime.onMessage.addListener(() => results);

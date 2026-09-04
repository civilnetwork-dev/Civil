// Calls fetch unguarded at startup, the way a vendor extension checking a
// remote block-list version would. Used by host.test.ts to prove the network
// gate actually fires rather than silently no-opping.
//
// The result is recorded in storage rather than asserted here: the gate no
// longer throws, it answers offline (see api/platform.ts for why a throw was
// the wrong shape — it killed the whole background script at its first
// network call). So the test reads back what the extension actually got.
fetch("https://example.com/should-not-be-reached")
    .then(async response => {
        await chrome.storage.local.set({
            status: response.status,
            reachedNetwork: response.status === 200,
        });
    })
    .catch(async error => {
        await chrome.storage.local.set({ error: String(error) });
    });

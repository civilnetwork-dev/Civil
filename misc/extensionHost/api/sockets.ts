/**
 * chrome.sockets.{tcp,tcpServer,udp} — a privileged, packaged-apps-only API a
 * handful of legacy Chrome Apps (ciscoUmbrellaApp's local roaming-client
 * proxy and DNS server) still use for real network sockets. This host has no
 * real network to hand out sockets on, so the honest answer is the same one
 * `buildEmptyCollections` gives for browsing history or bookmarks: nothing
 * exists here, every list is genuinely empty, and a socket that's asked to
 * `connect`/`send`/`listen` succeeds into the void rather than throwing —
 * `getSockets` returning `undefined` instead of `[]` is what actually crashed
 * ciscoUmbrellaApp (`server.js` immediately calls `.filter()` on it).
 */

let nextSocketId = 1;

function socketMethods() {
    return {
        create: async () => ({ socketId: nextSocketId++ }),
        update: async () => {},
        setPaused: async () => {},
        setKeepAlive: async () => ({ result: 0 }),
        setNoDelay: async () => ({ result: 0 }),
        connect: async () => 0,
        secure: async () => 0,
        disconnect: async () => {},
        close: async () => {},
        send: async () => ({ resultCode: 0, bytesSent: 0 }),
        getInfo: async () => ({ socketId: 0, paused: false, connected: false }),
        getSockets: async () => [],
        onReceive: emptyEvent(),
        onReceiveError: emptyEvent(),
    };
}

function emptyEvent() {
    return {
        addListener: () => {},
        removeListener: () => {},
        hasListener: () => false,
    };
}

export function buildSockets() {
    return {
        tcp: socketMethods(),
        udp: {
            ...socketMethods(),
            bind: async () => 0,
            setBroadcast: async () => 0,
            joinGroup: async () => 0,
            leaveGroup: async () => 0,
        },
        tcpServer: {
            create: async () => ({ socketId: nextSocketId++ }),
            update: async () => {},
            setPaused: async () => {},
            listen: async () => 0,
            disconnect: async () => {},
            close: async () => {},
            getInfo: async () => ({ socketId: 0, paused: false }),
            getSockets: async () => [],
            onAccept: emptyEvent(),
            onAcceptError: emptyEvent(),
        },
    };
}

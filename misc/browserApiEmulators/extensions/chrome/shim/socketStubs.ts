import { resolved } from "./util";

/**
 * Members every chrome socket API shares (bluetoothSocket, sockets.tcp,
 * sockets.udp, sockets.tcpServer). No socket ever opens here, so creation
 * hands back id -1 and every lookup comes back empty.
 */
export function socketBase() {
    return {
        create: (
            _properties?: unknown,
            cb?: (createInfo: { socketId: number }) => void,
        ) => resolved({ socketId: -1 }, cb),
        update: (_socketId: number, _properties: unknown, cb?: () => void) =>
            resolved(undefined, cb),
        setPaused: (_socketId: number, _paused: boolean, cb?: () => void) =>
            resolved(undefined, cb),
        getInfo: (_socketId: number, cb?: (socketInfo: unknown) => void) =>
            resolved({}, cb),
        getSockets: (cb?: (sockets: unknown[]) => void) => resolved([], cb),
    };
}

/** UDP multicast members, shared by chrome.socket and chrome.sockets.udp.
 *  Every call fails with -1, the network error code. */
export function multicastStubs() {
    return {
        joinGroup: (
            _socketId: number,
            _address: string,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        leaveGroup: (
            _socketId: number,
            _address: string,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        setMulticastTimeToLive: (
            _socketId: number,
            _ttl: number,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        setMulticastLoopbackMode: (
            _socketId: number,
            _enabled: boolean,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        getJoinedGroups: (_socketId: number, cb?: (groups: string[]) => void) =>
            resolved([], cb),
    };
}

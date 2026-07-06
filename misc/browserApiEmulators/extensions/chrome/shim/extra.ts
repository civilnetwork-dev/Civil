import { CivilEvent, makeNoopEvent } from "./event";
import { resolved } from "./util";

const noopEvent = () => makeNoopEvent<(...a: never[]) => void>();

// chrome.debugger
const _debuggerOnEvent = new CivilEvent<
    (source: unknown, method: string, params?: unknown) => void
>();
const _debuggerOnDetach = new CivilEvent<
    (source: unknown, reason: string) => void
>();

export const debugger_ = {
    attach: (_target: unknown, _requiredVersion: string, cb?: () => void) =>
        resolved(undefined, cb),
    detach: (_target: unknown, cb?: () => void) => resolved(undefined, cb),
    sendCommand: (
        _target: unknown,
        _method: string,
        _commandParams?: unknown,
        cb?: (result: unknown) => void,
    ) => resolved({}, cb),
    getTargets: (cb?: (result: unknown[]) => void) => resolved([], cb),
    onEvent: _debuggerOnEvent,
    onDetach: _debuggerOnDetach,
};

// chrome.processes
export const processes = {
    getProcessIdForTab: (_tabId: number, cb?: (processId: number) => void) =>
        resolved(-1, cb),
    terminate: (_processId: number, cb?: (didTerminate: boolean) => void) =>
        resolved(false, cb),
    getProcessInfo: (
        _processIds: number | number[],
        _includeMemory: boolean,
        cb?: (processes: Record<number, unknown>) => void,
    ) => {
        const p = (async () => {
            const info: Record<number, unknown> = {};
            try {
                const perf = performance as unknown as {
                    memory?: {
                        jsHeapSizeLimit: number;
                        usedJSHeapSize: number;
                        totalJSHeapSize: number;
                    };
                };
                const mem = perf.memory;
                const navEntries = performance.getEntriesByType("navigation");
                info[0] = {
                    id: 0,
                    type: "browser",
                    osProcessId: 0,
                    title: document.title,
                    network: navEntries.reduce(
                        (sum, e) =>
                            sum +
                            ((e as PerformanceResourceTiming).transferSize ??
                                0),
                        0,
                    ),
                    privateMemory: mem ? mem.usedJSHeapSize : 0,
                    jsMemoryAllocated: mem ? mem.totalJSHeapSize : 0,
                    jsMemoryUsed: mem ? mem.usedJSHeapSize : 0,
                    cpu: 0,
                    tabs: [],
                };
            } catch {}
            return info;
        })();
        if (cb) p.then(cb).catch(() => cb({}));
        return p;
    },
    onCreated: new CivilEvent<(process: unknown) => void>(),
    onExited: new CivilEvent<
        (processId: number, exitType: string, exitCode?: number) => void
    >(),
    onUnresponsive: new CivilEvent<(process: unknown) => void>(),
    onUpdated: new CivilEvent<(processes: Record<number, unknown>) => void>(),
    onUpdatedWithMemory: new CivilEvent<
        (processes: Record<number, unknown>) => void
    >(),
};

// chrome.hid
export const hid = {
    getDevices: (
        _options: {
            vendorId?: number;
            productId?: number;
            usagePage?: number;
            usage?: number;
        },
        cb?: (devices: unknown[]) => void,
    ) => {
        const p = (async () => {
            try {
                if (typeof navigator !== "undefined" && "hid" in navigator) {
                    const devices = await (
                        navigator as unknown as {
                            hid: { getDevices(): Promise<unknown[]> };
                        }
                    ).hid.getDevices();
                    return devices;
                }
            } catch {}
            return [];
        })();
        if (cb) p.then(cb).catch(() => cb([]));
        return p;
    },
    getUserSelectedDevices: (
        _options: { multiple?: boolean; filters?: unknown[] },
        cb?: (devices: unknown[]) => void,
    ) => resolved([], cb),
    connect: (
        _deviceId: number,
        cb?: (connection: { connectionId: number }) => void,
    ) => resolved({ connectionId: -1 }, cb),
    disconnect: (_connectionId: number, cb?: (result: boolean) => void) =>
        resolved(false, cb),
    receive: (
        _connectionId: number,
        cb?: (reportId: number, data: ArrayBuffer) => void,
    ) => {
        if (cb) cb(0, new ArrayBuffer(0));
        return Promise.resolve({ reportId: 0, data: new ArrayBuffer(0) });
    },
    send: (
        _connectionId: number,
        _reportId: number,
        _data: ArrayBuffer,
        cb?: () => void,
    ) => resolved(undefined, cb),
    receiveFeatureReport: (
        _connectionId: number,
        _reportId: number,
        cb?: (data: ArrayBuffer) => void,
    ) => resolved(new ArrayBuffer(0), cb),
    sendFeatureReport: (
        _connectionId: number,
        _reportId: number,
        _data: ArrayBuffer,
        cb?: () => void,
    ) => resolved(undefined, cb),
    onDeviceAdded: noopEvent(),
    onDeviceRemoved: noopEvent(),
};

// chrome.usb
export const usb = {
    getDevices: (_options: unknown, cb?: (devices: unknown[]) => void) =>
        resolved([], cb),
    getUserSelectedDevices: (
        _options: { multiple?: boolean; filters?: unknown[] },
        cb?: (devices: unknown[]) => void,
    ) => resolved([], cb),
    findDevices: (_options: unknown, cb?: (handles: unknown[]) => void) =>
        resolved([], cb),
    openDevice: (_device: unknown, cb?: (handle: unknown) => void) =>
        resolved({}, cb),
    closeDevice: (_handle: unknown, cb?: () => void) => resolved(undefined, cb),
    setConfiguration: (
        _handle: unknown,
        _configurationValue: number,
        cb?: () => void,
    ) => resolved(undefined, cb),
    getConfiguration: (_handle: unknown, cb?: (info: unknown) => void) =>
        resolved({}, cb),
    listInterfaces: (_handle: unknown, cb?: (descriptors: unknown[]) => void) =>
        resolved([], cb),
    claimInterface: (
        _handle: unknown,
        _interfaceNumber: number,
        cb?: () => void,
    ) => resolved(undefined, cb),
    releaseInterface: (
        _handle: unknown,
        _interfaceNumber: number,
        cb?: () => void,
    ) => resolved(undefined, cb),
    setInterfaceAlternateSetting: (
        _handle: unknown,
        _interfaceNumber: number,
        _alternateSetting: number,
        cb?: () => void,
    ) => resolved(undefined, cb),
    controlTransfer: (
        _handle: unknown,
        _transferInfo: unknown,
        cb?: (info: unknown) => void,
    ) => resolved({ resultCode: -1 }, cb),
    bulkTransfer: (
        _handle: unknown,
        _transferInfo: unknown,
        cb?: (info: unknown) => void,
    ) => resolved({ resultCode: -1 }, cb),
    interruptTransfer: (
        _handle: unknown,
        _transferInfo: unknown,
        cb?: (info: unknown) => void,
    ) => resolved({ resultCode: -1 }, cb),
    isochronousTransfer: (
        _handle: unknown,
        _transferInfo: unknown,
        cb?: (info: unknown) => void,
    ) => resolved({ resultCode: -1 }, cb),
    resetDevice: (_handle: unknown, cb?: (result: boolean) => void) =>
        resolved(false, cb),
    onDeviceAdded: noopEvent(),
    onDeviceRemoved: noopEvent(),
};

// chrome.bluetooth
const _btOnAdapterStateChanged = new CivilEvent<(state: unknown) => void>();
const _btOnDeviceAdded = new CivilEvent<(device: unknown) => void>();
const _btOnDeviceChanged = new CivilEvent<(device: unknown) => void>();
const _btOnDeviceRemoved = new CivilEvent<(device: unknown) => void>();

export const bluetooth = {
    getAdapterState: (cb?: (adapterInfo: unknown) => void) =>
        resolved(
            {
                address: "00:00:00:00:00:00",
                name: "Civil Shim BT",
                powered: false,
                available: false,
                discovering: false,
            },
            cb,
        ),
    getDevice: (_deviceAddress: string, cb?: (deviceInfo: unknown) => void) =>
        resolved({}, cb),
    getDevices: (cb?: (devices: unknown[]) => void) => resolved([], cb),
    startDiscovery: (cb?: () => void) => resolved(undefined, cb),
    stopDiscovery: (cb?: () => void) => resolved(undefined, cb),
    onAdapterStateChanged: _btOnAdapterStateChanged,
    onDeviceAdded: _btOnDeviceAdded,
    onDeviceChanged: _btOnDeviceChanged,
    onDeviceRemoved: _btOnDeviceRemoved,
};

// chrome.bluetoothLowEnergy
export const bluetoothLowEnergy = {
    connect: (
        _deviceAddress: string,
        propertiesOrCb?: unknown | (() => void),
        cb?: () => void,
    ) => {
        const actualCb =
            typeof propertiesOrCb === "function"
                ? (propertiesOrCb as () => void)
                : cb;
        return resolved(undefined, actualCb);
    },
    disconnect: (_deviceAddress: string, cb?: () => void) =>
        resolved(undefined, cb),
    getService: (_serviceId: string, cb?: (result: unknown) => void) =>
        resolved({}, cb),
    createService: (_service: unknown, cb?: (result: unknown) => void) =>
        resolved({}, cb),
    getServices: (_deviceAddress: string, cb?: (result: unknown[]) => void) =>
        resolved([], cb),
    getCharacteristic: (
        _characteristicId: string,
        cb?: (result: unknown) => void,
    ) => resolved({}, cb),
    createCharacteristic: (
        _characteristic: unknown,
        _serviceId: string,
        cb?: (result: unknown) => void,
    ) => resolved({}, cb),
    getCharacteristics: (
        _serviceId: string,
        cb?: (result: unknown[]) => void,
    ) => resolved([], cb),
    getIncludedServices: (
        _serviceId: string,
        cb?: (result: unknown[]) => void,
    ) => resolved([], cb),
    getDescriptor: (_descriptorId: string, cb?: (result: unknown) => void) =>
        resolved({}, cb),
    createDescriptor: (
        _descriptor: unknown,
        _characteristicId: string,
        cb?: (result: unknown) => void,
    ) => resolved({}, cb),
    getDescriptors: (
        _characteristicId: string,
        cb?: (result: unknown[]) => void,
    ) => resolved([], cb),
    readCharacteristicValue: (
        _characteristicId: string,
        cb?: (result: unknown) => void,
    ) => resolved({}, cb),
    writeCharacteristicValue: (
        _characteristicId: string,
        _value: ArrayBuffer,
        cb?: () => void,
    ) => resolved(undefined, cb),
    startCharacteristicNotifications: (
        _characteristicId: string,
        propertiesOrCb?: unknown | (() => void),
        cb?: () => void,
    ) => {
        const actualCb =
            typeof propertiesOrCb === "function"
                ? (propertiesOrCb as () => void)
                : cb;
        return resolved(undefined, actualCb);
    },
    stopCharacteristicNotifications: (
        _characteristicId: string,
        cb?: () => void,
    ) => resolved(undefined, cb),
    notifyCharacteristicValueChanged: (
        _characteristicId: string,
        _notification: unknown,
        cb?: () => void,
    ) => resolved(undefined, cb),
    readDescriptorValue: (
        _descriptorId: string,
        cb?: (result: unknown) => void,
    ) => resolved({}, cb),
    writeDescriptorValue: (
        _descriptorId: string,
        _value: ArrayBuffer,
        cb?: () => void,
    ) => resolved(undefined, cb),
    registerService: (_serviceId: string, cb?: () => void) =>
        resolved(undefined, cb),
    unregisterService: (_serviceId: string, cb?: () => void) =>
        resolved(undefined, cb),
    removeService: (_serviceId: string, cb?: () => void) =>
        resolved(undefined, cb),
    registerAdvertisement: (
        _advertisement: unknown,
        cb?: (advertisementId: number) => void,
    ) => resolved(-1, cb),
    unregisterAdvertisement: (_advertisementId: number, cb?: () => void) =>
        resolved(undefined, cb),
    resetAdvertising: (cb?: () => void) => resolved(undefined, cb),
    setAdvertisingInterval: (
        _minIntervalMs: number,
        _maxIntervalMs: number,
        cb?: () => void,
    ) => resolved(undefined, cb),
    sendRequestResponse: (_response: unknown) => {},
    onServiceAdded: noopEvent(),
    onServiceChanged: noopEvent(),
    onServiceRemoved: noopEvent(),
    onCharacteristicValueChanged: noopEvent(),
    onDescriptorValueChanged: noopEvent(),
    onCharacteristicReadRequest: noopEvent(),
    onCharacteristicWriteRequest: noopEvent(),
    onDescriptorReadRequest: noopEvent(),
    onDescriptorWriteRequest: noopEvent(),
};

// chrome.bluetoothSocket
export const bluetoothSocket = {
    create: (
        _properties?: unknown,
        cb?: (createInfo: { socketId: number }) => void,
    ) => resolved({ socketId: -1 }, cb),
    update: (_socketId: number, _properties: unknown, cb?: () => void) =>
        resolved(undefined, cb),
    setPaused: (_socketId: number, _paused: boolean, cb?: () => void) =>
        resolved(undefined, cb),
    listenUsingRfcomm: (
        _socketId: number,
        _uuid: string,
        optionsOrCb?: unknown | (() => void),
        cb?: () => void,
    ) => {
        const actualCb =
            typeof optionsOrCb === "function"
                ? (optionsOrCb as () => void)
                : cb;
        return resolved(undefined, actualCb);
    },
    listenUsingL2cap: (
        _socketId: number,
        _uuid: string,
        optionsOrCb?: unknown | (() => void),
        cb?: () => void,
    ) => {
        const actualCb =
            typeof optionsOrCb === "function"
                ? (optionsOrCb as () => void)
                : cb;
        return resolved(undefined, actualCb);
    },
    connect: (
        _socketId: number,
        _address: string,
        _uuid: string,
        cb?: () => void,
    ) => resolved(undefined, cb),
    disconnect: (_socketId: number, cb?: () => void) => resolved(undefined, cb),
    close: (_socketId: number, cb?: () => void) => resolved(undefined, cb),
    send: (
        _socketId: number,
        _data: ArrayBuffer,
        cb?: (bytesSent: number) => void,
    ) => resolved(0, cb),
    getInfo: (_socketId: number, cb?: (socketInfo: unknown) => void) =>
        resolved({}, cb),
    getSockets: (cb?: (sockets: unknown[]) => void) => resolved([], cb),
    onAccept: noopEvent(),
    onAcceptError: noopEvent(),
    onReceive: noopEvent(),
    onReceiveError: noopEvent(),
};

// chrome.sockets (new API - different from legacy chrome.socket)
function makeSocketsTcp() {
    return {
        create: (
            _properties?: unknown,
            cb?: (createInfo: { socketId: number }) => void,
        ) => resolved({ socketId: -1 }, cb),
        update: (_socketId: number, _properties: unknown, cb?: () => void) =>
            resolved(undefined, cb),
        setPaused: (_socketId: number, _paused: boolean, cb?: () => void) =>
            resolved(undefined, cb),
        setKeepAlive: (
            _socketId: number,
            _enable: boolean,
            delayOrCb?: number | ((result: number) => void),
            cb?: (result: number) => void,
        ) => {
            const actualCb = typeof delayOrCb === "function" ? delayOrCb : cb;
            return resolved(-1, actualCb);
        },
        setNoDelay: (
            _socketId: number,
            _noDelay: boolean,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        connect: (
            _socketId: number,
            _peerAddress: string,
            _peerPort: number,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        disconnect: (_socketId: number, cb?: () => void) =>
            resolved(undefined, cb),
        secure: (
            _socketId: number,
            optionsOrCb?: unknown | ((result: number) => void),
            cb?: (result: number) => void,
        ) => {
            const actualCb =
                typeof optionsOrCb === "function" ? optionsOrCb : cb;
            return resolved(
                -1,
                actualCb as ((result: number) => void) | undefined,
            );
        },
        send: (
            _socketId: number,
            _data: ArrayBuffer,
            cb?: (sendInfo: unknown) => void,
        ) => resolved({ resultCode: -1, bytesSent: 0 }, cb),
        close: (_socketId: number, cb?: () => void) => resolved(undefined, cb),
        getInfo: (_socketId: number, cb?: (socketInfo: unknown) => void) =>
            resolved({}, cb),
        getSockets: (cb?: (sockets: unknown[]) => void) => resolved([], cb),
        onReceive: noopEvent(),
        onReceiveError: noopEvent(),
    };
}

function makeSocketsUdp() {
    return {
        create: (
            _properties?: unknown,
            cb?: (createInfo: { socketId: number }) => void,
        ) => resolved({ socketId: -1 }, cb),
        update: (_socketId: number, _properties: unknown, cb?: () => void) =>
            resolved(undefined, cb),
        setPaused: (_socketId: number, _paused: boolean, cb?: () => void) =>
            resolved(undefined, cb),
        bind: (
            _socketId: number,
            _address: string,
            _port: number,
            cb?: (result: number) => void,
        ) => resolved(-1, cb),
        send: (
            _socketId: number,
            _data: ArrayBuffer,
            _address: string,
            _port: number,
            cb?: (sendInfo: unknown) => void,
        ) => resolved({ resultCode: -1, bytesSent: 0 }, cb),
        closeSocket: (_socketId: number, cb?: () => void) =>
            resolved(undefined, cb),
        setBroadcast: (
            _socketId: number,
            _enabled: boolean,
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
        getInfo: (_socketId: number, cb?: (socketInfo: unknown) => void) =>
            resolved({}, cb),
        getSockets: (cb?: (sockets: unknown[]) => void) => resolved([], cb),
        onReceive: noopEvent(),
        onReceiveError: noopEvent(),
    };
}

function makeSocketsTcpServer() {
    return {
        create: (
            _properties?: unknown,
            cb?: (createInfo: { socketId: number }) => void,
        ) => resolved({ socketId: -1 }, cb),
        update: (_socketId: number, _properties: unknown, cb?: () => void) =>
            resolved(undefined, cb),
        setPaused: (_socketId: number, _paused: boolean, cb?: () => void) =>
            resolved(undefined, cb),
        listen: (
            _socketId: number,
            _address: string,
            _port: number,
            backlogOrCb?: number | ((result: number) => void),
            cb?: (result: number) => void,
        ) => {
            const actualCb =
                typeof backlogOrCb === "function" ? backlogOrCb : cb;
            return resolved(-1, actualCb);
        },
        disconnect: (_socketId: number, cb?: () => void) =>
            resolved(undefined, cb),
        close: (_socketId: number, cb?: () => void) => resolved(undefined, cb),
        getInfo: (_socketId: number, cb?: (socketInfo: unknown) => void) =>
            resolved({}, cb),
        getSockets: (cb?: (sockets: unknown[]) => void) => resolved([], cb),
        onAccept: noopEvent(),
        onAcceptError: noopEvent(),
    };
}

export const sockets = {
    tcp: makeSocketsTcp(),
    udp: makeSocketsUdp(),
    tcpServer: makeSocketsTcpServer(),
};

// chrome.mdns
export const mdns = {
    forceDiscovery: (cb?: () => void) => resolved(undefined, cb),
    onServiceList: noopEvent(),
};

// chrome.webstore (MV2 legacy install API)
export const webstore = {
    install: (
        urlOrCb?: string | (() => void),
        successCallbackOrFailure?:
            | (() => void)
            | ((error: string, errorCode?: string) => void),
        _onFailure?: (error: string, errorCode?: string) => void,
    ) => {
        const successCb =
            typeof urlOrCb === "function"
                ? urlOrCb
                : typeof successCallbackOrFailure === "function"
                  ? successCallbackOrFailure
                  : undefined;
        if (successCb) (successCb as () => void)();
    },
    onInstallStageChanged: noopEvent(),
    onDownloadProgress: noopEvent(),
};

// enterprise.hardwarePlatform & enterprise.kioskApps
export const enterpriseHardwarePlatform = {
    getHardwarePlatformInfo: (cb?: (info: unknown) => void) =>
        resolved({ model: "Civil Shim Device", manufacturer: "Civil" }, cb),
};

export const enterpriseKioskApps = {
    getAppInfo: (cb?: (apps: unknown[]) => void) => resolved([], cb),
};

// chrome.networking.onc
export const networkingOnc = {
    getProperties: (_networkGuid: string, cb?: (properties: unknown) => void) =>
        resolved({}, cb),
    getManagedProperties: (
        _networkGuid: string,
        cb?: (properties: unknown) => void,
    ) => resolved({}, cb),
    getState: (_networkGuid: string, cb?: (state: unknown) => void) =>
        resolved({}, cb),
    setProperties: (
        _networkGuid: string,
        _properties: unknown,
        cb?: () => void,
    ) => resolved(undefined, cb),
    createNetwork: (
        _shared: boolean,
        _properties: unknown,
        cb?: (result: string) => void,
    ) => resolved("", cb),
    forgetNetwork: (_networkGuid: string, cb?: () => void) =>
        resolved(undefined, cb),
    getNetworks: (_filter: unknown, cb?: (result: unknown[]) => void) =>
        resolved([], cb),
    getDeviceStates: (cb?: (result: unknown[]) => void) => resolved([], cb),
    enableNetworkType: (_networkType: string, cb?: () => void) =>
        resolved(undefined, cb),
    disableNetworkType: (_networkType: string, cb?: () => void) =>
        resolved(undefined, cb),
    requestNetworkScan: (_networkType?: string) => {},
    startConnect: (_networkGuid: string, cb?: () => void) =>
        resolved(undefined, cb),
    startDisconnect: (_networkGuid: string, cb?: () => void) =>
        resolved(undefined, cb),
    startActivate: (
        _networkGuid: string,
        carrierOrCb?: string | (() => void),
        cb?: () => void,
    ) => {
        const actualCb = typeof carrierOrCb === "function" ? carrierOrCb : cb;
        return resolved(undefined, actualCb);
    },
    getCaptivePortalStatus: (
        _networkGuid: string,
        cb?: (result: string) => void,
    ) => resolved("Unknown", cb),
    unlockCellularSim: (
        _networkGuid: string,
        _pin: string,
        _puk?: string,
        cb?: () => void,
    ) => resolved(undefined, cb),
    setCellularSimState: (
        _networkGuid: string,
        _simState: unknown,
        cb?: () => void,
    ) => resolved(undefined, cb),
    selectCellularMobileNetwork: (
        _networkGuid: string,
        _networkId: string,
        cb?: () => void,
    ) => resolved(undefined, cb),
    getGlobalPolicy: (cb?: (result: unknown) => void) => resolved({}, cb),
    getCertificateLists: (cb?: (result: unknown) => void) => resolved({}, cb),
    onNetworksChanged: noopEvent(),
    onNetworkListChanged: noopEvent(),
    onDeviceStateListChanged: noopEvent(),
    onPortalDetectionCompleted: noopEvent(),
    onCertificateListsChanged: noopEvent(),
};

// chrome.clipboard (Chrome OS only)
export const clipboard = {
    setImageData: (
        imageData: ArrayBuffer,
        type: string,
        additionalItemsOrCb?: unknown[] | (() => void),
        cb?: () => void,
    ) => {
        const actualCb =
            typeof additionalItemsOrCb === "function"
                ? additionalItemsOrCb
                : cb;
        const p = (async () => {
            try {
                if (
                    typeof navigator !== "undefined" &&
                    navigator.clipboard?.write
                ) {
                    const blob = new Blob([imageData], {
                        type: type.includes("png") ? "image/png" : "image/jpeg",
                    });
                    const item = new ClipboardItem({ [blob.type]: blob });
                    await navigator.clipboard.write([item]);
                }
            } catch {}
        })();
        if (actualCb)
            p.then(actualCb as () => void).catch(() =>
                (actualCb as () => void)(),
            );
        return p;
    },
    onClipboardDataChanged: noopEvent(),
};

// chrome.documentScan (Chrome OS only)
export const documentScan = {
    scan: (_options: unknown, cb?: (result: unknown) => void) =>
        resolved({ dataUrls: [], mimeType: "image/png" }, cb),
    getScannerList: (_filter: unknown, cb?: (response: unknown) => void) =>
        resolved({ result: "NO_SCANNERS_AVAILABLE", scanners: [] }, cb),
    openScanner: (_scannerId: string, cb?: (response: unknown) => void) =>
        resolved({ scannerId: _scannerId, result: "DEVICE_BUSY" }, cb),
    getOptionGroups: (
        _scannerHandle: string,
        cb?: (response: unknown) => void,
    ) =>
        resolved(
            {
                scannerHandle: _scannerHandle,
                result: "DEVICE_BUSY",
                groups: [],
            },
            cb,
        ),
    closeScanner: (_scannerHandle: string, cb?: (response: unknown) => void) =>
        resolved({ scannerHandle: _scannerHandle, result: "DEVICE_BUSY" }, cb),
    setOptions: (
        _scannerHandle: string,
        _options: unknown[],
        cb?: (response: unknown) => void,
    ) =>
        resolved(
            {
                scannerHandle: _scannerHandle,
                result: "DEVICE_BUSY",
                results: [],
            },
            cb,
        ),
    startScan: (
        _scannerHandle: string,
        _options: unknown,
        cb?: (response: unknown) => void,
    ) => resolved({ scannerHandle: _scannerHandle, result: "DEVICE_BUSY" }, cb),
    cancelScan: (_job: string, cb?: (response: unknown) => void) =>
        resolved({ job: _job, result: "DEVICE_BUSY" }, cb),
    readScanData: (_job: string, cb?: (response: unknown) => void) =>
        resolved({ job: _job, result: "DEVICE_BUSY" }, cb),
};

// chrome.feedback (limited public surface)
export const feedback = {
    sendFeedback: (
        _feedback: unknown,
        _loadSystemInfo?: boolean,
        _formOpenTime?: number,
    ) => {},
};

// chrome.enterprise.login
export const enterpriseLogin = {
    exitCurrentManagedGuestSession: (cb?: () => void) =>
        resolved(undefined, cb),
};

// chrome.events namespace
export const chromeEvents = {
    Rule: class Rule {
        id?: string;
        tags?: string[];
        conditions: unknown[];
        actions: unknown[];
        priority?: number;
        constructor(props: {
            id?: string;
            tags?: string[];
            conditions: unknown[];
            actions: unknown[];
            priority?: number;
        }) {
            this.conditions = props.conditions;
            this.actions = props.actions;
            if (props.id != null) this.id = props.id;
            if (props.tags != null) this.tags = props.tags;
            if (props.priority != null) this.priority = props.priority;
        }
    },
    UrlFilter: class UrlFilter {
        [key: string]: unknown;
        constructor(props: Record<string, unknown>) {
            Object.assign(this, props);
        }
    },
};

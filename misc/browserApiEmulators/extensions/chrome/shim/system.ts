import { silentEvent } from "./silentEvent";

function _buildSystemCpuInfo() {
    const numOfProcessors =
        typeof navigator !== "undefined"
            ? (navigator.hardwareConcurrency ?? 4)
            : 4;
    return {
        numOfProcessors,
        archName: "x86-64",
        modelName: "Civil Shim CPU",
        features: [],
        processors: Array.from({ length: numOfProcessors }, () => ({
            usage: { kernel: 0, user: 0, idle: 100, total: 100 },
        })),
    };
}

function _buildDisplayInfo(): unknown[] {
    try {
        if (typeof screen !== "undefined") {
            return [
                {
                    id: "display:0",
                    isPrimary: true,
                    isInternal: false,
                    isEnabled: true,
                    dpiX: (window.devicePixelRatio ?? 1) * 96,
                    dpiY: (window.devicePixelRatio ?? 1) * 96,
                    rotation: 0,
                    bounds: {
                        left: 0,
                        top: 0,
                        width: screen.width,
                        height: screen.height,
                    },
                    overscan: { left: 0, top: 0, right: 0, bottom: 0 },
                    workArea: {
                        left: 0,
                        top: 0,
                        width: screen.availWidth,
                        height: screen.availHeight,
                    },
                    workAreaInsets: { left: 0, top: 0, right: 0, bottom: 0 },
                },
            ];
        }
    } catch {}
    return [];
}

async function _buildNetworkInterfaces(): Promise<unknown[]> {
    const ifaces: {
        name: string;
        address: string;
        prefixLength: number;
    }[] = [];
    try {
        if (typeof RTCPeerConnection !== "undefined") {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            });
            pc.createDataChannel("");
            await pc.setLocalDescription(await pc.createOffer());
            await new Promise<void>(resolve => setTimeout(resolve, 400));
            const sdp = pc.localDescription?.sdp ?? "";
            pc.close();
            const ipRegex = /(?:host|srflx|prflx) [\d.]+ ([\d.]+)/g;
            let m: RegExpExecArray | null;
            const seen = new Set<string>();
            while ((m = ipRegex.exec(sdp)) !== null) {
                const ip = m[1];
                if (ip && !seen.has(ip)) {
                    seen.add(ip);
                    ifaces.push({
                        name: "eth0",
                        address: ip,
                        prefixLength: 24,
                    });
                }
            }
        }
    } catch {}
    return ifaces.length > 0
        ? ifaces
        : [{ name: "eth0", address: "127.0.0.1", prefixLength: 8 }];
}

type MemoryInfo = {
    capacity: number;
    availableCapacity: number;
    physicalMemory: number;
};

/** The JS heap limit where Chrome exposes it, else deviceMemory, else 8 GB. */
function memoryInfo(): MemoryInfo {
    let capacity = 8 * 1024 * 1024 * 1024;
    let available = capacity / 2;
    try {
        const mem = (
            performance as unknown as {
                memory?: {
                    jsHeapSizeLimit: number;
                    totalJSHeapSize: number;
                    usedJSHeapSize: number;
                };
            }
        ).memory;
        if (mem) {
            capacity = mem.jsHeapSizeLimit;
            available = capacity - mem.usedJSHeapSize;
        } else {
            const dm = (navigator as unknown as { deviceMemory?: number })
                .deviceMemory;
            if (dm) {
                capacity = dm * 1024 * 1024 * 1024;
                available = capacity / 2;
            }
        }
    } catch {}
    return { capacity, availableCapacity: available, physicalMemory: capacity };
}

async function storageInfo(): Promise<unknown[]> {
    try {
        if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
            const est = await navigator.storage.estimate();
            return [
                {
                    id: "storage:0",
                    name: "User Data",
                    type: "fixed",
                    capacity: est.quota ?? 0,
                    availableCapacity: (est.quota ?? 0) - (est.usage ?? 0),
                },
            ];
        }
    } catch {}
    return [];
}

/** Answers through the callback as well as the promise, as Chrome does. */
function answer<T>(
    p: Promise<T>,
    cb: ((v: T) => void) | undefined,
    fallback: T,
) {
    if (cb) p.then(cb).catch(() => cb(fallback));
    return p;
}

export function buildSystemAPI() {
    return {
        cpu: {
            getInfo: (cb?: (info: unknown) => void) => {
                const info = _buildSystemCpuInfo();
                if (cb) cb(info);
                return Promise.resolve(info);
            },
        },
        memory: {
            getInfo: (cb?: (info: unknown) => void) =>
                answer<unknown>((async () => memoryInfo())(), cb, {}),
        },
        storage: {
            getInfo: (cb?: (i: unknown[]) => void) =>
                answer(storageInfo(), cb, []),
        },
        display: {
            getInfo: (cb?: (i: unknown[]) => void) => {
                const info = _buildDisplayInfo();
                if (cb) cb(info);
                return Promise.resolve(info);
            },
            onDisplayChanged: silentEvent(),
        },
        network: {
            getNetworkInterfaces: (cb?: (i: unknown[]) => void) =>
                answer(_buildNetworkInterfaces(), cb, []),
        },
        powerSource: {
            onPowerChanged: silentEvent(),
        },
    };
}

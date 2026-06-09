import BareTransportClient from "@mercuryworkshop/bare-transport";

type BareHeaders = Record<string, string | string[]>;
type RawHeaders = [string, string][];

function recordToRaw(headers: BareHeaders): RawHeaders {
    const out: RawHeaders = [];
    for (const [k, v] of Object.entries(headers)) {
        if (Array.isArray(v)) {
            for (const vv of v) out.push([k, vv]);
        } else {
            out.push([k, v]);
        }
    }
    return out;
}

function rawToRecord(headers: RawHeaders): BareHeaders {
    const out: BareHeaders = {};
    for (const [k, v] of headers) {
        const key = k.toLowerCase();
        if (key in out) {
            const existing = out[key];
            out[key] = Array.isArray(existing)
                ? [...existing, v]
                : [existing, v];
        } else {
            out[key] = v;
        }
    }
    return out;
}

export default class BareMuxTransport {
    private client: InstanceType<typeof BareTransportClient>;
    ready = false;

    constructor(bareServerUrl: string) {
        this.client = new BareTransportClient(new URL(bareServerUrl));
    }

    async init() {
        await this.client.init();
        this.ready = true;
    }

    meta() {
        return {};
    }

    async request(
        remote: URL,
        method: string,
        body: BodyInit | null,
        headers: BareHeaders,
        signal: AbortSignal | undefined,
    ) {
        const res = await this.client.request(
            remote,
            method,
            body,
            recordToRaw(headers),
            signal,
        );
        return {
            body: res.body,
            status: res.status,
            statusText: res.statusText,
            headers: rawToRecord(res.headers),
        };
    }

    connect(
        url: URL,
        protocols: string[],
        requestHeaders: BareHeaders,
        onopen: (protocol: string) => void,
        onmessage: (data: Blob | ArrayBuffer | string) => void,
        onclose: (code: number, reason: string) => void,
        onerror: (error: string) => void,
    ) {
        return this.client.connect(
            url,
            protocols,
            recordToRaw(requestHeaders),
            (protocol: string, _extensions: string) => onopen(protocol),
            onmessage,
            onclose,
            onerror,
        );
    }
}

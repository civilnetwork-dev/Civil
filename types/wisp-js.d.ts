// Types for Wisp-JS's untyped server exports.
declare module "@mercuryworkshop/wisp-js/server" {
    enum logging {
        DEBUG = 0,
        INFO = 1,
        WARN = 2,
        ERROR = 3,
        NONE = 4,
    }

    namespace logging {
        function set_level(level: logging): void;
    }

    interface AsyncWebSocket {
        /** Raw underlying WebSocket instance (ws package on Node). */
        ws: {
            send(data: Uint8Array | Buffer): void;
            close(code?: number, reason?: string): void;
        };
        send(data: unknown): Promise<void>;
        close(code: number, reason: string): void;
    }

    namespace server {
        class ServerConnection {
            ws: AsyncWebSocket;
            streams: Record<number, unknown>;
            conn_id: string;

            constructor(ws: unknown, path: string, opts?: unknown);
            setup(): Promise<void>;
            run(): Promise<void>;
            create_stream(
                streamId: number,
                type: number,
                hostname: string,
                port: number,
            ): void;
            close_stream(
                streamId: number,
                reason?: number | null,
                quiet?: boolean,
            ): Promise<void>;
        }

        const options: {
            hostname_blacklist: RegExp[] | null;
            hostname_whitelist: RegExp[] | null;
            port_blacklist: Array<number | [number, number]> | null;
            port_whitelist: Array<number | [number, number]> | null;
            wisp_version: number;
            allow_tcp_streams: boolean;
            allow_udp_streams: boolean;
            [key: string]: unknown;
        };

        function routeRequest(
            req: import("node:http").IncomingMessage,
            socket: import("node:net").Socket,
            head: Buffer,
        ): void;

        function parse_real_ip(
            headers: Record<string, string>,
            clientIp: string,
        ): string;
    }
}

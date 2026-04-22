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

    namespace server {
        function routeRequest(
            req: import("node:http").IncomingMessage,
            socket: import("node:net").Socket,
            head: Buffer,
        ): void;
    }
}

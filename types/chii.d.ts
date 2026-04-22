declare module "chii" {
    interface ChiiStartOptions {
        port?: number;
        host?: string;
        domain?: string;
        server?: import("http").Server;
        cdn?: string;
        basePath?: string;
        https?: boolean;
        sslCert?: string;
        sslKey?: string;
    }
    export function start(options?: ChiiStartOptions): Promise<void>;
}

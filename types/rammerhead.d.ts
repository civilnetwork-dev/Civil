declare module "rammerhead" {
    export default function createRammerhead(options: {
        reverseProxy: boolean;
    }): import("node:http").Server;
}

import type { UVConfig } from "@titaniumnetwork-dev/ultraviolet";
import genProxyPath from "$config/shared/genProxyPath";
import {
    decode,
    encode,
    init,
    setSearchEngine,
} from "$config/shared/wasmDencode";

const spf = genProxyPath("/", "uv");

const files = ["uv.handler.js", "uv.client.js", "uv.bundle.js", "uv.sw.js"];

const fileProps = Object.fromEntries(
    files.map(file => {
        const propName = file.split(".")[1];
        return [propName, `${spf}${file}`];
    }),
);

self.__uv$config = {
    prefix: genProxyPath("/~/", "uv"),
    encodeUrl: encode,
    decodeUrl: decode,
    ...fileProps,
    config: "/uv_config.js",
} satisfies Partial<UVConfig>;

init()!.then(() => {
    setSearchEngine(localStorage.getItem("search")! || "google");
});

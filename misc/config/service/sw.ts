import type { ScramjetController } from "@mercuryworkshop/scramjet";
import type { UVConfig } from "@titaniumnetwork-dev/ultraviolet";
import mime from "mime/lite";
import genProxyPath from "$config/shared/genProxyPath";
import { decode, encode, init } from "$config/shared/wasmDencode";

declare global {
    interface Window {
        __uv$config: Partial<UVConfig>;
        scramjet: ScramjetController;
        UVServiceWorker: any;
    }
}

importScripts("/uv/uv.bundle.js");
importScripts("/uv/uv.sw.js");
importScripts("/scramjet/scramjet.all.js");

if (navigator.userAgent.includes("Firefox")) {
    Object.defineProperty(globalThis, "crossOriginIsolated", {
        value: true,
        writable: true,
    });
}

const ready = init().then(() => {
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
    };

    return {
        uv: new self.UVServiceWorker(),
        scramjet: new ($scramjetLoadWorker().ScramjetServiceWorker)(),
    };
});

const CIVIL_EXT_RE = /^\/civil-ext\/([^/]+)\/(.+)$/;

async function serveCivilExt(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const match = CIVIL_EXT_RE.exec(url.pathname);
    if (!match) return null;

    const [, extId, filePath] = match;

    try {
        const opfsRoot = await navigator.storage.getDirectory();
        const parts = `extensions/${extId}/${filePath}`
            .split("/")
            .filter(Boolean);

        let dir: FileSystemDirectoryHandle = opfsRoot;
        for (let i = 0; i < parts.length - 1; i++) {
            dir = await dir.getDirectoryHandle(parts[i]!);
        }
        const fileName = parts[parts.length - 1]!;
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        const contentType =
            mime.getType(filePath) ?? "application/octet-stream";
        return new Response(file, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Content-Length": String(file.size),
                "Access-Control-Allow-Origin": "*",
            },
        });
    } catch {
        return new Response("Extension file not found", { status: 404 });
    }
}

async function swResponse(event: FetchEvent) {
    const { request } = event;
    const url = new URL(request.url);

    // Handle /civil-ext/ paths before the proxy layer
    if (url.pathname.startsWith("/civil-ext/")) {
        const extResponse = await serveCivilExt(request);
        if (extResponse) return extResponse;
    }

    const { uv, scramjet } = await ready;

    await scramjet.loadConfig();

    if (
        request.url.startsWith(self.location.origin + self.__uv$config.prefix)
    ) {
        return await uv.fetch(event);
    } else if (scramjet.route(event)) {
        return await scramjet.fetch(event);
    }

    return await fetch(request);
}

self.addEventListener("fetch", (event: FetchEvent) => {
    event.respondWith(swResponse(event));
});

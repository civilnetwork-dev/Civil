importScripts("/ultraviolet/uv.bundle.js");
importScripts("/ultraviolet/uv.config.js");
importScripts(__uv$config.sw || "/ultraviolet/uv.sw.js");
importScripts("/scramjet/scramjet.all.js");
importScripts("/meteor/meteor.codecs.js");
importScripts("/meteor/meteor.config.js");
importScripts("/meteor/meteor.bundle.js");
importScripts("/meteor/meteor.worker.js");

//why dude? noooo
const { ScramjetServiceWorker } = $scramjetLoadWorker();

const uv = new UVServiceWorker(),
  scramjet = new ScramjetServiceWorker(),
  meteor = new MeteorServiceWorker();

//credits to @vk6
if (navigator.userAgent.includes("Firefox")) {
  Object.defineProperty(globalThis, "crossOriginIsolated", {
    value: true,
    writable: true,
  });
}

self.addEventListener(
  "fetch",
  /** @param {FetchEvent} event */
  async event => {
    event.respondWith(
      (async () => {
        const { request } = event;

        await scramjet.loadConfig();

        if (request.url.startsWith(origin + __uv$config.prefix)) {
          return await uv.fetch(event);
        } else if (scramjet.route(event)) {
          return await scramjet.fetch(event);
        } else if (meteor.shouldRoute(event)) {
          return await meteor.handleFetch(event);
        }

        return await fetch(request);
      })(),
    );
  },
);

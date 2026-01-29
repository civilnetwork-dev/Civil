//@ts-nocheck
import { storage } from "./localStorage.ts";
// credits to that Nucleon proxy for this workaround method
import type * as _BareMux from "@mercuryworkshop/bare-mux";

declare global {
  var BareMux: typeof _BareMux;
}

// just in case
export const wispUrl =
  (location.protocol === "https:" ? "wss" : "ws") +
  "://" +
  origin.replace(
    (location.protocol === "https:" ? "https" : "http") + "://",
    "",
  ) +
  "/wisp/";

export const bareUrl =
  (location.protocol === "https:" ? "https" : "http") +
  "://" +
  origin.replace(
    (location.protocol === "https:" ? "https" : "http") + "://",
    "",
  ) +
  "/bare/";

export async function registerSW() {
  const url = new URL(String(location)).searchParams;

  try {
    await (setupBareMux() &&
      (url.get("adblocker") && url.get("adblocker") === "on"
        ? navigator.serviceWorker
            .register("/sw-blacklisted.js", {
              scope: "/",
            })
            .then(reg => reg.update())
        : navigator.serviceWorker
            .register("/sw.js", {
              scope: "/",
            })
            .then(reg => reg.update())));
  } catch (error) {
    console.error("Service Worker registration failed:", error);
  }
}

async function setupBareMux() {
  const transport = ((await storage.get("transportation")) || "epoxy") as
    | "epoxy"
    | "libcurl";

  const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

  await connection.setTransport(
    transport === "epoxy"
      ? "/epoxy/index.mjs"
      : transport === "libcurl"
        ? "/libcurl/index.mjs"
        : "/baremodule/index.mjs",
    transport === "epoxy" || transport === "libcurl"
      ? [{ wisp: wispUrl }]
      : [bareUrl],
  );

  console.log(`Set transport to "/${transport}/index.mjs"`);
}

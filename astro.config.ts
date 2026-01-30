import { defineConfig } from "astro/config";
import { viteStaticCopy } from "vite-plugin-static-copy";
import playformCompress from "@playform/compress";
// @ts-expect-error
import { bareModulePath } from "@mercuryworkshop/bare-as-module3";
// @ts-ignore
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
// @ts-expect-error
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
// @ts-ignore
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath as ultravioletPath } from "@titaniumnetwork-dev/ultraviolet";
import { meteorPath } from "meteorproxy";
import tailwind from "@astrojs/tailwind";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";
import { rimraf } from "rimraf";
import { resolve } from "node:path";
import createDevServer from "./config/devServer";

const workerwarePath = resolve(import.meta.dirname, ".", "workerware", "src");

(async () => {
  await rimraf("dist");
})();

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: node({
    mode: "middleware",
  }),
  vite: {
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: bareModulePath,
            dest: "",
            rename: "baremodule",
          },
          {
            src: baremuxPath,
            dest: "",
            rename: "baremux",
          },
          {
            src: epoxyPath,
            dest: "",
            rename: "epoxy",
          },
          {
            src: libcurlPath,
            dest: "",
            rename: "libcurl",
          },
          {
            src: meteorPath,
            dest: "",
            rename: "meteor",
            overwrite: false,
          },
          {
            src: scramjetPath,
            dest: "",
            rename: "scramjet",
            overwrite: false,
          },
          {
            src: ultravioletPath,
            dest: "",
            rename: "ultraviolet",
            overwrite: false,
          },
          {
            src: workerwarePath,
            dest: "",
            rename: "workerware",
            overwrite: false,
          },
          {
            src: "public/meteor/meteor.config.js",
            dest: "meteor",
          },
          {
            src: "public/scramjet/scramjet.config.js",
            dest: "scramjet",
          },
          {
            src: "public/ultraviolet/uv.config.js",
            dest: "ultraviolet",
          },
        ],
      }),
    ],
  },
  integrations: [
    tailwind({ configFile: "tailwind.config.ts" }),
    playformCompress({
      CSS: false,
      HTML: true,
      Image: true,
      JavaScript: true,
      SVG: true,
    }),
    svelte(),
    createDevServer({
      reverseProxy: false,
    }),
  ],
});

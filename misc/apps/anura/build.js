import { cp, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";
import { solidPlugin as solid } from "esbuild-plugin-solid";
import server from "esbuild-server";
import { rimraf } from "rimraf";
import { name } from "./package.json" with { type: "json" };

await rimraf("dist");

const isDev = process.argv.includes("--dev");

const makeHtml = (scriptSrc, cssSrc) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Tab</title>
  ${cssSrc ? `<link rel="stylesheet" href="${cssSrc}" />` : ""}
  <link rel="icon" href="./icon.ico" />
  <script src="/uv/uv.bundle.js"></script>
  <script src="/uv/uv.config.js"></script>
</head>
<body>
  <div id="root"></div>
  <script src="${scriptSrc}"></script>
</body>
</html>
`;

/** @type {import("esbuild").BuildOptions} */
const config = {
    entryPoints: {
        index: "./src/index.tsx",
        newtab: "./src/newtab.tsx",
    },
    bundle: true,
    tsconfig: "./tsconfig.json",
    plugins: [solid()],
    alias: {
        "#lib": resolve("src/lib"),
        "#styles": resolve("src/styles"),
    },
    loader: { ".css": "css" },
    minify: !isDev,
    treeShaking: true,
    metafile: isDev,
    logLevel: "silent",
    outdir: "dist",
};

await build(config);

await writeFile("dist/index.html", makeHtml("./index.js", "./index.css"));
await writeFile("dist/newtab.html", makeHtml("./newtab.js", "./newtab.css"));

await cp("../../../public/favicon.ico", "dist/icon.ico");

const manifest = JSON.stringify({
    name: "Civil Proxy",
    type: "auto",
    package: name.split("-").reverse().join("."),
    index: "./index.html",
    icon: "./icon.ico",
    wininfo: {
        title: "Civil Proxy",
    },
});

await writeFile("dist/manifest.json", manifest, "utf-8");

if (isDev)
    await server(undefined, {
        static: "dist",
        port: process.env.PORT || 8877,
    }).start();

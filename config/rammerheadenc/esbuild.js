import { build } from "esbuild";
import { createColors } from "picocolors";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { globSync } = require("fast-glob");

const __dirname = path.dirname(new URL(import.meta.url).pathname);

const shouldLogInfo = process.argv.includes("--info");

let warnedInfoMissing = false;
const logInfo = (...args) => {
  if (shouldLogInfo) {
    console.info(...args);
    return;
  }
  if (!warnedInfoMissing) {
    console.log("info argument not provided, skipping info log");
    warnedInfoMissing = true;
  }
};

const { blue } = createColors();

const entries = globSync("wrapper/*.ts", {
  cwd: __dirname,
  absolute: true,
});

logInfo(blue("starting build"));

await build({
  entryPoints: entries,
  outdir: path.resolve(__dirname, "dist"),
  platform: "neutral",
  format: "esm",
  bundle: true,
  splitting: false,
  sourcemap: true,
  minify: true,
});

logInfo(blue("build complete"));

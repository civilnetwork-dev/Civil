import { removeTypes } from "remove-types";
import type { Options as PrettierOptions } from "prettier";
import { readFileSync, writeFileSync } from "node:fs";

const fileName = "index.ts";

const originalFile = readFileSync(fileName, "utf-8");

const typelessOptions = {
  tabWidth: 2,
  semi: true,
  trailingComma: "es5",
  bracketSpacing: true,
  bracketSameLine: true,
  arrowParens: "avoid",
  printWidth: 80,
  singleQuote: false,
} satisfies PrettierOptions;

const typelessFile = removeTypes(originalFile, typelessOptions);

(async () => {
  writeFileSync(fileName.replace("ts", "js"), await typelessFile);
})();

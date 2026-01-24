import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const localForagePath = resolve(
  __dirname,
  "./node_modules/localforage",
  "dist",
);

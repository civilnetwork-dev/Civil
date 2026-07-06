import type { CivilAPI } from "./index";

declare global {
    var civil: CivilAPI;
    // chrome namespace is provided by @types/chrome; browser is a Firefox-compat alias
    var browser: CivilAPI["chrome"];
}

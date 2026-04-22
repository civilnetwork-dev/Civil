import type { CivilAPI } from "./index";

declare global {
    var civil: CivilAPI;
    var chrome: CivilAPI["chrome"];
    var browser: CivilAPI["chrome"];
}

// fallow-ignore-file unused-file -- registered by run.ts once the commented-out
// useLanSchoolMiddleware(app) call there is restored; see PRODUCT.md.
import type { Hono } from "hono";

import type { AppEnv } from "../../../http";
// import { createLanSchoolChecker } from "./checker";

// const lanSchoolChecker = createLanSchoolChecker({
//    appId: "ifeifkfohlobcbhmlfkenopaimbmnahb",
//    chromeInstallerUrl:
//        "https://api-lsa.lenovosoftware.com/0/lsa/lanschool/clientInstaller/chrome"
// });

export function useLanSchoolMiddleware(app: Hono<AppEnv>) {
    app.post("/filterCheck/lanschool", c => {
        // const { url } = (await readJsonBody(c)) as { url: string };
        return c.body(null, 501);
    });
}

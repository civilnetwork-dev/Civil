import type { Express } from "express";
import { isJsonEnabled } from "../../utils/isJsonEnabled";
// import { createLanSchoolChecker } from "./checker";

// const lanSchoolChecker = createLanSchoolChecker({
//    appId: "ifeifkfohlobcbhmlfkenopaimbmnahb",
//    chromeInstallerUrl:
//        "https://api-lsa.lenovosoftware.com/0/lsa/lanschool/clientInstaller/chrome"
// });

export function useLanSchoolMiddleware(app: Express) {
    app.post("/filterCheck/lanschool", async (/*req, res*/) => {
        if (!isJsonEnabled(app)) {
            const { json } = await import("express");

            app.use(json());
        }

        // const { url } = req.body as { url: string };
    });
}

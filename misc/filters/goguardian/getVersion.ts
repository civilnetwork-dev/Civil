import { XMLParser } from "fast-xml-parser";
import xior from "xior";

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
});

export async function getGoGuardianVersion() {
    const response = await xior.get<string>(
        "https://ext.goguardian.com/stable.xml",
        { responseType: "text" },
    );

    const parsed = xmlParser.parse(response.data) as {
        gupdate: {
            app: {
                updatecheck: {
                    version: `${number}.${number}.${number}`;
                };
            };
        };
    };

    return parsed?.gupdate?.app?.updatecheck?.version;
}

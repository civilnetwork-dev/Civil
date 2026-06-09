import { XMLParser } from "fast-xml-parser";
import xior from "xior";
import { getLatestChromeVersion } from "../utils/getLatestChromeVersion";

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
});

interface ChromeUpdateXml {
    gupdate?: {
        app?: {
            updatecheck?: {
                version?: string;
                codebase?: string;
                status?: string;
            };
        };
    };
}

export async function getLatestLinewizeConnectVersion(): Promise<string> {
    const response = await xior.get<string>(
        "https://clients2.google.com/service/update2/crx",
        {
            params: {
                response: "updatecheck",
                os: "linux",
                arch: "x86-64",
                os_arch: "x86-64",
                nacl_arch: "x86-64",
                prod: "chromiumcrx",
                prodchannel: "unknown",
                prodversion: await getLatestChromeVersion(),
                acceptformat: "crx2,crx3",
                x: "id=ddfbkhpmcdbciejenfcolaaiebnjcbfc&uc",
            } as const,
            responseType: "text",
        },
    );

    const parsed = parser.parse(response.data) as ChromeUpdateXml;

    return parsed.gupdate?.app?.updatecheck?.version!;
}

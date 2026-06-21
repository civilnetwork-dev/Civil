import { checkGoGuardianFilterAuthenticated } from "./checker";
import { computeExtensionIdFromKey } from "./generateAuthToken";
import { getGoGuardianVersion } from "./getVersion";

const TEXARKANA_LICENSE_KEY =
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2Zsv+sN+lREXhcFsRT0Ih6XoH3b/WArfLLGIBJnMJFtBQxzeg2JxvwOGguKnU/zlr18oqbAJIXACgGGwwuC6aJuGmfkeLZu88PX1Uwulo/9nBZQcTgdZr3Jr+brmYrEi9OoSrTvMhd0qShhSScTp76m7KGZR1C7z05yURkEIWMO9Zy37Ci18CC55O16hH2kYFB0DgPrn5qCO5In5d17SAy7HaObeW7VMon9Qx2J3BYHOFkUKc6DY/TdU1preUHRCnxQXPjjJrjcDfjhhfUZYWRTOo7SkmNsrCnfQegmuLikRLtTkmp2QAhqMoCQbDLXDK31DWXbycFPt4gmHhgeuBQIDAQAB";

const licenseExtensionId = computeExtensionIdFromKey(TEXARKANA_LICENSE_KEY);

const extensionVersion = await getGoGuardianVersion();

const result = await checkGoGuardianFilterAuthenticated(
    {
        url: "https://pornhub.com",
        title: "Pornhub",
    },
    {
        orgRands: [licenseExtensionId],
        extensionVersion,
    },
);

if (result.isErr()) {
    console.error(result.error);
    process.exit(1);
}

console.log(result.value);

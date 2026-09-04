import { checkGoGuardianFilterAuthenticated } from "./checker";
import { computeExtensionIdFromKey } from "./generateAuthToken";
import { getGoGuardianVersion } from "./getVersion";
import { TEXARKANA_LICENSE_KEY } from "./license";

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

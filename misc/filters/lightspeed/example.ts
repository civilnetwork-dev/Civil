import { checkLightspeedFilter } from "./checker";

const result = await checkLightspeedFilter({ url: "https://cornhub.website" });

if (result.isErr()) {
    console.error(result.error);
} else {
    console.log(result.value);
}

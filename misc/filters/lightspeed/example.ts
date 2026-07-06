import { checkLightspeedFilter } from "./checker";

const result = await checkLightspeedFilter({ url: "https://cornhub.website" });

if (result.isErr()) {
    console.error("Filter check failed:", result.error);
    process.exit(1);
}

const r = result.value;
console.log("URL:", r.inputUrl);
console.log("Verdict:", r.verdict);
console.log("Blocked:", r.blocked);
console.log("Categories:", r.categories.join(", ") || "none");
console.log("Matched:", r.matchedCategory ?? "none");

import { checkHaparaFilter } from "./checker";

const result = await checkHaparaFilter({
    url: "https://pornhub.com",
    // FBI dont track me and hunt me down pleeeeeaassseeeee
    student: { kind: "by-email", email: "s951400@student.knoxschools.org" },
});

if (result.isErr()) {
    console.error("Filter check failed:", result.error);
    process.exit(1);
}

const r = result.value;
console.log("URL:", r.inputUrl);
console.log("Verdict:", r.verdict);
console.log("Blocked:", r.verdict === "BLOCKED" || r.verdict === "LOCKED");
console.log("Session:", r.sessionType ?? "none");
console.log("Monitored:", r.monitored);
console.log("Whitelisted:", r.whitelisted);

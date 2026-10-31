import { checkHaparaFilter } from "./checker";

const result = await checkHaparaFilter({
    url: "https://pornhub.com",
    // FBI dont track me and hunt me down pleeeeeaassseeeee
    student: { kind: "by-email", email: "s951400@student.knoxschools.org" },
});

if (result.isErr()) {
    console.error(result.error);
} else {
    console.log(result.value);
}

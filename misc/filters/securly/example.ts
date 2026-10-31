import { checkSecurlyFilter } from "./checker";

const result = await checkSecurlyFilter({
    useremail: "spstudent1@d11.org",
    host: "pornhub.com",
    extensionId: "ckecmkbnoanpgplccmnoikfmpcdladkc",
});

if (result.isErr()) {
    console.error(result.error);
} else {
    console.log(result.value);
}

import { checkStatus } from "./broker";
import { decodeSecurlyCategoryId } from "./categories";

const checkResult = await checkStatus({
    useremail: "spstudent1@d11.org",
    host: "pornhub.com",
    extensionId: "ckecmkbnoanpgplccmnoikfmpcdladkc",
});

if (checkResult.isErr()) {
    console.error(checkResult.error);
} else {
    console.log(checkResult.value);
    console.log(decodeSecurlyCategoryId(checkResult.value.categoryId!));
}

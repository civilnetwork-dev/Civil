import { createCiscoSecurityChecker } from "./checker";

const checker = createCiscoSecurityChecker();

const result = await checker.checkUrl("pornhub.com");

if (result.isOk()) {
    console.log(result.value);
} else {
    console.error(result.error);
}

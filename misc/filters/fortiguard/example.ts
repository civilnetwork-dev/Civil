import { createFortiGuardChecker } from "./checker";

const checker = createFortiGuardChecker();

const checkResult = await checker.checkUrl("https://pornhub.com");

if (checkResult.isErr()) {
    console.error(checkResult.error);
} else {
    console.log(checkResult.value);
}

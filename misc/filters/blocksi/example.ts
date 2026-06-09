import { createBlocksiFilterChecker } from "./checker";

const checker = createBlocksiFilterChecker();

const result = await checker.checkUrl("https://pornhub.com");

if (result.isErr()) {
    console.error(result.error.message);
} else {
    console.log(result.value);
}

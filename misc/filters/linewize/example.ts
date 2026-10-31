import { createAutoLinewizeFilterChecker } from "./checker";

const result = await createAutoLinewizeFilterChecker({
    // Dont track me FBI pleeeeeaaasseeee
    identity: "shafferj@fultonschools.org",
}).andThen(checker => checker.checkUrl({ url: "https://pornhub.com" }));

if (result.isErr()) {
    console.error(result.error);
} else {
    console.log(result.value);
}

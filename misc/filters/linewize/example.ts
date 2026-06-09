import { createAutoLinewizeFilterChecker } from "./checker";

const checkerResult = await createAutoLinewizeFilterChecker({
    // Dont track me FBI pleeeeeaaasseeee
    identity: "shafferj@fultonschools.org",
});

if (checkerResult.isErr()) {
    console.error(checkerResult.error);
    process.exit(1);
}

const result = await checkerResult.value.checkUrl({
    url: "https://pornhub.com",
});

console.log(result.isOk() ? result.value : result.error);

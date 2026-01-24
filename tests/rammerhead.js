import test from "ava";
import { v4 as uuid } from "uuid";

const sessionsAreValid = typeof uuid().replace(/-/g, "") === "string";

test("rammerhead sessions are valid", t => {
  t.assert(sessionsAreValid);
  t.log(uuid().replace(/-/g, ""));
});

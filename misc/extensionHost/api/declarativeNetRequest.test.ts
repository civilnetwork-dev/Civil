import { expect, it } from "vitest";

import { ExtensionState } from "../state";
import { buildDeclarativeNetRequest } from "./declarativeNetRequest";

it.each(["Dynamic", "Session"] as const)(
    "preserves %s rules when a replacement contains duplicate IDs",
    async scope => {
        const api = buildDeclarativeNetRequest(new ExtensionState());
        const update = api[`update${scope}Rules`];
        const get = api[`get${scope}Rules`];
        const existing = {
            id: 1,
            priority: 1,
            action: { type: "block" },
            condition: { urlFilter: "||old.invalid^" },
        } as const;
        const replacement = {
            ...existing,
            id: 2,
            condition: { urlFilter: "||new.invalid^" },
        };
        await update({ addRules: [existing] });
        await expect(
            update({
                removeRuleIds: [existing.id],
                addRules: [replacement, replacement],
            }),
        ).rejects.toThrow("Rule with id 2 already exists");
        expect(await get()).toEqual([existing]);

        await update({
            removeRuleIds: [existing.id],
            addRules: [{ ...replacement, id: existing.id }],
        });
        expect(await get()).toEqual([{ ...replacement, id: existing.id }]);
    },
);

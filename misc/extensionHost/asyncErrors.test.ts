import vm from "node:vm";

import { expect, it } from "vitest";

import { containVmRejections } from "./asyncErrors";

const detached = [
    "class Child extends Promise {} void Child.reject(new Error('detached failure'))",
    "void Promise.reject(new Error('detached failure'))",
    "void (async () => { await 0; throw new Error('detached failure'); })()",
    "Promise.resolve().then(() => { throw new Error('detached failure'); }); 0",
];
const handled = [
    "Promise.reject(new Error('handled')).catch(() => {}); 0",
    "void (async () => { try { await Promise.reject(new Error('handled')); } catch {} })()",
    "const pending = Promise.reject(new Error('handled')); queueMicrotask(() => pending.catch(() => {})); 0",
];
const settle = () => new Promise(resolve => setTimeout(resolve, 15));

it.each(detached)("contains detached VM rejection: %s", async source => {
    const errors: unknown[] = [];
    const context = vm.createContext({});
    const stop = containVmRejections(context, error => errors.push(error));
    expect(stop).toBeTypeOf("function");
    try {
        vm.runInContext(source, context);
        await settle();
        expect(errors).toHaveLength(1);
        expect(String(errors[0])).toContain("detached failure");
    } finally {
        stop?.();
    }
});

it.each(handled)(
    "preserves intentionally caught rejections: %s",
    async source => {
        const errors: unknown[] = [];
        const context = vm.createContext({ queueMicrotask });
        const stop = containVmRejections(context, error => errors.push(error));
        try {
            vm.runInContext(source, context);
            await settle();
            expect(errors).toEqual([]);
        } finally {
            stop?.();
        }
    },
);

it("disposes one observer without attributing another VM's failure to it", async () => {
    const first: unknown[] = [],
        second: unknown[] = [];
    const left = vm.createContext({}),
        right = vm.createContext({});
    const stopLeft = containVmRejections(left, error => first.push(error));
    const stopRight = containVmRejections(right, error => second.push(error));
    try {
        stopLeft?.();
        vm.runInContext(
            "Promise.reject(new Error('handled')).catch(() => {})",
            left,
        );
        vm.runInContext(
            "void Promise.reject(new Error('right failure'))",
            right,
        );
        await settle();
        expect(first).toEqual([]);
        expect(second).toHaveLength(1);
        expect(String(second[0])).toContain("right failure");
    } finally {
        stopRight?.();
    }
});

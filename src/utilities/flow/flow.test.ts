import {flow} from "mobx";

import {awaited, awaitedFlow} from "./flow";

describe("awaited", () => {
    test("hands the promise to whatever drives the generator and gives back what it is resumed with", () => {
        const promise = Promise.resolve(1);
        const generator = awaited(promise);

        expect(generator.next()).toEqual({value: promise, done: false});
        expect(generator.next(2)).toEqual({value: 2, done: true});
    });

    test("gives the flow delegating to it what the promise resolves to", async () => {
        const run = flow(function* () {
            const value = yield* awaited(Promise.resolve(3));
            return value + 1;
        });

        await expect(run()).resolves.toBe(4);
    });

    test("throws what the promise rejects with at the point the flow waited for it", async () => {
        const run = flow(function* () {
            try {
                yield* awaited(Promise.reject(new Error("failed")));
                return "resolved";
            } catch (err) {
                return (err as Error).message;
            }
        });

        await expect(run()).resolves.toBe("failed");
    });
});

describe("awaitedFlow", () => {
    test("gives the flow delegating to it what another flow resolves to", async () => {
        const inner = flow(function* () {
            yield Promise.resolve();
            return "inner";
        });
        const run = flow(function* () {
            const value = yield* awaitedFlow<string>(inner());
            return `${value} done`;
        });

        await expect(run()).resolves.toBe("inner done");
    });
});

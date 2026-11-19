jest.mock("utilities", () => ({GL2: {}}));

import {ControlMap} from "./ControlMap";

describe("ControlMap.transformPoint", () => {
    test("writes to an optional output point to avoid allocating a result", () => {
        const controlMap = new ControlMap({} as never, {} as never, {} as never, 4, 4, false);
        const grid = new Float32Array(4 * 4 * 2);
        for (let i = 0; i < grid.length; i += 2) {
            grid[i] = 5;
            grid[i + 1] = 7;
        }
        Object.assign(controlMap, {width: 4, height: 4, minPoint: {x: 0, y: 0}, maxPoint: {x: 1, y: 1}, grid});
        const output = {x: 0, y: 0};

        expect(controlMap.transformPoint({x: 0.5, y: 0.5}, output)).toBe(output);
        expect(output).toEqual({x: 5, y: 7});
        expect(controlMap.transformPoint({x: 0.5, y: 0.5})).toEqual({x: 5, y: 7});
    });
});

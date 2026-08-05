import {type Point2D} from "models";

jest.mock("utilities", () => ({
    clamp: (value: number) => value,
    toExponential: (value: number) => `${value}`,
    toFixed: (value: number) => `${value}`
}));

import {PlotContainerComponent, type PlotContainerProps} from "./PlotContainerComponent";

test("[unit] PlotContainerComponent shouldComponentUpdate handles sparse spatial profile arrays", () => {
    const sparseSpatialProfile = new Array<Point2D | undefined>(3);
    sparseSpatialProfile[1] = {x: 1, y: 2};

    const currentProps: PlotContainerProps = {
        width: 120,
        height: 80,
        data: sparseSpatialProfile as Point2D[],
        multiColorSingleLineColors: []
    };
    const nextProps: PlotContainerProps = {
        ...currentProps,
        data: [
            {x: 0, y: 0},
            {x: 1, y: 2},
            {x: 2, y: 4}
        ]
    };

    const component = new PlotContainerComponent(currentProps);
    let shouldUpdate = false;

    expect(() => {
        shouldUpdate = component.shouldComponentUpdate(nextProps);
    }).not.toThrow();
    expect(shouldUpdate).toBe(true);
});

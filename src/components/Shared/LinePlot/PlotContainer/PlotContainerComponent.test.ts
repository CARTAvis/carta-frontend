import {PlotType} from "enums";
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

test("[unit] PlotContainerComponent treats two absent multicolor arrays as unchanged", () => {
    const currentProps: PlotContainerProps = {data: []};
    const nextProps: PlotContainerProps = {data: []};
    const component = new PlotContainerComponent(currentProps);

    expect(component.shouldComponentUpdate(nextProps)).toBe(false);
});

test("[unit] Points + Lines renders markers and connecting lines", () => {
    const component = new PlotContainerComponent({
        width: 120,
        height: 80,
        data: [{x: 1, y: 2}],
        plotType: PlotType.POINTS_AND_LINES,
        pointRadius: 3,
        borderWidth: 2
    });

    const chart = component.render() as any;
    expect(chart.props.data.datasets[0]).toMatchObject({
        pointRadius: 3,
        pointStyle: "circle",
        showLine: true,
        borderWidth: 2
    });
});

test("[unit] Points + Steps renders stepped lines with markers", () => {
    const steppedComponent = new PlotContainerComponent({
        width: 120,
        height: 80,
        data: [{x: 1, y: 2}],
        plotType: PlotType.POINTS_AND_STEPS,
        pointRadius: 3,
        borderWidth: 2
    });
    const steppedChart = steppedComponent.render() as any;
    expect(steppedChart.props.data.datasets[0]).toMatchObject({
        pointRadius: 3,
        pointStyle: "circle",
        showLine: true,
        stepped: "middle",
        borderWidth: 2
    });
});

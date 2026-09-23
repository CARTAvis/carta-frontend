import {Colors} from "@blueprintjs/core";

import {genMeanRmsMarkers, type LineMarker, LinePlotComponent, type LinePlotComponentProps} from "./LinePlotComponent";

describe("genMeanRmsMarkers", () => {
    test("generates a dashed mean line and a box of one standard deviation on each side", () => {
        const markers = genMeanRmsMarkers({mean: 0.5, stdDev: 0.2}, true);
        expect(markers).toEqual([
            {value: 0.5, id: "marker-mean", draggable: false, horizontal: false, color: Colors.GREEN4, dash: [5]},
            {value: 0.5, id: "marker-rms", draggable: false, horizontal: false, width: 0.2, opacity: 0.2, color: Colors.GREEN4}
        ]);
    });

    test("uses the light theme color", () => {
        expect(genMeanRmsMarkers({mean: 1, stdDev: 1}, false).map(marker => marker.color)).toEqual([Colors.GREEN2, Colors.GREEN2]);
    });

    test.each([
        ["no histogram", null],
        ["missing mean", {stdDev: 0.2}],
        ["missing standard deviation", {mean: 0.5}],
        ["zero standard deviation", {mean: 0.5, stdDev: 0}],
        ["negative standard deviation", {mean: 0.5, stdDev: -1}],
        ["NaN mean", {mean: NaN, stdDev: 0.2}]
    ])("generates no markers with %s", (_, histogram) => {
        expect(genMeanRmsMarkers(histogram, true)).toEqual([]);
    });
});

describe("LinePlotComponent PNG export of the mean/RMS markers", () => {
    // a 200 x 100 chart area showing x in [0, 10] and y in [0, 10]
    const makeComponent = (markers: LineMarker[]) => {
        const component = new LinePlotComponent({data: [], xMin: 0, xMax: 10, yMin: 0, yMax: 10, markers} as unknown as LinePlotComponentProps) as unknown as {
            chartArea: {left: number; right: number; top: number; bottom: number};
            genMeanRMSForPngPlot: (devicePixelRatio: number) => {mean?: {x1: number; y1: number; x2: number; y2: number}; RMS?: {x: number; y: number; width: number; height: number}};
        };
        component.chartArea = {left: 0, right: 200, top: 0, bottom: 100};
        return component;
    };

    test("draws the horizontal markers of a profile across the chart width at the mean", () => {
        const {mean, RMS: rms} = makeComponent([
            {value: 5, id: "marker-mean", horizontal: true},
            {value: 5, id: "marker-rms", horizontal: true, width: 2}
        ]).genMeanRMSForPngPlot(1);
        expect(mean).toEqual(expect.objectContaining({x1: 0, x2: 200}));
        expect(mean?.y1).toBe(mean?.y2);
        expect(mean?.y1).toBeCloseTo(50.5);
        expect(rms).toEqual(expect.objectContaining({x: 0, width: 200}));
        expect(rms?.y).toBeCloseTo(30.5);
        expect(rms?.height).toBeCloseTo(40);
    });

    test("draws the vertical markers of a histogram across the chart height at the mean", () => {
        const {mean, RMS: rms} = makeComponent(genMeanRmsMarkers({mean: 5, stdDev: 1}, true)).genMeanRMSForPngPlot(1);
        expect(mean).toEqual(expect.objectContaining({y1: 0, y2: 100}));
        expect(mean?.x1).toBe(mean?.x2);
        expect(mean?.x1).toBeCloseTo(100.5);
        expect(rms).toEqual(expect.objectContaining({y: 0, height: 100}));
        expect(rms?.x).toBeCloseTo(80.5);
        expect(rms?.width).toBeCloseTo(40);
    });

    test("omits a mean outside the zoomed chart but keeps the clipped box, as on screen", () => {
        const vertical = makeComponent(genMeanRmsMarkers({mean: 11, stdDev: 2}, true)).genMeanRMSForPngPlot(1);
        expect(vertical.mean).toBeUndefined();
        expect(vertical.RMS).toEqual(expect.objectContaining({y: 0, height: 100}));
        expect((vertical.RMS?.x ?? 0) + (vertical.RMS?.width ?? 0)).toBeCloseTo(200);

        const horizontal = makeComponent([{value: -1, id: "marker-mean", horizontal: true}]).genMeanRMSForPngPlot(1);
        expect(horizontal.mean).toBeUndefined();

        const atEdge = makeComponent([{value: 10, id: "marker-mean", horizontal: false}]).genMeanRMSForPngPlot(1);
        expect(atEdge.mean?.x1).toBeCloseTo(200.5);
    });

    test("scales the geometry by the device pixel ratio and clips the box to the chart", () => {
        const {mean, RMS: rms} = makeComponent(genMeanRmsMarkers({mean: 9.5, stdDev: 2}, true)).genMeanRMSForPngPlot(2);
        expect(mean?.x1).toBeCloseTo(381);
        expect(mean?.y2).toBe(200);
        expect((rms?.x ?? 0) + (rms?.width ?? 0)).toBeCloseTo(400);
    });
});

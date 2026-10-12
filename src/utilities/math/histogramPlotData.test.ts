import {getHistogramPlotData} from "./histogramPlotData";

describe("getHistogramPlotData", () => {
    const histogram = {firstBinCenter: 0.5, binWidth: 1, bins: [4, 2, 7, 1, 3]};

    test("returns null for absent bins or invalid bin metadata", () => {
        expect(getHistogramPlotData(null)).toBeNull();
        expect(getHistogramPlotData(undefined)).toBeNull();
        expect(getHistogramPlotData({firstBinCenter: 0.5, binWidth: 1, bins: []})).toBeNull();
        expect(getHistogramPlotData({firstBinCenter: 0.5, binWidth: 1})).toBeNull();
        expect(getHistogramPlotData({binWidth: 1, bins: [1]})).toBeNull();
        expect(getHistogramPlotData({firstBinCenter: 0.5, bins: [1]})).toBeNull();
        expect(getHistogramPlotData({firstBinCenter: NaN, binWidth: 1, bins: [1]})).toBeNull();
        expect(getHistogramPlotData({firstBinCenter: 0.5, binWidth: Infinity, bins: [1]})).toBeNull();
    });

    test("accepts a first bin centered at zero", () => {
        const plotData = getHistogramPlotData({firstBinCenter: 0, binWidth: 2, bins: [1, 5]});
        expect(plotData).toEqual({
            values: [
                {x: 0, y: 1},
                {x: 2, y: 5}
            ],
            xMin: 0,
            xMax: 2,
            yMin: 1,
            yMax: 5
        });
    });

    test("returns one point per bin over the full range", () => {
        const plotData = getHistogramPlotData(histogram);
        expect(plotData?.values).toEqual([
            {x: 0.5, y: 4},
            {x: 1.5, y: 2},
            {x: 2.5, y: 7},
            {x: 3.5, y: 1},
            {x: 4.5, y: 3}
        ]);
        expect(plotData).toEqual(expect.objectContaining({xMin: 0.5, xMax: 4.5, yMin: 1, yMax: 7}));
    });

    test("keeps the bins covering the zoomed range", () => {
        const plotData = getHistogramPlotData(histogram, {min: 1.2, max: 2.7});
        expect(plotData?.values.map(point => point.x)).toEqual([0.5, 1.5, 2.5, 3.5]);
        expect(plotData).toEqual(expect.objectContaining({xMin: 0.5, xMax: 3.5, yMin: 1, yMax: 7}));
    });

    test("clamps a zoomed range that extends beyond the bins", () => {
        expect(getHistogramPlotData(histogram, {min: -100, max: 100})).toEqual(getHistogramPlotData(histogram));
        const leftOfBins = getHistogramPlotData(histogram, {min: -10, max: -5});
        expect(leftOfBins?.values).toEqual([{x: 0.5, y: 4}]);
    });

    test("returns one point when a single bin is selected", () => {
        const plotData = getHistogramPlotData(histogram, {min: 2.5, max: 2.5});
        expect(plotData).toEqual({values: [{x: 2.5, y: 7}], xMin: 2.5, xMax: 2.5, yMin: 7, yMax: 7});
        expect(getHistogramPlotData({firstBinCenter: 3, binWidth: 1, bins: [9]})?.values).toEqual([{x: 3, y: 9}]);
    });

    test("treats a missing bin count as zero", () => {
        const bins = [5, undefined, 2] as unknown as number[];
        const plotData = getHistogramPlotData({firstBinCenter: 0, binWidth: 1, bins});
        expect(plotData?.values.map(point => point.y)).toEqual([5, 0, 2]);
        expect(plotData).toEqual(expect.objectContaining({yMin: 0, yMax: 5}));
    });

    test("ignores non-finite zoom bounds", () => {
        expect(getHistogramPlotData(histogram, {min: NaN, max: 3})).toEqual(getHistogramPlotData(histogram));
    });
});

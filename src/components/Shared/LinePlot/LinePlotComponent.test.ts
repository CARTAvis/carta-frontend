import {Colors} from "@blueprintjs/core";

import {genMeanRmsMarkers} from "./LinePlotComponent";

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

import {CatalogOverlayShape} from "enums";

import {renderCatalogToSvg} from "./catalogSvgExport";
import {type ColorbarSvgOptions, renderColorbarToSvg} from "./colorbarSvgExport";
import {renderContoursToSvg} from "./contourSvgExport";
import {renderVectorOverlayToSvg} from "./vectorOverlaySvgExport";

describe("renderContoursToSvg", () => {
    test("renders contour paths with the supplied stroke styling", () => {
        const vertexData = new Float32Array([10, 20, 0, 0, 0, 0, 0, 0, 30, 40, 0, 0, 0, 0, 0, 0]);
        const group = renderContoursToSvg([vertexData], [new Int32Array([0])], [1], ["#ff0000"], [2], [4], 5, 7);

        const path = group.querySelector("path");
        expect(path).not.toBeNull();
        expect(path).toHaveAttribute("d", "M15.00,27.00L35.00,47.00");
        expect(path).toHaveAttribute("stroke", "#ff0000");
        expect(path).toHaveAttribute("stroke-width", "2");
        expect(path).toHaveAttribute("stroke-dasharray", "6,2");
    });

    test("does not link separate enclosed contours", () => {
        // Two polylines of 2 source vertices each, with a degenerate pair between them.
        // Normal pairs: offset[2]=+len, offset[6]=-len (sum=0).
        // Degenerate pair: offset[2]=cumLen from prev polyline, offset[6]=0 (sum≠0).
        const vertexData = new Float32Array([
            // Polyline 0, vertex 0: len=0
            1,
            2,
            0,
            0,
            1,
            2,
            0,
            0,
            // Polyline 0, vertex 1: len=2.83
            3,
            4,
            2.83,
            0,
            3,
            4,
            -2.83,
            0,
            // Degenerate pair: [lastPt] + [firstPt] → different coords, replaced with NaN
            NaN,
            NaN,
            2.83,
            0,
            NaN,
            NaN,
            0,
            0,
            // Polyline 1, vertex 0: len=0
            10,
            20,
            0,
            0,
            10,
            20,
            0,
            0,
            // Polyline 1, vertex 1: len=28.28
            30,
            40,
            28.28,
            0,
            30,
            40,
            -28.28,
            0
        ]);
        const group = renderContoursToSvg([vertexData], [new Int32Array([0, 4])], [1], ["#ffffff"], [1], [0], 0, 0);

        const path = group.querySelector("path");
        expect(path).not.toBeNull();
        // Two separate sub-paths, no line connecting (3,4) to (10,20)
        expect(path).toHaveAttribute("d", "M1.00,2.00L3.00,4.00M10.00,20.00L30.00,40.00");
    });
});

describe("renderVectorOverlayToSvg", () => {
    test("renders vector lines with per-vector colors", () => {
        const group = renderVectorOverlayToSvg(new Float32Array([10, 20, 8, 0, 30, 40, 6, Math.PI / 2]), 2, 1, 3, ["#00ff00", "#ff00ff"], 2, 4);

        const lines = group.querySelectorAll("line");
        expect(group).toHaveAttribute("transform", "translate(2,4)");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toHaveAttribute("stroke", "#00ff00");
        expect(lines[0]).toHaveAttribute("x1", "6.00");
        expect(lines[0]).toHaveAttribute("x2", "14.00");
        expect(lines[1]).toHaveAttribute("stroke", "#ff00ff");
    });
});

describe("renderColorbarToSvg", () => {
    const createOptions = (): ColorbarSvgOptions => ({
        colorscaleArray: [0, "#000", 1, "#fff"],
        position: "right",
        bar: {x: 100, y: 10, width: 8, height: 80, gradientVisible: true},
        ticks: {positions: [10, 50, 90], texts: ["high", "mid", "low"], visible: true, color: "#fff", width: 1, length: 4},
        numbers: {visible: true, fontFamily: "sans-serif", fontSize: 12, fontStyle: "italic", fontWeight: 700, color: "#fff", rotation: -90, gap: 10, width: 22},
        label: {text: "Jy/beam", fontFamily: "serif", fontSize: 12, fontStyle: "normal", fontWeight: 400, color: "#fff", rotation: -90},
        border: {visible: true, color: "#fff", width: 1}
    });

    test("uses the colorbar store's absolute tick positions", () => {
        const group = renderColorbarToSvg(createOptions());

        const border = group.querySelectorAll("rect")[1];
        const ticks = group.querySelectorAll("line");
        const labels = group.querySelectorAll("text");
        expect(border).toHaveAttribute("stroke", "#fff");
        expect(ticks[0]).toHaveAttribute("x1", "104");
        expect(ticks[0]).toHaveAttribute("x2", "108");
        expect(ticks[0]).toHaveAttribute("y1", "10");
        expect(ticks[1]).toHaveAttribute("y1", "50");
        expect(ticks[2]).toHaveAttribute("y1", "90");
        expect(labels[1]).toHaveAttribute("x", "124");
        expect(labels[1]).toHaveAttribute("y", ticks[1].getAttribute("y1"));
        expect(labels[1]).toHaveAttribute("text-anchor", "middle");
        expect(labels[1]).toHaveAttribute("font-style", "italic");
        expect(labels[1]).toHaveAttribute("font-weight", "700");
        expect(labels[3]).toHaveAttribute("x", "146");
        expect(labels[3]).toHaveAttribute("font-family", "serif");
    });

    test("honors gradient, tick, and number visibility", () => {
        const options = createOptions();
        options.bar.gradientVisible = false;
        options.ticks.visible = false;
        options.numbers.visible = false;
        options.label.text = "";

        const group = renderColorbarToSvg(options);

        expect(group.querySelector("rect")).toHaveAttribute("fill", "none");
        expect(group.querySelector("line")).toBeNull();
        expect(group.querySelector("text")).toBeNull();
    });

    test.each([
        ["top", "14", "10", "0", "-22"],
        ["bottom", "26", "30", "52", "74"]
    ])("renders %s ticks and labels like the canvas", (position, expectedY1, expectedY2, expectedNumberY, expectedLabelY) => {
        const options = createOptions();
        options.position = position as ColorbarSvgOptions["position"];
        options.bar = {...options.bar, width: 80, height: 20};
        options.ticks.positions = [50];
        options.ticks.texts = ["mid"];

        const group = renderColorbarToSvg(options);
        const tick = group.querySelector("line");
        const labels = group.querySelectorAll("text");

        expect(tick).toHaveAttribute("y1", expectedY1);
        expect(tick).toHaveAttribute("y2", expectedY2);
        expect(labels[0]).toHaveAttribute("y", expectedNumberY);
        expect(labels[0]).not.toHaveAttribute("transform");
        expect(labels[1]).toHaveAttribute("y", expectedLabelY);
    });
});

describe("renderCatalogToSvg", () => {
    test("renders enum-backed catalog shapes", () => {
        const group = renderCatalogToSvg(new Map([[11, new Float32Array([5, 6, 15, 16])]]), new Map([[11, CatalogOverlayShape.CIRCLE_LINED]]), new Map([[11, 8]]), new Map([[11, "#123456"]]), 3, 4);

        const circles = group.querySelectorAll("circle");
        expect(group).toHaveAttribute("transform", "translate(3,4)");
        expect(circles).toHaveLength(2);
        expect(circles[0]).toHaveAttribute("stroke", "#123456");
        expect(circles[0]).toHaveAttribute("fill", "none");
        expect(circles[0]).toHaveAttribute("r", "4");
    });
});

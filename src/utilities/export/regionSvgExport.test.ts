import {CARTA} from "carta-protobuf";

import {renderRegionsToSvg} from "./regionSvgExport";

const FRAME_VIEW = {xMin: 0, xMax: 100, yMin: 0, yMax: 100, mip: 0};

function renderRegion(region: Record<string, unknown>, pixelRatio = 1): SVGGElement {
    return renderRegionsToSvg([region as any], FRAME_VIEW, 1000, 1000, 0, 0, {pixelRatio});
}

function matchedFrame(): Record<string, unknown> {
    return {
        spatialReference: {},
        spatialTransformAST: {},
        spatialTransform: {transformCoordinate: (point: {x: number; y: number}) => point}
    };
}

function baseRegion(regionType: CARTA.RegionType, controlPoints: {x: number; y: number}[]): Record<string, unknown> {
    return {
        regionId: 1,
        regionType,
        controlPoints,
        isTemporary: false,
        color: "#00ffff",
        lineWidth: 2,
        dashLength: 0,
        rotation: 0
    };
}

describe("renderRegionsToSvg", () => {
    it("preserves point annotation shape and screen size", () => {
        const region = {
            ...baseRegion(CARTA.RegionType.ANNPOINT, [{x: 50, y: 50}]),
            pointShape: CARTA.PointAnnotationShape.BOX,
            pointWidth: 8
        };
        const group = renderRegion(region, 2);
        const point = group.querySelector("rect");

        expect(point).not.toBeNull();
        expect(point?.getAttribute("width")).toBe("16");
        expect(group.querySelector("circle")).toBeNull();
    });

    it("maps ellipse control-point axes to SVG radii", () => {
        const region = baseRegion(CARTA.RegionType.ANNELLIPSE, [
            {x: 50, y: 50},
            {x: 2, y: 8}
        ]);
        const ellipse = renderRegion(region).querySelector("ellipse");

        expect(ellipse?.getAttribute("rx")).toBe("80");
        expect(ellipse?.getAttribute("ry")).toBe("20");
    });

    it("uses the annotation font size instead of the text box size", () => {
        const region = {
            ...baseRegion(CARTA.RegionType.ANNTEXT, [
                {x: 50, y: 50},
                {x: 40, y: 10}
            ]),
            text: "label",
            fontSize: 12,
            font: "Helvetica",
            fontStyle: "Normal",
            position: CARTA.TextAnnotationPosition.CENTER
        };
        const text = renderRegion(region, 2).querySelector("text");

        expect(text?.textContent).toBe("label");
        expect(text?.getAttribute("font-size")).toBe("24");
    });

    it("preserves matched-frame line and vector approximation points", () => {
        const approximation = [
            {x: 10, y: 10},
            {x: 20, y: 30},
            {x: 40, y: 20}
        ];
        const line = {
            ...baseRegion(CARTA.RegionType.LINE, [
                {x: 10, y: 10},
                {x: 40, y: 20}
            ]),
            getRegionApproximation: () => approximation
        };
        const vector = {
            ...baseRegion(CARTA.RegionType.ANNVECTOR, [
                {x: 10, y: 10},
                {x: 40, y: 20}
            ]),
            getRegionApproximation: () => approximation,
            pointerWidth: 6,
            pointerLength: 8
        };

        const group = renderRegionsToSvg([line as any, vector as any], FRAME_VIEW, 1000, 1000, 0, 0, {frame: matchedFrame() as any});
        const polylines = group.querySelectorAll("polyline");

        expect(polylines).toHaveLength(2);
        expect(polylines[0].getAttribute("points")).toBe("100.00,900.00 200.00,700.00 400.00,800.00");
        const vectorEnd = polylines[1].getAttribute("points")?.split(" ")[2]?.split(",").map(Number);
        expect(vectorEnd?.[0]).toBeCloseTo(392.8446);
        expect(vectorEnd?.[1]).toBeCloseTo(796.4223);
        const vectorArrowhead = group.querySelector("#regions > g polygon");
        expect(vectorArrowhead).not.toBeNull();
        expect(vectorArrowhead?.getAttribute("points")?.trim().split(" ")).toHaveLength(3);
        expect(vectorArrowhead?.getAttribute("stroke-width")).toBe("2");
    });

    it("exports compass and ruler annotations", () => {
        const compass = {
            ...baseRegion(CARTA.RegionType.ANNCOMPASS, [
                {x: 20, y: 20},
                {x: 10, y: 10}
            ]),
            length: 20,
            northLabel: "N",
            eastLabel: "E",
            fontSize: 10,
            font: "Helvetica",
            fontStyle: "Normal",
            pointerWidth: 6,
            pointerLength: 8,
            northTextOffset: {x: 20, y: -40},
            eastTextOffset: {x: 40, y: 20},
            hasNorthArrowhead: true,
            hasEastArrowhead: true
        };
        const ruler = {
            ...baseRegion(CARTA.RegionType.ANNRULER, [
                {x: 20, y: 20},
                {x: 70, y: 60}
            ]),
            fontSize: 10,
            font: "Helvetica",
            fontStyle: "Normal",
            isAuxiliaryLineVisible: true,
            isAuxiliaryTextVisible: true,
            auxiliaryLineDashLength: 4,
            textOffset: {x: 0, y: 0},
            xTextOffset: {x: 0, y: 0},
            yTextOffset: {x: 0, y: 0},
            decimals: 2
        };
        const group = renderRegionsToSvg([compass as any, ruler as any], FRAME_VIEW, 1000, 1000, 0, 0, {pixelRatio: 1});

        expect(group.querySelectorAll("line").length).toBeGreaterThanOrEqual(2);
        expect(group.querySelectorAll("polyline").length).toBe(3);
        expect(group.querySelectorAll("text").length).toBe(2);
        const compassLines = [...group.querySelectorAll("line")].slice(0, 2);
        expect(Number(compassLines[0].getAttribute("y2"))).toBeCloseTo(788);
        expect(Number(compassLines[1].getAttribute("x2"))).toBeCloseTo(188);
        const compassArrowheads = group.querySelectorAll("#regions > g polygon");
        expect(compassArrowheads).toHaveLength(2);
        compassArrowheads.forEach(arrowhead => expect(arrowhead.getAttribute("points")?.trim().split(" ")).toHaveLength(3));

        const compassTexts = [...group.querySelectorAll("text")];
        expect(Number(compassTexts[0].getAttribute("y"))).toBeCloseTo(772.5);
        expect(Number(compassTexts[1].getAttribute("x"))).toBeCloseTo(172.5);
        expect(Number(compassTexts[1].getAttribute("y"))).toBeCloseTo(800);
    });
});

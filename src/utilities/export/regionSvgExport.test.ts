import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {Group} from "konva/lib/Group";
import {Ellipse} from "konva/lib/shapes/Ellipse";
import {Rect} from "konva/lib/shapes/Rect";

import {AppStore} from "stores";

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
    afterEach(() => jest.restoreAllMocks());

    it.each([
        [2, 1, 1],
        [1, 3, 1],
        [2, 1, 1.5]
    ])("matches rotated rectangle corners at zoom %s/%s and pixel aspect %s", (zoomX, zoomY, aspectRatio) => {
        const region = {
            ...baseRegion(CARTA.RegionType.RECTANGLE, [
                {x: 50, y: 50},
                {x: 20, y: 10}
            ]),
            rotation: 45
        };
        const group = renderRegionsToSvg([region as any], FRAME_VIEW, 100 * aspectRatio * zoomX, 100 * zoomY, 0, 0, {frame: {aspectRatio} as any});
        const points = group
            .querySelector("polygon")!
            .getAttribute("points")!
            .split(" ")
            .map(point => point.split(",").map(Number));
        const viewerStage = new Group({scaleX: zoomX, scaleY: zoomY});
        const rectangle = new Rect({width: 20 * aspectRatio, height: 10, rotation: -45, offsetX: 10 * aspectRatio, offsetY: 5});
        viewerStage.add(rectangle);
        const transform = rectangle.getAbsoluteTransform();
        [
            [0, 0],
            [20 * aspectRatio, 0],
            [20 * aspectRatio, 10],
            [0, 10]
        ].forEach(([x, y], index) => {
            const point = transform.point({x, y});
            expect(points[index][0]).toBeCloseTo(50 * aspectRatio * zoomX + point.x, 2);
            expect(points[index][1]).toBeCloseTo(50 * zoomY + point.y, 2);
        });
        expect(group.querySelector("polygon")).toHaveAttribute("stroke-width", "2");
        viewerStage.destroy();
    });

    it.each([
        [2, 1, 1],
        [1, 3, 1],
        [2, 1, 1.5]
    ])("matches rotated ellipse geometry at zoom %s/%s and pixel aspect %s", (zoomX, zoomY, aspectRatio) => {
        const region = {
            ...baseRegion(CARTA.RegionType.ELLIPSE, [
                {x: 50, y: 50},
                {x: 2, y: 8}
            ]),
            rotation: 45
        };
        const group = renderRegionsToSvg([region as any], FRAME_VIEW, 100 * aspectRatio * zoomX, 100 * zoomY, 0, 0, {frame: {aspectRatio} as any});
        const ellipse = group.querySelector("ellipse")!;
        const rx = Number(ellipse.getAttribute("rx"));
        const ry = Number(ellipse.getAttribute("ry"));
        const theta = (Number(ellipse.getAttribute("transform")!.match(/rotate\(([^,]+)/)![1]) * Math.PI) / 180;
        const viewerStage = new Group({scaleX: zoomX, scaleY: zoomY});
        const viewerEllipse = new Ellipse({radiusX: 8 * aspectRatio, radiusY: 2, rotation: -45});
        viewerStage.add(viewerEllipse);
        const transform = viewerEllipse.getAbsoluteTransform();
        for (let index = 0; index < 8; index++) {
            const angle = (index * Math.PI) / 4;
            const point = transform.point({x: 8 * aspectRatio * Math.cos(angle), y: 2 * Math.sin(angle)});
            const x = point.x * Math.cos(theta) + point.y * Math.sin(theta);
            const y = -point.x * Math.sin(theta) + point.y * Math.cos(theta);
            expect((x / rx) ** 2 + (y / ry) ** 2).toBeCloseTo(1);
        }
        expect(ellipse).toHaveAttribute("stroke-width", "2");
        viewerStage.destroy();
    });

    it.each([0, 0.25, 1])("preserves visual opacity %s for regions and composite annotations", opacity => {
        const point = {...baseRegion(CARTA.RegionType.POINT, [{x: 50, y: 50}]), visualOpacity: opacity};
        const text = {
            ...baseRegion(CARTA.RegionType.ANNTEXT, [
                {x: 50, y: 50},
                {x: 100, y: 20}
            ]),
            text: "label",
            fontSize: 12,
            visualOpacity: opacity
        };
        const vector = {
            ...baseRegion(CARTA.RegionType.ANNVECTOR, [
                {x: 20, y: 20},
                {x: 70, y: 60}
            ]),
            pointerWidth: 6,
            pointerLength: 8,
            visualOpacity: opacity
        };
        const group = renderRegionsToSvg([point, text, vector] as any, FRAME_VIEW, 1000, 1000, 0, 0);
        expect(group.children).toHaveLength(3);
        [...group.children].forEach(element => expect(element).toHaveAttribute("opacity", String(opacity)));
    });

    it.each([true, false])("uses viewer ruler WCS selection and centers two-point labels (WCS=%s)", isWcsCoordinates => {
        const pixelWcs = 1;
        const skyWcs = 2;
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({overlaySettings: {isWcsCoordinates}} as any);
        jest.mocked(AST.getString).mockReturnValue("");
        jest.mocked(AST.geodesicDistance).mockReturnValue((5 * 3600 * 180) / Math.PI);
        const getCurveApproximation = jest.fn(() => ({xApproximatePoints: [20, 20, 70, 20], yApproximatePoints: [70, 20, 70, 60], hypotenuseApproximatePoints: [20, 20, 70, 60], corner: {x: 70, y: 20}}));
        const ruler = {
            ...baseRegion(CARTA.RegionType.ANNRULER, [
                {x: 20, y: 20},
                {x: 70, y: 60}
            ]),
            getCurveApproximation,
            decimals: 2,
            fontSize: 10,
            textOffset: {x: 0, y: 0},
            visualOpacity: 0.5
        };
        const frame = {isValidWcs: true, wcsInfo: pixelWcs, wcsInfoForTransformation: skyWcs};
        const group = renderRegionsToSvg([ruler] as any, FRAME_VIEW, 1000, 1000, 0, 0, {frame: frame as any});
        expect(getCurveApproximation).toHaveBeenCalledWith(isWcsCoordinates ? skyWcs : pixelWcs, undefined);
        expect(group.querySelector("text")).toHaveTextContent("5.00pix");
        expect(group.querySelector("text")).toHaveAttribute("x", "450");
        expect(group.querySelector("text")).toHaveAttribute("y", "605");
        expect(group.firstElementChild).toHaveAttribute("opacity", "0.5");
    });

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

    it.each([
        [CARTA.TextAnnotationPosition.TOP, 460],
        [CARTA.TextAnnotationPosition.CENTER, 490],
        [CARTA.TextAnnotationPosition.BOTTOM, 520]
    ])("matches viewer line spacing and vertical alignment for position %s", (position, firstY) => {
        const region = {
            ...baseRegion(CARTA.RegionType.ANNTEXT, [
                {x: 50, y: 50},
                {x: 200, y: 100}
            ]),
            text: "first\nsecond",
            fontSize: 20,
            position
        };
        const spans = renderRegion(region).querySelectorAll("tspan");

        expect(spans).toHaveLength(2);
        expect(Number(spans[0].getAttribute("y"))).toBe(firstY);
        expect(Number(spans[1].getAttribute("y"))).toBe(firstY + 20);
    });

    it("wraps and limits text to the viewer's screen-space annotation box", () => {
        const region = {
            ...baseRegion(CARTA.RegionType.ANNTEXT, [
                {x: 50, y: 50},
                {x: 7, y: 24}
            ]),
            text: "one two three four",
            fontSize: 12,
            position: CARTA.TextAnnotationPosition.TOP
        };
        const spans = renderRegion(region, 2).querySelectorAll("tspan");

        expect([...spans].map(span => span.textContent)).toEqual(["one two", "three"]);
        expect(Number(spans[1].getAttribute("y")) - Number(spans[0].getAttribute("y"))).toBe(24);
    });

    it("keeps the full arrowhead when spatial approximation ends with a short segment", () => {
        const vector = {
            ...baseRegion(CARTA.RegionType.ANNVECTOR, [
                {x: 10, y: 10},
                {x: 40, y: 20}
            ]),
            getRegionApproximation: () => [
                {x: 10, y: 10},
                {x: 20, y: 10},
                {x: 30, y: 10},
                {x: 30.1, y: 10}
            ],
            pointerWidth: 6,
            pointerLength: 8
        };

        const group = renderRegionsToSvg([vector as any], FRAME_VIEW, 1000, 1000, 0, 0, {frame: matchedFrame() as any});
        const polyline = group.querySelector("polyline");
        const arrowhead = group.querySelector("polygon");
        const lineEnd = polyline?.getAttribute("points")?.split(" ").at(-1)?.split(",").map(Number);
        const arrowPoints = arrowhead
            ?.getAttribute("points")
            ?.trim()
            .split(" ")
            .map(point => point.split(",").map(Number));

        expect(lineEnd?.[0]).toBeCloseTo(292.99999999999994);
        expect(arrowPoints?.[1][0]).toBeCloseTo(301);
        expect(arrowPoints?.[0][0]).toBeCloseTo(293);
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

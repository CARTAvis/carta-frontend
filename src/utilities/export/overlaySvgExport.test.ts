import {CatalogOverlayShape} from "enums";

import {renderCatalogToSvg} from "./catalogSvgExport";
import {type ColorbarSvgOptions, renderColorbarToSvg} from "./colorbarSvgExport";
import {renderContoursToSvg} from "./contourSvgExport";
import {embedRasterAsSvgImage, namespaceSvgIds} from "./svgExport";
import {renderVectorOverlayToSvg} from "./vectorOverlaySvgExport";

test("namespaces quoted URL, inline style, and xlink references without reading path geometry", () => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.id = "panel";
    group.innerHTML = `<defs><clipPath id="clip"/><linearGradient id="gradient"/><g id="source"/></defs><path d="M1,2L3,4" clip-path="url('#clip')" style='fill:url("#gradient");stroke:url(https://example.test/external.svg#gradient)'/><use/><image/>`;
    const use = group.querySelector("use")!;
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#source");
    const dataUrl = `data:image/png;base64,${"A".repeat(4096)}`;
    group.querySelector("image")!.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl);
    const path = group.querySelector("path")!;
    const readGeometry = jest.spyOn(path.getAttributeNode("d")!, "value", "get");
    namespaceSvgIds(group, "test");
    expect(readGeometry).not.toHaveBeenCalled();
    readGeometry.mockRestore();
    expect(path).toHaveAttribute("clip-path", `url('#${group.querySelector("clipPath")!.id}')`);
    expect(path.getAttribute("style")).toContain(`url("#${group.querySelector("linearGradient")!.id}")`);
    expect(path.getAttribute("style")).toContain("url(https://example.test/external.svg#gradient)");
    expect(use.getAttributeNS("http://www.w3.org/1999/xlink", "href")).toBe(`#${group.querySelector("defs g")!.id}`);
    expect(group.querySelector("image")!.getAttributeNS("http://www.w3.org/1999/xlink", "href")).toBe(dataUrl);
    expect(group.id).toBe("test-panel-0");
});

test("serializes one full-resolution PNG reference that SVG 1.1 readers and svg2pdf can resolve", () => {
    const canvas = document.createElement("canvas");
    const dataUrl = `data:image/png;base64,${"A".repeat(4096)}`;
    const encode = jest.spyOn(canvas, "toDataURL").mockReturnValue(dataUrl);
    const image = embedRasterAsSvgImage(canvas, 5, 7, 400, 300);
    const serializer = new XMLSerializer();
    const serialized = serializer.serializeToString(image);
    const parsed = new DOMParser().parseFromString(serialized, "image/svg+xml").documentElement;
    expect(parsed.getAttributeNS("http://www.w3.org/1999/xlink", "href")).toBe(dataUrl);
    // svg2pdf resolves xlink:href before falling back to href.
    expect(image.getAttribute("xlink:href") || image.getAttribute("href")).toBe(dataUrl);
    expect(serialized.split(dataUrl)).toHaveLength(2);
    expect(image).toHaveAttribute("width", "400");
    expect(image).toHaveAttribute("height", "300");
    const duplicated = image.cloneNode(true) as SVGImageElement;
    duplicated.setAttribute("href", dataUrl);
    expect(serializer.serializeToString(duplicated).length - serialized.length).toBeGreaterThan(dataUrl.length);
    encode.mockRestore();
});

test("catalog hexagon variants preserve the shader's quarter-turn difference", () => {
    const render = (shape: CatalogOverlayShape) =>
        renderCatalogToSvg(new Map([[1, new Float32Array([10, 20])]]), new Map([[1, shape]]), new Map([[1, 30]]), new Map([[1, "red"]]), 0, 0, new Map([[1, [{rotation: 25}]]])).querySelector("polygon")!;
    const first = render(CatalogOverlayShape.HEXAGON_LINED);
    const second = render(CatalogOverlayShape.HEXAGON_LINED_2);
    expect(first).toHaveAttribute("transform", "rotate(90,10,20) rotate(-25,10,20)");
    expect(second).toHaveAttribute("transform", "rotate(-25,10,20)");
    expect(first.getAttribute("points")).toBe(second.getAttribute("points"));
});

test("namespaces SVG resources and use references while removing duplicate layer IDs", () => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.innerHTML =
        '<defs><linearGradient id="gradient"/><clipPath id="clip"><rect width="10" height="10"/></clipPath><g id="source"/></defs><g id="contours"><g id="contours"/></g><rect fill="url(#gradient)" clip-path="url(#clip)"/><use href="#source"/>';
    const other = group.cloneNode(true) as SVGGElement;
    namespaceSvgIds(group, "panel-0");
    namespaceSvgIds(other, "panel-1");
    const ids = [...group.querySelectorAll("[id]"), ...other.querySelectorAll("[id]")].map(element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const panel of [group, other]) {
        expect(panel.querySelector("rect[fill]")?.getAttribute("fill")).toBe(`url(#${panel.querySelector("linearGradient")?.id})`);
        expect(panel.querySelector("rect[clip-path]")?.getAttribute("clip-path")).toBe(`url(#${panel.querySelector("clipPath")?.id})`);
        expect(panel.querySelector("use")?.getAttribute("href")).toBe(`#${panel.querySelector("defs g")?.id}`);
    }
});

describe("renderContoursToSvg", () => {
    test("renders contour paths with the supplied stroke styling", () => {
        const chunk = {vertices: new Float32Array([10, 20, 30, 40]), indexOffsets: new Int32Array([0])};
        const group = renderContoursToSvg([chunk], "#ff0000", 2, 4, 5, 7);

        const path = group.querySelector("path");
        expect(path).not.toBeNull();
        expect(path).toHaveAttribute("d", "M15.00,27.00L35.00,47.00");
        expect(path).toHaveAttribute("stroke", "#ff0000");
        expect(path).toHaveAttribute("stroke-width", "2");
        expect(path).toHaveAttribute("stroke-dasharray", "6,2");
    });

    test("does not link separate enclosed contours", () => {
        const chunk = {vertices: new Float32Array([1, 2, 3, 4, 10, 20, 30, 40]), indexOffsets: new Int32Array([0, 4])};
        const group = renderContoursToSvg([chunk], "#ffffff", 1, 0, 0, 0);

        const path = group.querySelector("path");
        expect(path).not.toBeNull();
        // Two separate sub-paths, no line connecting (3,4) to (10,20)
        expect(path).toHaveAttribute("d", "M1.00,2.00L3.00,4.00M10.00,20.00L30.00,40.00");
    });

    test("closes enclosed contour subpaths", () => {
        const chunk = {vertices: new Float32Array([10, 20, 30, 40, 10, 20]), indexOffsets: new Int32Array([0])};
        const path = renderContoursToSvg([chunk], "#ffffff", 1, 0, 0, 0).querySelector("path");

        expect(path).toHaveAttribute("d", "M10.00,20.00L30.00,40.00L10.00,20.00Z");
    });

    test.each([true, false])("preserves open and closed contours when transforms reuse their input (%s)", shouldReuseInput => {
        const chunk = {vertices: new Float32Array([1, 2, 3, 4, 1, 2, 10, 20, 30, 40]), indexOffsets: new Int32Array([0, 6])};
        const original = chunk.vertices.slice();
        const output = {x: 0, y: 0};
        const path = renderContoursToSvg([chunk], "#fff", 1, 0, 0, 0, point => {
            const result = shouldReuseInput ? point : output;
            result.x = point.x * 2;
            result.y = point.y * 3;
            return result;
        }).querySelector("path");

        expect(path).toHaveAttribute("d", "M2.00,6.00L6.00,12.00L2.00,6.00ZM20.00,60.00L60.00,120.00");
        expect(chunk.vertices).toEqual(original);
    });

    test("preserves exact polyline boundaries when adjacent contours share a point", () => {
        const chunk = {vertices: new Float32Array([1, 2, 3, 4, 3, 4, 5, 6]), indexOffsets: new Int32Array([0, 4])};
        const path = renderContoursToSvg([chunk], "#fff", 1, 0, 0, 0).querySelector("path");
        expect(path).toHaveAttribute("d", "M1.00,2.00L3.00,4.00M3.00,4.00L5.00,6.00");
    });

    test("breaks a contour at invalid transformed points without mutating raw vertices", () => {
        const chunk = {vertices: new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]), indexOffsets: new Int32Array([0])};
        const original = chunk.vertices.slice();
        const path = renderContoursToSvg([chunk], "#fff", 1, 0, 0, 0, point => (point.x === 3 ? null : {x: point.x * 2, y: point.y * 2})).querySelector("path");
        expect(path?.getAttribute("d")).toContain("M10.00,12.00L14.00,16.00");
        expect(path?.getAttribute("d")).not.toContain("L10.00,12.00");
        expect(chunk.vertices).toEqual(original);
    });
});

describe("renderVectorOverlayToSvg", () => {
    test.each([
        {type: "number array", positions: [10, 20, 8, 0, 30, 40, 6, Math.PI / 2]},
        {type: "typed array", positions: new Float32Array([10, 20, 8, 0, 30, 40, 6, Math.PI / 2])}
    ])("renders vector lines with per-vector colors from a $type", ({positions}) => {
        const group = renderVectorOverlayToSvg(positions, 2, 1, 3, ["#00ff00", "#ff00ff"], 2, 4);

        const lines = group.querySelectorAll("line");
        expect(group).toHaveAttribute("transform", "translate(2,4)");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toHaveAttribute("stroke", "#00ff00");
        expect(lines[0]).toHaveAttribute("x1", "6.00");
        expect(lines[0]).toHaveAttribute("x2", "14.00");
        expect(lines[1]).toHaveAttribute("stroke", "#ff00ff");
    });

    test("includes the WebGL feather width in vector line thickness", () => {
        const group = renderVectorOverlayToSvg(new Float32Array([10, 20, 8, 0]), 1, 1, 3, "#00ff00", 0, 0, false, 1);

        expect(group.querySelector("line")).toHaveAttribute("stroke-width", "4");
    });

    test("renders intensity plots as filled squares", () => {
        const group = renderVectorOverlayToSvg(new Float32Array([10, 20, 8, 0]), 1, 1, 3, "#00ff00", 0, 0, true);

        expect(group.querySelector("line")).toBeNull();
        expect(group.querySelector("rect")).toHaveAttribute("x", "6.00");
        expect(group.querySelector("rect")).toHaveAttribute("y", "16.00");
        expect(group.querySelector("rect")).toHaveAttribute("width", "8.00");
        expect(group.querySelector("rect")).toHaveAttribute("height", "8.00");
    });

    test("includes the WebGL feather width in intensity plot size", () => {
        const group = renderVectorOverlayToSvg(new Float32Array([10, 20, 8, 0]), 1, 1, 3, "#00ff00", 0, 0, true, 1);

        expect(group.querySelector("rect")).toHaveAttribute("x", "5.50");
        expect(group.querySelector("rect")).toHaveAttribute("y", "15.50");
        expect(group.querySelector("rect")).toHaveAttribute("width", "9.00");
        expect(group.querySelector("rect")).toHaveAttribute("height", "9.00");
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

    test("uses deterministic gradient IDs that are scoped independently per panel", () => {
        const first = renderColorbarToSvg(createOptions());
        const second = renderColorbarToSvg(createOptions());
        expect(first.outerHTML).toBe(second.outerHTML);
        namespaceSvgIds(first, "panel-0");
        namespaceSvgIds(second, "panel-1");
        expect(first.querySelector("linearGradient")!.id).not.toBe(second.querySelector("linearGradient")!.id);
        for (const panel of [first, second]) expect(panel.querySelector("rect")).toHaveAttribute("fill", `url(#${panel.querySelector("linearGradient")!.id})`);
    });

    test("uses the colorbar store's absolute tick positions", () => {
        const group = renderColorbarToSvg(createOptions());

        const gradient = group.querySelector("linearGradient");
        const border = group.querySelectorAll("rect")[1];
        const ticks = group.querySelectorAll("line");
        const labels = group.querySelectorAll("text");
        expect(gradient).toHaveAttribute("gradientUnits", "userSpaceOnUse");
        expect(gradient).toHaveAttribute("x1", "100");
        expect(gradient).toHaveAttribute("y1", "10");
        expect(gradient).toHaveAttribute("x2", "100");
        expect(gradient).toHaveAttribute("y2", "90");
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

    test("normalizes RGBA colors for SVG gradients", () => {
        const options = createOptions();
        options.colorscaleArray = [0, "rgb(0, 0, 3, 255)", 1, "rgb(255, 255, 0, 128)"];

        const stops = renderColorbarToSvg(options).querySelectorAll("stop");

        expect(stops[0]).toHaveAttribute("stop-color", "rgba(0, 0, 3, 1)");
        expect(stops[1]).toHaveAttribute("stop-color", "rgba(255, 255, 0, 0.5019607843137255)");
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

    test("reverses horizontal gradient direction to match the canvas", () => {
        const options = createOptions();
        options.position = "bottom";
        options.bar = {...options.bar, x: 20, y: 30, width: 80, height: 10};

        const gradient = renderColorbarToSvg(options).querySelector("linearGradient");

        expect(gradient).toHaveAttribute("x1", "100");
        expect(gradient).toHaveAttribute("y1", "30");
        expect(gradient).toHaveAttribute("x2", "20");
        expect(gradient).toHaveAttribute("y2", "30");
    });
});

describe("renderCatalogToSvg", () => {
    test.each([
        {type: "number array", positions: [5, 6, 15, 16]},
        {type: "typed array", positions: new Float32Array([5, 6, 15, 16])}
    ])("renders enum-backed catalog shapes from a $type", ({positions}) => {
        const group = renderCatalogToSvg(new Map([[11, positions]]), new Map([[11, CatalogOverlayShape.CIRCLE_LINED]]), new Map([[11, 8]]), new Map([[11, "#123456"]]), 3, 4);

        const circles = group.querySelectorAll("circle");
        expect(group).toHaveAttribute("transform", "translate(3,4)");
        expect(circles).toHaveLength(2);
        expect(circles[0]).toHaveAttribute("stroke", "#123456");
        expect(circles[0]).toHaveAttribute("fill", "none");
        expect(circles[0]).toHaveAttribute("r", "3");
    });

    test("preserves mapped ellipse geometry and rotation in degrees", () => {
        const group = renderCatalogToSvg(
            new Map([[11, new Float32Array([10, 20])]]),
            new Map([[11, CatalogOverlayShape.ELLIPSE_LINED]]),
            new Map([[11, 12]]),
            new Map([[11, "#123456"]]),
            0,
            0,
            new Map([[11, [{size: 12, minorSize: 6, rotation: 45, lineWidth: 2}]]])
        );

        const ellipse = group.querySelector("ellipse");
        expect(ellipse).not.toBeNull();
        expect(ellipse).toHaveAttribute("rx", "6");
        expect(ellipse).toHaveAttribute("ry", "3");
        expect(ellipse).toHaveAttribute("transform", "rotate(90,10,20) rotate(-45,10,20)");
        expect(ellipse).toHaveAttribute("stroke-width", "2");
    });

    test.each([CatalogOverlayShape.TRIANGLE_LINED_UP, CatalogOverlayShape.TRIANGLE_LINED_DOWN, CatalogOverlayShape.HEXAGON_LINED, CatalogOverlayShape.HEXAGON_LINED_2, CatalogOverlayShape.RHOMB_LINED])(
        "preserves polygon stroke width for shape %s",
        shape => {
            const group = renderCatalogToSvg(new Map([[11, new Float32Array([10, 20])]]), new Map([[11, shape]]), new Map([[11, 12]]), new Map([[11, "#123456"]]), 0, 0, new Map([[11, [{lineWidth: 4}]]]));
            expect(group.querySelector("polygon")).toHaveAttribute("stroke-width", "4");
        }
    );

    test.each([
        CatalogOverlayShape.LineSegment_FILLED,
        CatalogOverlayShape.BOX_LINED,
        CatalogOverlayShape.CROSS_LINED,
        CatalogOverlayShape.X_LINED,
        CatalogOverlayShape.HEXAGON_LINED,
        CatalogOverlayShape.RHOMB_LINED,
        CatalogOverlayShape.TRIANGLE_LINED_UP,
        CatalogOverlayShape.TRIANGLE_LINED_DOWN
    ])("preserves mapped orientation for shape %s", shape => {
        const group = renderCatalogToSvg(new Map([[11, new Float32Array([10, 20])]]), new Map([[11, shape]]), new Map([[11, 12]]), new Map([[11, "#123456"]]), 0, 0, new Map([[11, [{rotation: 45}]]]));
        const isTriangle = shape === CatalogOverlayShape.TRIANGLE_LINED_UP || shape === CatalogOverlayShape.TRIANGLE_LINED_DOWN;
        expect(group.firstElementChild).toHaveAttribute("transform", `${isTriangle ? "" : "rotate(90,10,20) "}rotate(-45,10,20)`);
    });

    test("flips line-segment axes around the source center", () => {
        const group = renderCatalogToSvg(new Map([[11, new Float32Array([10, 20])]]), new Map([[11, CatalogOverlayShape.LineSegment_FILLED]]), new Map([[11, 12]]), new Map([[11, "#123456"]]), 0, 0);

        expect(group.querySelector("line")).toHaveAttribute("transform", "rotate(90,10,20)");
    });
});

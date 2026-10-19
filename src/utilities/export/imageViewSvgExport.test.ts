import {CARTA} from "carta-protobuf";

import {AstFonts} from "components/Shared";
import {CatalogOverlayShape, ContourDashMode, ImageType, VectorOverlaySource} from "enums";
import {AppStore} from "stores";
import * as colorUtils from "utilities/color/color";
import {renderAstOverlayToSvg} from "utilities/export/astSvgExport";
import {renderColorbarToSvg} from "utilities/export/colorbarSvgExport";

import {getImageViewSvg, getPanelSvg} from "./imageViewSvgExport";

jest.mock("utilities/export/astSvgExport", () => ({
    renderAstOverlayToSvg: jest.fn(() => null)
}));
jest.mock("utilities/export/colorbarSvgExport", () => ({
    renderColorbarToSvg: jest.fn(() => null)
}));

describe("getPanelSvg", () => {
    const padding = {left: 5, right: 0, top: 7, bottom: 0};
    const renderAstOverlayToSvgMock = jest.mocked(renderAstOverlayToSvg);
    const renderColorbarToSvgMock = jest.mocked(renderColorbarToSvg);
    let getColorsForValuesSpy: jest.SpyInstance;
    let appStoreSpy: jest.SpyInstance;
    let mockAppStore: any;
    let frame: any;

    beforeEach(() => {
        document.body.innerHTML = "";

        const panelElement = document.createElement("div");
        panelElement.id = "image-panel-0-0";

        const rasterCanvas = document.createElement("canvas");
        rasterCanvas.className = "raster-canvas";
        rasterCanvas.width = 100;
        rasterCanvas.height = 80;
        panelElement.appendChild(rasterCanvas);
        document.body.appendChild(panelElement);

        frame = {
            frameInfo: {fileId: 1, fileInfoExtended: {depth: 4}},
            renderWidth: 100,
            renderHeight: 80,
            zoomLevel: 2,
            spatialReference: null,
            spatialTransform: null,
            overlayStore: {viewWidth: 120, viewHeight: 100, padding},
            channelMapOuterOverlayStore: {viewWidth: 120, viewHeight: 100, padding},
            channelMapInnerOverlayStore: {
                viewWidth: 65,
                viewHeight: 60,
                renderWidth: 50,
                renderHeight: 40,
                gapX: 10,
                gapY: 10,
                padding: {left: 5, right: 10, top: 7, bottom: 13}
            },
            requiredFrameView: {xMin: 0, xMax: 100, yMin: 0, yMax: 80},
            renderConfig: {colorscaleArray: []},
            colorbarStore: null,
            requiredUnit: "Jy/beam",
            colorbarLabelCustomText: "Jy/beam",
            hasVisibleBeam: false,
            beamProperties: null,
            overlayBeamSettings: {isVisible: false},
            contourConfig: {
                isVisible: true,
                color: {r: 255, g: 255, b: 0, a: 1},
                isColormapEnabled: false,
                colormap: "viridis",
                colormapBias: 0,
                colormapContrast: 1,
                thickness: 2,
                dashMode: ContourDashMode.Dashed
            },
            contourStores: new Map([[1, {exportChunks: [{vertices: new Float32Array([10, 10, 20, 20]), indexOffsets: new Int32Array([0])}]}]]),
            vectorOverlayConfig: {
                isVisible: true,
                thickness: 2,
                rotationOffset: 0,
                angularSource: VectorOverlaySource.Current,
                intensitySource: VectorOverlaySource.Current,
                color: {r: 255, g: 0, b: 0, a: 1},
                isColormapEnabled: false,
                colormap: "viridis",
                colormapBias: 0,
                colormapContrast: 1,
                intensityMin: 0,
                intensityMax: 1,
                lengthMin: 0,
                lengthMax: 10
            },
            vectorOverlayStore: {
                tiles: [{numVertices: 1, vertexData: new Float32Array([20, 20, 0.5, 45])}],
                intensityMin: 0,
                intensityMax: 1
            },
            regionSet: {regionsAndAnnotationsForRender: []}
        };

        mockAppStore = {
            pixelRatio: 1,
            imageRatio: 1,
            channelMapStore: {isChannelMapEnabled: false},
            overlaySettings: {
                colorbar: {isVisible: false, position: "right"},
                global: {color: "#4C90F0"},
                colorbarHoverInfoHeight: 0
            },
            contourFrames: new Map([[frame, [frame]]]),
            vectorOverlayFrames: new Map([[frame, [frame]]]),
            catalogStore: {
                visibleCatalogFiles: new Map([[frame, [11]]]),
                catalogGLData: new Map([[11, {x: new Float32Array([30]), y: new Float32Array([40])}]]),
                catalogCounts: new Map([[11, 1]]),
                getCatalogDisplayStore: jest.fn(() => ({isSourceSizeDefined: true, catalogShape: 3, catalogSize: 6, catalogColor: "#00ff00", isImagePixelSize: false, shapeSettings: {diameterBase: 0}})),
                getFrameIdByCatalogId: jest.fn(() => 1)
            },
            getFrame: jest.fn(() => frame)
        };

        renderAstOverlayToSvgMock.mockReturnValue(null);
        renderColorbarToSvgMock.mockReturnValue(null);
        getColorsForValuesSpy = jest.spyOn(colorUtils, "getColorsForValues").mockReturnValue({color: new Uint8ClampedArray([0, 10, 20, 255, 100, 110, 120, 255]), size: 2});
        appStoreSpy = jest.spyOn(AppStore, "Instance", "get").mockReturnValue(mockAppStore as never);
    });

    afterEach(() => {
        appStoreSpy.mockRestore();
        getColorsForValuesSpy.mockRestore();
    });

    test("keeps only the raster layer embedded as an image while vectorizing overlays", () => {
        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panelSvg).not.toBeNull();
        expect(panelSvg?.querySelectorAll("image")).toHaveLength(1);
        expect(panelSvg?.querySelector("#contours")).toHaveAttribute("clip-path", "url(#contour-clip-0-0)");
        const contourClipRect = panelSvg?.querySelector("#contour-clip-0-0 rect");
        expect(contourClipRect).toHaveAttribute("x", "5");
        expect(contourClipRect).toHaveAttribute("y", "7");
        expect(contourClipRect).toHaveAttribute("width", "100");
        expect(contourClipRect).toHaveAttribute("height", "80");
        expect(panelSvg?.querySelector("#contours path")).toHaveAttribute("stroke-width", "2");
        expect(panelSvg?.querySelector("#contours path")).toHaveAttribute("stroke-dasharray", "24,8");
        expect(panelSvg?.querySelector("#vector-overlay")).not.toBeNull();
        expect(panelSvg?.querySelector("#vector-overlays")).toHaveAttribute("clip-path", "url(#contour-clip-0-0)");
        const vectorClipRect = panelSvg?.querySelector("#contour-clip-0-0 rect");
        expect(vectorClipRect).toHaveAttribute("x", "5");
        expect(vectorClipRect).toHaveAttribute("y", "7");
        expect(vectorClipRect).toHaveAttribute("width", "100");
        expect(vectorClipRect).toHaveAttribute("height", "80");
        expect(panelSvg?.querySelector("#catalog-overlay")).toHaveAttribute("clip-path", "url(#catalog-clip-0-0)");
        const catalogClipRect = panelSvg?.querySelector("#catalog-clip-0-0 rect");
        expect(catalogClipRect).toHaveAttribute("x", "0");
        expect(catalogClipRect).toHaveAttribute("y", "0");
        expect(catalogClipRect).toHaveAttribute("width", "100");
        expect(catalogClipRect).toHaveAttribute("height", "80");
    });

    test("clips coordinate overlays at the panel boundary", () => {
        const astOverlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
        astOverlay.id = "ast-overlay";
        renderAstOverlayToSvgMock.mockReturnValue(astOverlay);

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panelSvg?.querySelector("#ast-overlay")).toHaveAttribute("clip-path", "url(#ast-clip-0-0)");
        const astClipRect = panelSvg?.querySelector("#ast-clip-0-0 rect");
        expect(astClipRect).toHaveAttribute("x", "0");
        expect(astClipRect).toHaveAttribute("y", "0");
        expect(astClipRect).toHaveAttribute("width", "120");
        expect(astClipRect).toHaveAttribute("height", "100");
    });

    test("clips regions and annotations at the image viewer boundary", () => {
        frame.regionSet.regionsAndAnnotationsForRender = [
            {
                regionId: 1,
                regionType: CARTA.RegionType.ANNPOINT,
                controlPoints: [{x: 50, y: 40}],
                isTemporary: false,
                color: "#00ffff",
                lineWidth: 1,
                pointWidth: 8,
                pointShape: CARTA.PointAnnotationShape.BOX
            }
        ];

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panelSvg?.querySelector("#regions")).toHaveAttribute("clip-path", "url(#catalog-clip-0-0)");
        const regionClipRect = panelSvg?.querySelector("#catalog-clip-0-0 rect");
        expect(regionClipRect).toHaveAttribute("x", "0");
        expect(regionClipRect).toHaveAttribute("y", "0");
        expect(regionClipRect).toHaveAttribute("width", "100");
        expect(regionClipRect).toHaveAttribute("height", "80");
    });

    test("renders the AST grid below contours and vector overlays", () => {
        const astOverlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
        astOverlay.id = "ast-overlay";
        renderAstOverlayToSvgMock.mockReturnValue(astOverlay);

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const children = [...(panelSvg?.children ?? [])];
        const indexOf = (id: string) => children.findIndex(child => child.id === id);

        expect(indexOf("ast-overlay")).toBeGreaterThanOrEqual(0);
        expect(indexOf("ast-overlay")).toBeLessThan(indexOf("contours"));
        expect(indexOf("ast-overlay")).toBeLessThan(indexOf("vector-overlays"));
    });

    test("culls offscreen vectors but retains segments and strokes crossing every viewer edge", () => {
        frame.vectorOverlayConfig.intensitySource = VectorOverlaySource.None;
        const centers = [
            [-20, 40, 90],
            [120, 40, 90],
            [50, -20, 0],
            [50, 100, 0],
            [-4, 40, 90],
            [104, 40, 90],
            [50, -4, 0],
            [50, 84, 0],
            [-1.4, 40, 0],
            [NaN, 40, 0]
        ];
        frame.vectorOverlayStore.tiles = [{numVertices: centers.length, vertexData: Float32Array.from(centers.flatMap(([x, y, angle]) => [x, y, 0.5, angle]))}];
        const lines = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelectorAll("#vector-overlay line");
        expect(lines).toHaveLength(5);
        expect(lines?.[0]).toHaveAttribute("x1", "-9.00");
        expect(lines?.[1]).toHaveAttribute("x2", "109.00");
        expect(lines?.[2]).toHaveAttribute("y2", "89.00");
        expect(lines?.[3]).toHaveAttribute("y1", "-9.00");
    });

    test("retains intensity squares intersecting the viewport by their feathered extent", () => {
        frame.vectorOverlayConfig.intensitySource = VectorOverlaySource.None;
        frame.vectorOverlayConfig.angularSource = VectorOverlaySource.None;
        const centers = [
            [-5.4, 40],
            [105.4, 40],
            [50, -5.4],
            [50, 85.4],
            [-6, 40],
            [106, 40],
            [50, -6],
            [50, 86]
        ];
        frame.vectorOverlayStore.tiles = [{numVertices: centers.length, vertexData: Float32Array.from(centers.flatMap(([x, y]) => [x, y, 0.5, 0]))}];
        const squares = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelectorAll("#vector-overlay rect");
        expect(squares).toHaveLength(4);
        squares?.forEach(square => expect(square).toHaveAttribute("width", "11.00"));
    });

    test("omits wholly offscreen dense vector tiles from the SVG", () => {
        frame.vectorOverlayConfig.intensitySource = VectorOverlaySource.None;
        const data = new Float32Array(10000 * 4);
        for (let index = 0; index < 10000; index++) data.set([-100, -100, 0.5, 45], index * 4);
        frame.vectorOverlayStore.tiles = [
            {numVertices: 10000, vertexData: data},
            {numVertices: 1, vertexData: new Float32Array([20, 20, 0.5, 45])}
        ];
        const vectors = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelectorAll("#vector-overlay line");
        expect(vectors).toHaveLength(1);
    });

    test("uses the vector overlay vertical axis as the zero-angle direction", () => {
        frame.vectorOverlayStore.tiles[0].vertexData[3] = 0;

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const line = panelSvg?.querySelector("#vector-overlay line");

        expect(line).toHaveAttribute("x1", "20.00");
        expect(line).toHaveAttribute("x2", "20.00");
    });

    test("uses the normalized intensity range for color-mapped angle-only overlays", () => {
        frame.vectorOverlayConfig.intensitySource = VectorOverlaySource.None;
        frame.vectorOverlayConfig.isColormapEnabled = true;
        frame.vectorOverlayStore.tiles[0].vertexData[2] = 0;
        frame.vectorOverlayStore.intensityMin = 0;
        frame.vectorOverlayStore.intensityMax = 0;

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const line = panelSvg?.querySelector("#vector-overlay line");

        expect(line).toHaveAttribute("stroke", "rgba(0, 10, 20, 1)");
    });

    test.each([
        {range: "configured", min: 0, max: 1, storeMin: -1, storeMax: 1, lengths: [2, 6, 10], hasRange: true},
        {range: "store fallback", min: undefined, max: NaN, storeMin: 0, storeMax: 1, lengths: [2, 6, 10], hasRange: true},
        {range: "degenerate", min: 1, max: 1, storeMin: 0, storeMax: 1, lengths: [10, 10, 10], hasRange: false},
        {range: "unavailable", min: undefined, max: NaN, storeMin: undefined, storeMax: undefined, lengths: [10, 10, 10], hasRange: false}
    ])("preserves vector lengths, colors and rotation with a $range intensity range", ({min, max, storeMin, storeMax, lengths, hasRange}) => {
        Object.assign(frame.vectorOverlayConfig, {intensityMin: min, intensityMax: max, lengthMin: 2, rotationOffset: 90, isColormapEnabled: true});
        frame.vectorOverlayStore = {
            intensityMin: storeMin,
            intensityMax: storeMax,
            tiles: [{numVertices: 3, vertexData: new Float32Array([20, 20, 0, 0, 40, 20, 0.5, 0, 60, 20, 1, 0])}]
        };

        const lines = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelectorAll("#vector-overlay line");

        expect(lines).toHaveLength(3);
        lines?.forEach((line, index) => {
            expect(Number(line.getAttribute("x2")) - Number(line.getAttribute("x1"))).toBeCloseTo(lengths[index]);
            expect(line.getAttribute("y2")).toBe(line.getAttribute("y1"));
            expect(line).toHaveAttribute("stroke", hasRange && index === 0 ? "rgba(0, 10, 20, 1)" : "rgba(100, 110, 120, 1)");
        });
    });

    test.each([0, 45, 90])("preserves screen vector length at angle %s under unequal axis zoom", angle => {
        frame.zoomLevel = 4;
        frame.effectiveZoomLevel = {x: 4, y: 2};
        frame.requiredFrameView = {xMin: 0, xMax: 25, yMin: 0, yMax: 40};
        frame.vectorOverlayConfig.intensitySource = VectorOverlaySource.None;
        frame.vectorOverlayStore.tiles[0].vertexData[3] = angle;

        const line = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#vector-overlay line");
        const dx = Number(line?.getAttribute("x2")) - Number(line?.getAttribute("x1"));
        const dy = Number(line?.getAttribute("y2")) - Number(line?.getAttribute("y1"));

        expect(Math.hypot(dx, dy)).toBeCloseTo(10, 1);
    });

    test("maps only the vector center through a spatial control map", () => {
        const transformPoint = jest.fn(({x, y}) => ({x: x * 2, y: y * 2}));
        const getControlMap = jest.fn(() => ({transformPoint}));
        const sourceFrame = {...frame, getControlMap};
        sourceFrame.vectorOverlayStore = {tiles: [{numVertices: 2, vertexData: new Float32Array([20, 20, 1, 0, 30, 30, 1, 0])}]};
        sourceFrame.vectorOverlayConfig.intensitySource = VectorOverlaySource.None;
        sourceFrame.vectorOverlayStore.tiles[0].vertexData[3] = 0;
        mockAppStore.vectorOverlayFrames.set(frame, [sourceFrame]);

        const line = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#vector-overlay line");

        expect(transformPoint).toHaveBeenCalledTimes(2);
        expect(getControlMap).toHaveBeenCalledTimes(1);
        expect(Number(line?.getAttribute("y2")) - Number(line?.getAttribute("y1"))).toBeCloseTo(10);
        expect(line).toHaveAttribute("x1", "40.00");
    });

    test("resolves a contour control map once across levels and raw vertices", () => {
        const getControlMap = jest.fn(() => ({transformPoint: (point: {x: number; y: number}) => point}));
        const chunk = {vertices: new Float32Array([10, 10, 20, 20]), indexOffsets: new Int32Array([0])};
        const sourceFrame = {
            ...frame,
            getControlMap,
            contourStores: new Map([
                [1, {exportChunks: [chunk]}],
                [2, {exportChunks: [chunk]}]
            ])
        };
        mockAppStore.contourFrames.set(frame, [sourceFrame]);
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        expect(panel?.querySelectorAll("#contours path")).toHaveLength(2);
        expect(getControlMap).toHaveBeenCalledTimes(1);
        expect(panel?.querySelector("#contours path")).toHaveAttribute("d", "M14.50,77.50L24.50,67.50");
    });

    test("exports only selected catalog sources using their sorted position indices", () => {
        mockAppStore.catalogStore.catalogCounts.set(11, 2);
        mockAppStore.catalogStore.catalogGLData.set(11, {x: new Float32Array([30, 50]), y: new Float32Array([40, 40])});
        mockAppStore.catalogStore.catalogProfileStores = new Map([[11, {selectedPointIndices: [0], getSortedIndices: jest.fn(() => [1])}]]);
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, isShowingSelectedData: true, highlightColor: "#ff00ff"});

        const catalog = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay");

        expect(catalog?.querySelectorAll("circle:not([data-selection-highlight])")).toHaveLength(1);
        expect(catalog?.querySelector("circle")).toHaveAttribute("cx", "50");
        expect(catalog?.querySelector("[data-selection-highlight]")).toHaveAttribute("stroke", "#ff00ff");
        expect(catalog?.querySelector("circle:not([data-selection-highlight])")).toHaveAttribute("stroke", "#00ff00");
        expect(catalog?.querySelector("[data-selection-highlight]")).toHaveAttribute("stroke-width", "2");
    });

    test("omits offscreen catalog sources while preserving edge-crossing sources", () => {
        mockAppStore.catalogStore.catalogCounts.set(11, 3);
        mockAppStore.catalogStore.catalogGLData.set(11, {x: new Float32Array([-100, -2, 30]), y: new Float32Array([40, 40, 40])});

        const catalog = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay");

        expect(catalog?.querySelectorAll("circle")).toHaveLength(2);
        expect(catalog?.querySelector("circle")).toHaveAttribute("cx", "-2");
    });

    test.each([1, 2])("matches mapped screen-pixel circle areas at pixel ratio %s", pixelRatio => {
        mockAppStore.pixelRatio = pixelRatio;
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 2, isSizeAreaMode: true, sizeArray: () => new Float32Array([100])});

        const source = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay circle");

        // Mapped values are uploaded directly to the shader; area conversion precedes any SVG geometry.
        expect(Number(source?.getAttribute("r"))).toBeCloseTo(Math.sqrt(100 / Math.PI));
    });

    test("ignores stale minor-size maps after switching away from an ellipse", () => {
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        const sizeMinorArray = jest.fn(() => new Float32Array([1000]));
        mockAppStore.catalogStore.catalogGLData.set(11, {x: new Float32Array([-100]), y: new Float32Array([40])});
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 3, sizeMinorArray});
        expect(getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay")).toBeNull();
        expect(sizeMinorArray).not.toHaveBeenCalled();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 11, sizeMinorArray});
        expect(getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay ellipse")).not.toBeNull();
        expect(sizeMinorArray).toHaveBeenCalledTimes(1);
    });

    test("converts mapped box areas using the shape's area formula", () => {
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 1, isSizeAreaMode: true, sizeArray: () => new Float32Array([100])});

        const source = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay rect");

        expect(Number(source?.getAttribute("width"))).toBeCloseTo(10 / Math.SQRT2);
    });

    test("applies image-pixel zoom before converting a mapped area", () => {
        frame.effectiveZoomLevel = {x: 4, y: 2};
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 2, isImagePixelSize: true, isSizeAreaMode: true, sizeArray: () => new Float32Array([100])});

        const source = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay circle");

        expect(Number(source?.getAttribute("r"))).toBeCloseTo(Math.sqrt(200 / Math.PI));
    });

    test("applies the box sampling correction after image-pixel area conversion", () => {
        frame.effectiveZoomLevel = {x: 4, y: 2};
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 1, isImagePixelSize: true, isSizeAreaMode: true, sizeArray: () => new Float32Array([100])});

        const source = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay rect");

        expect(Number(source?.getAttribute("width"))).toBeCloseTo(Math.sqrt(100 * Math.SQRT2 * 2) / Math.SQRT2);
    });

    test("matches the viewer's minor-area conversion for ellipses", () => {
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 11, isSizeMinorAreaMode: true, sizeArray: () => new Float32Array([100]), sizeMinorArray: () => new Float32Array([25])});

        const source = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay ellipse");

        expect(Number(source?.getAttribute("ry"))).toBeCloseTo(Math.sqrt(100 / Math.PI));
    });

    test.each([1, 2, 4])("preserves mapped screen-pixel diameters at pixel ratio %s", pixelRatio => {
        mockAppStore.pixelRatio = pixelRatio;
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: 11, sizeArray: () => new Float32Array([20]), sizeMinorArray: () => new Float32Array([10])});
        const ellipse = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay ellipse");
        expect(ellipse).toHaveAttribute("rx", "10");
        expect(ellipse).toHaveAttribute("ry", "5");
    });

    test("omits catalogs without a defined source size until a size is selected", () => {
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        const sizeArray = jest.fn(() => new Float32Array([10]));
        const store = {...displayStore, isSourceSizeDefined: false, isImagePixelSize: true, sizeArray};
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue(store);
        expect(getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay")).toBeNull();
        expect(sizeArray).not.toHaveBeenCalled();
        store.isSourceSizeDefined = true;
        expect(getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay")).not.toBeNull();
    });

    test("skips style work when selected-only mode has no selection", () => {
        const sizeArray = jest.fn(() => new Float32Array([100]));
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, isShowingSelectedData: true, sizeArray});

        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panel?.querySelector("#catalog-overlay")).toBeNull();
        expect(sizeArray).not.toHaveBeenCalled();
    });

    test("maps spatial contours into the reference frame before exporting", () => {
        const transformedCoordinates: Array<{x: number; y: number}> = [];
        frame.spatialReference = {
            requiredFrameView: {xMin: 0, xMax: 100, yMin: 0, yMax: 80},
            zoomLevel: 2
        };
        frame.spatialTransform = {
            transformCoordinate: jest.fn(({x, y}: {x: number; y: number}) => {
                transformedCoordinates.push({x, y});
                return {x: x + 10, y: y + 20};
            }),
            scale: 1
        };
        frame.vectorOverlayConfig.isVisible = false;
        mockAppStore.catalogStore.visibleCatalogFiles = new Map();

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const path = panelSvg?.querySelector("#contours path");

        expect(path).toHaveAttribute("d", "M24.50,57.50L34.50,47.50");
        expect(transformedCoordinates).toContainEqual({x: 9.5, y: 9.5});
    });

    test("places coordinate overlays in each channel map cell", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        mockAppStore.overlaySettings.colorbar = {
            isVisible: true,
            position: "right",
            width: 10,
            offset: 2,
            hasCustomColor: false,
            color: "#fff",
            isGradientVisible: true,
            isTickVisible: true,
            hasTickCustomColor: false,
            tickColor: "#fff",
            tickWidth: 1,
            tickLen: 4,
            textGap: 5,
            isNumberVisible: true,
            numberWidth: 17,
            numberFont: 0,
            hasNumberCustomColor: false,
            numberColor: "#fff",
            numberFontSize: 12,
            numberRotation: 0,
            labelFont: 0,
            hasLabelCustomText: false,
            hasLabelCustomColor: false,
            labelColor: "#fff",
            isLabelVisible: false,
            labelFontSize: 12,
            labelRotation: 0,
            hasBorderCustomColor: false,
            borderColor: "#fff",
            isBorderVisible: false,
            borderWidth: 1
        };
        frame.renderConfig.colorscaleArray = [0, "#000", 1, "#fff"];
        frame.colorbarStore = {positions: [], texts: []};
        renderAstOverlayToSvgMock.mockImplementation(() => {
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.id = "ast-overlay";
            return group;
        });

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const coordinateViewports = panelSvg?.querySelectorAll("#channel-map-coordinate-overlays > svg");

        expect(coordinateViewports).toHaveLength(4);
        expect(panelSvg?.querySelectorAll("defs > #channel-map-coordinate-source-1")).toHaveLength(1);
        expect(panelSvg?.querySelectorAll("defs")).toHaveLength(1);
        expect(panelSvg?.querySelectorAll('#channel-map-coordinate-overlays use[href="#channel-map-coordinate-source-1"]')).toHaveLength(4);
        expect(coordinateViewports?.[0]).toHaveAttribute("x", "0");
        expect(coordinateViewports?.[0]).toHaveAttribute("y", "0");
        expect(coordinateViewports?.[0]).toHaveAttribute("width", "65");
        expect(coordinateViewports?.[0]).toHaveAttribute("height", "47");
        expect(coordinateViewports?.[0]).toHaveAttribute("viewBox", "0 0 65 47");
        expect(coordinateViewports?.[1]).toHaveAttribute("x", "65");
        expect(coordinateViewports?.[1]).toHaveAttribute("viewBox", "5 0 60 47");
        expect(coordinateViewports?.[2]).toHaveAttribute("y", "50");
        expect(coordinateViewports?.[2]).toHaveAttribute("height", "60");
        expect(coordinateViewports?.[3]).toHaveAttribute("x", "65");
        expect(coordinateViewports?.[3]).toHaveAttribute("y", "50");
        expect(renderAstOverlayToSvgMock).toHaveBeenNthCalledWith(1, frame.channelMapInnerOverlayStore, expect.anything(), mockAppStore.overlaySettings, 1);
        expect(renderAstOverlayToSvgMock).toHaveBeenNthCalledWith(2, frame.channelMapOuterOverlayStore, expect.anything(), mockAppStore.overlaySettings, 1, true);
        expect(renderColorbarToSvgMock).toHaveBeenCalledWith({
            colorscaleArray: expect.anything(),
            position: "right",
            bar: {x: 107, y: 7, width: 10, height: 80, gradientVisible: true},
            ticks: {positions: expect.anything(), texts: expect.anything(), visible: true, color: "#4C90F0", width: 1, length: 4},
            numbers: {visible: true, fontFamily: AstFonts[0].family, fontSize: 12, fontStyle: AstFonts[0].style, fontWeight: AstFonts[0].weight, color: "#4C90F0", rotation: 0, gap: 5, width: 17},
            label: {text: "", fontFamily: AstFonts[0].family, fontSize: 12, fontStyle: AstFonts[0].style, fontWeight: AstFonts[0].weight, color: "#4C90F0", rotation: 0},
            border: {visible: false, color: "#4C90F0", width: 1}
        });
    });

    test("omits the colorbar from color-blending SVG panels", () => {
        mockAppStore.overlaySettings.colorbar.isVisible = true;
        frame.renderConfig.colorscaleArray = [0, "#000", 1, "#fff"];
        frame.colorbarStore = {positions: [], texts: []};
        renderColorbarToSvgMock.mockClear();

        getPanelSvg(0, 0, 100, {type: ImageType.COLOR_BLENDING, store: {baseFrame: frame}} as never);

        expect(renderColorbarToSvgMock).not.toHaveBeenCalled();
    });

    test.each([
        [true, true],
        [false, true],
        [true, false],
        [false, false]
    ])("honors color-blending contour (%s) and vector (%s) visibility without exporting beams", (isContourVisible, isVectorOverlayVisible) => {
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.COLOR_BLENDING, store: {baseFrame: frame, isContourVisible, isVectorOverlayVisible}} as never);

        expect(panel?.querySelectorAll("#contours path")).toHaveLength(isContourVisible ? 1 : 0);
        expect(panel?.querySelectorAll("#vector-overlay line")).toHaveLength(isVectorOverlayVisible ? 1 : 0);
        expect(panel?.querySelector("#beams, #beam-profile, [id^='beam-clip']")).toBeNull();
    });

    test("exports clipped color-blending overlays when the raster is hidden", () => {
        document.querySelector(".raster-canvas")?.remove();
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.COLOR_BLENDING, store: {baseFrame: frame, isRasterVisible: false, isContourVisible: true, isVectorOverlayVisible: true}} as never);

        expect(panel?.querySelector("image")).toBeNull();
        expect(panel?.querySelector("#contours")).toHaveAttribute("clip-path", "url(#contour-clip-0-0)");
        expect(panel?.querySelector("#vector-overlays")).toHaveAttribute("clip-path", "url(#contour-clip-0-0)");
        expect(panel?.querySelector("#contour-clip-0-0 rect")).toHaveAttribute("width", "100");
        expect(panel?.querySelector("#contour-clip-0-0 rect")).toHaveAttribute("height", "80");
    });

    test("omits a hidden color-blending raster even if its canvas is still mounted", () => {
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.COLOR_BLENDING, store: {baseFrame: frame, isRasterVisible: false}} as never);

        expect(panel?.querySelector("image")).toBeNull();
        expect(panel?.querySelector("#contours path")).not.toBeNull();
    });

    test.each([false, true])("omits resources for fully filtered regions (channel map=%s)", isChannelMapEnabled => {
        mockAppStore.channelMapStore = {isChannelMapEnabled, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        mockAppStore.catalogStore.visibleCatalogFiles = new Map();
        frame.contourConfig.isVisible = false;
        frame.vectorOverlayConfig.isVisible = false;
        frame.regionSet.regionsAndAnnotationsForRender = [
            {regionType: CARTA.RegionType.POINT, controlPoints: [{x: 50, y: 40}], visualOpacity: 0},
            {regionType: CARTA.RegionType.POINT, controlPoints: [{x: 10, y: 10}], isTemporary: true}
        ];

        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panel?.querySelector("#regions, #channel-map-regions, defs, clipPath, use")).toBeNull();
    });

    test("omits channel-map region resources when no channel cell is valid", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [4, 5], numColumns: 2, numRows: 1};
        frame.regionSet.regionsAndAnnotationsForRender = [{regionType: CARTA.RegionType.POINT, controlPoints: [{x: 50, y: 40}], color: "#fff", lineWidth: 1}];
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panel?.querySelector("#regions, #channel-map-regions, defs, use")).toBeNull();
    });

    test("omits empty beam groups and clips when all beam plots are unavailable", () => {
        frame.hasVisibleBeam = true;
        const contourFrame = {...frame, beamProperties: {x: 10, y: 6, angle: 0}, overlayBeamSettings: {isVisible: false}, contourStores: new Map()};
        mockAppStore.contourFrames.set(frame, [frame, contourFrame]);
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);

        expect(panel?.querySelector("#beams, #beam-profile, [id^='beam-clip']")).toBeNull();
        expect(panel?.querySelector("#contours path")).not.toBeNull();
    });

    test("places the beam in the bottom-left channel map cell", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const beams = panelSvg?.querySelector("#beams");

        expect(beams).toHaveAttribute("transform", "translate(5,57)");
    });

    test.each([1, 2])("clips oversized channel-map beams to their bottom-left tile at pixel ratio %s", pixelRatio => {
        mockAppStore.pixelRatio = pixelRatio;
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        frame.renderWidth = frame.channelMapInnerOverlayStore.renderWidth;
        frame.renderHeight = frame.channelMapInnerOverlayStore.renderHeight;
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 200, y: 200, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const beams = panel?.querySelector("#beams");
        expect(beams).toHaveAttribute("transform", `translate(${5 * pixelRatio},${57 * pixelRatio})`);
        expect(beams).toHaveAttribute("clip-path", "url(#beam-clip-0-0)");
        const clip = panel?.querySelector("#beam-clip-0-0 rect");
        expect(clip).toHaveAttribute("x", "0");
        expect(clip).toHaveAttribute("y", "0");
        expect(clip).toHaveAttribute("width", `${50 * pixelRatio}`);
        expect(clip).toHaveAttribute("height", `${40 * pixelRatio}`);
    });

    test("renders clipped regions in every valid channel cell without unsupported overlays", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 4], numColumns: 2, numRows: 2};
        frame.regionSet.regionsAndAnnotationsForRender = [{regionType: CARTA.RegionType.POINT, controlPoints: [{x: 50, y: 40}], color: "#fff", lineWidth: 1}];
        frame.channelMapOuterOverlayStore.viewWidth = 140;
        renderAstOverlayToSvgMock.mockImplementation(() => document.createElementNS("http://www.w3.org/2000/svg", "g"));

        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const viewports = panel?.querySelectorAll("#channel-map-regions > svg");
        expect(viewports).toHaveLength(3);
        expect(viewports?.[0]).toHaveAttribute("x", "5");
        expect(viewports?.[0]).toHaveAttribute("y", "7");
        expect(viewports?.[1]).toHaveAttribute("x", "65");
        expect(viewports?.[2]).toHaveAttribute("y", "57");
        viewports?.forEach(viewport => {
            expect(viewport).toHaveAttribute("width", "50");
            expect(viewport).toHaveAttribute("height", "40");
            expect(viewport).toHaveAttribute("overflow", "hidden");
            expect(viewport.querySelector("use")).toHaveAttribute("href", "#channel-map-region-source-1");
        });
        expect(panel?.querySelector("#ast-clip-0-0 rect")).toHaveAttribute("width", "140");
        expect(panel?.querySelector("#contours, #vector-overlays, #catalog-overlay")).toBeNull();
    });

    test.each([true, false])("clips channel-map regions only to their tile viewports (raster=%s)", hasRaster => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        // Ceil-rounded tiles extend beyond the raster by a pixel on the right/bottom.
        const raster = document.querySelector(".raster-canvas") as HTMLCanvasElement;
        raster.width = 109;
        raster.height = 89;
        if (!hasRaster) raster.remove();
        frame.regionSet.regionsAndAnnotationsForRender = [{regionType: CARTA.RegionType.POINT, controlPoints: [{x: 99, y: 1}], color: "#fff", lineWidth: 1}];
        const panel = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const regions = panel?.querySelector("#channel-map-regions");
        expect(regions).not.toHaveAttribute("clip-path");
        const viewports = regions?.querySelectorAll(":scope > svg");
        expect(viewports).toHaveLength(4);
        expect(viewports?.[3]).toHaveAttribute("x", "65");
        expect(viewports?.[3]).toHaveAttribute("y", "57");
        viewports?.forEach(viewport => {
            expect(viewport).toHaveAttribute("width", "50");
            expect(viewport).toHaveAttribute("height", "40");
            expect(viewport).toHaveAttribute("overflow", "hidden");
        });
    });

    test("initializes a matched catalog control map once before sampling sources", () => {
        let isReady = false;
        const updateCatalogBoundary = jest.fn(() => {
            isReady = true;
        });
        const transformPoint = jest.fn(point => (isReady ? point : null));
        const getCatalogControlMap = jest.fn(() => ({updateCatalogBoundary, transformPoint}));
        mockAppStore.getFrame.mockReturnValue({...frame, getCatalogControlMap});
        mockAppStore.catalogStore.catalogCounts.set(11, 2);
        mockAppStore.catalogStore.catalogGLData.set(11, {x: new Float32Array([30, 50]), y: new Float32Array([40, 40])});

        const catalog = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay");
        expect(catalog?.querySelectorAll("circle")).toHaveLength(2);
        expect(getCatalogControlMap).toHaveBeenCalledTimes(1);
        expect(updateCatalogBoundary).toHaveBeenCalledTimes(1);
        expect(transformPoint).toHaveBeenCalledTimes(2);
    });

    test("scales beam geometry in screen axes after rotation for unequal zoom", () => {
        frame.hasVisibleBeam = true;
        frame.effectiveZoomLevel = {x: 4, y: 2};
        frame.beamProperties = {x: 10, y: 6, angle: 45};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};
        const beam = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#beam-profile");
        const x = 2 * Math.sqrt((10 * 10) / 2 + (6 * 6) / 2) + 10;
        const y = 80 - Math.sqrt((10 * 10) / 2 + (6 * 6) / 2) - 10;
        const ellipse = beam?.querySelector("ellipse");
        const rx = Number(ellipse?.getAttribute("rx"));
        const ry = Number(ellipse?.getAttribute("ry"));
        const theta = (Number(ellipse?.getAttribute("transform")?.match(/rotate\(([^,]+)/)?.[1]) * Math.PI) / 180;
        expect(Number(ellipse?.getAttribute("cx"))).toBeCloseTo(x);
        expect(Number(ellipse?.getAttribute("cy"))).toBeCloseTo(y);
        expect(Math.hypot(rx * Math.cos(theta), ry * Math.sin(theta))).toBeCloseTo(2 * Math.sqrt(68));
        expect(Math.hypot(rx * Math.sin(theta), ry * Math.cos(theta))).toBeCloseTo(Math.sqrt(68));
        expect(ellipse).toHaveAttribute("stroke-width", "1");
        expect(beam?.getAttribute("transform")).toBeNull();
        expect(Number(beam?.querySelector("line")?.getAttribute("x1"))).toBeCloseTo(x - 20 / Math.SQRT2);
        expect(Number(beam?.querySelector("line")?.getAttribute("y1"))).toBeCloseTo(y - 10 / Math.SQRT2);
    });

    test("derives raster and region padding separately for each image panel", () => {
        frame.regionSet.regionsAndAnnotationsForRender = [{regionType: CARTA.RegionType.POINT, controlPoints: [{x: 50, y: 40}], color: "#fff", lineWidth: 1}];
        const secondPanel = document.getElementById("image-panel-0-0")!.cloneNode(true) as HTMLElement;
        secondPanel.id = "image-panel-1-0";
        document.body.appendChild(secondPanel);
        const secondFrame = {...frame, overlayStore: {...frame.overlayStore, padding: {left: 13, right: 0, top: 17, bottom: 0}}};
        mockAppStore.fullViewWidth = 240;
        mockAppStore.fullViewHeight = 100;
        mockAppStore.imageViewConfigStore = {
            numImageColumns: 2,
            visibleImages: [
                {type: ImageType.FRAME, store: frame},
                {type: ImageType.FRAME, store: secondFrame}
            ]
        };
        const svg = getImageViewSvg();
        const images = svg?.querySelectorAll("image");
        expect(images).toHaveLength(2);
        expect(images?.[0]).toHaveAttribute("x", "5");
        expect(images?.[0]).toHaveAttribute("y", "7");
        expect(images?.[1]).toHaveAttribute("x", "13");
        expect(images?.[1]).toHaveAttribute("y", "17");
        const regions = svg?.querySelectorAll('g[id*="-regions-"]');
        expect(regions).toHaveLength(2);
        expect(regions?.[0]).toHaveAttribute("transform", "translate(5,7)");
        expect(regions?.[1]).toHaveAttribute("transform", "translate(13,17)");
    });

    test("uses outer overlay padding in channel-map mode", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0], numColumns: 1, numRows: 1};
        frame.channelMapOuterOverlayStore.padding = {left: 13, right: 0, top: 17, bottom: 0};
        const image = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("image");
        expect(image).toHaveAttribute("x", "13");
        expect(image).toHaveAttribute("y", "17");
    });

    test("scopes all IDs and references across multi-panel exports", () => {
        const firstPanel = document.getElementById("image-panel-0-0");
        const secondPanel = firstPanel?.cloneNode(true) as HTMLElement;
        secondPanel.id = "image-panel-1-0";
        document.body.appendChild(secondPanel);
        mockAppStore.fullViewWidth = 240;
        mockAppStore.fullViewHeight = 100;
        mockAppStore.imageViewConfigStore = {
            numImageColumns: 2,
            visibleImages: [
                {type: ImageType.FRAME, store: frame},
                {type: ImageType.FRAME, store: frame}
            ]
        };
        const svg = getImageViewSvg();
        const ids = [...(svg?.querySelectorAll("[id]") ?? [])].map(element => element.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.some(id => id.startsWith("panel-0-0-contours"))).toBe(true);
        expect(ids.some(id => id.startsWith("panel-1-0-contours"))).toBe(true);
        svg?.querySelectorAll("[clip-path]").forEach(element => {
            const id = element.getAttribute("clip-path")?.slice(5, -1);
            expect(ids).toContain(id);
        });
    });

    test("renders vector overlays in front of the beam", () => {
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const children = [...(panelSvg?.children ?? [])];
        const indexOf = (id: string) => children.findIndex(child => child.id === id);

        expect(indexOf("vector-overlays")).toBeGreaterThan(indexOf("beams"));
    });

    test("renders contours in front of the beam", () => {
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const children = [...(panelSvg?.children ?? [])];
        const indexOf = (id: string) => children.findIndex(child => child.id === id);

        expect(indexOf("contours")).toBeGreaterThan(indexOf("beams"));
    });

    test("scales beam geometry once for SVG output", () => {
        mockAppStore.pixelRatio = 2;
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const beam = panelSvg?.querySelector("#beam-profile ellipse");

        expect(panelSvg?.querySelector("#beams")).toHaveAttribute("transform", "translate(10,14)");
        expect(beam).toHaveAttribute("cx", "32");
        expect(beam).toHaveAttribute("cy", "120");
        expect(beam).toHaveAttribute("rx", "20");
        expect(beam).toHaveAttribute("ry", "12");
    });

    test.each([
        [0, 1],
        [1, 2]
    ])("clips oversized beams within panel %s at pixel ratio %s", (column, pixelRatio) => {
        mockAppStore.pixelRatio = pixelRatio;
        const panelElement = document.getElementById("image-panel-0-0")!;
        panelElement.id = `image-panel-${column}-0`;
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 200, y: 200, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panel = getPanelSvg(column, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const ellipse = panel?.querySelector("#beam-profile ellipse");
        expect(Number(ellipse?.getAttribute("cx")) - Number(ellipse?.getAttribute("rx"))).toBeLessThan(0);
        expect(panel?.querySelector("#beams")).toHaveAttribute("clip-path", `url(#beam-clip-${column}-0)`);
        const clip = panel?.querySelector(`#beam-clip-${column}-0 rect`);
        expect(clip).toHaveAttribute("x", "0");
        expect(clip).toHaveAttribute("y", "0");
        expect(clip).toHaveAttribute("width", `${100 * pixelRatio}`);
        expect(clip).toHaveAttribute("height", `${80 * pixelRatio}`);
    });

    test("scales screen-pixel catalog source dimensions on Retina displays", () => {
        mockAppStore.pixelRatio = 2;
        mockAppStore.imageRatio = 1;
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            catalogShape: 1,
            isSourceSizeDefined: true,
            catalogSize: 6,
            catalogColor: "#00ff00",
            isImagePixelSize: false,
            thickness: 2,
            shapeSettings: {diameterBase: 0}
        });

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const source = panelSvg?.querySelector("#catalog-overlay rect");

        expect(Number(source?.getAttribute("width"))).toBeCloseTo(12 / Math.SQRT2);
        expect(source).toHaveAttribute("stroke-width", "4");
    });

    test("scales image-pixel catalog source sizes with the exported image view", () => {
        mockAppStore.pixelRatio = 2;
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            catalogShape: 2,
            isSourceSizeDefined: true,
            catalogSize: 6,
            catalogColor: "#00ff00",
            isImagePixelSize: true,
            shapeSettings: {diameterBase: 0}
        });

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const source = panelSvg?.querySelector("#catalog-overlay circle");

        expect(source).toHaveAttribute("r", "6");
    });

    test.each([
        {zoomX: 4, aspectRatio: 1, pixelRatio: 1},
        {zoomX: 2, aspectRatio: 2, pixelRatio: 1},
        {zoomX: 4, aspectRatio: 2, pixelRatio: 2},
        {zoomX: 4, aspectRatio: 1, pixelRatio: 4}
    ])("sizes image-pixel catalogs using Y zoom with $zoomX X zoom, $aspectRatio aspect ratio and $pixelRatio pixel ratio", ({zoomX, aspectRatio, pixelRatio}) => {
        mockAppStore.pixelRatio = pixelRatio;
        frame.effectiveZoomLevel = {x: zoomX, y: 2};
        frame.aspectRatio = aspectRatio;
        frame.requiredFrameView = {xMin: 0, xMax: 100 / (zoomX * aspectRatio), yMin: 0, yMax: 40};
        mockAppStore.catalogStore.catalogGLData.set(11, {x: new Float32Array([10]), y: new Float32Array([10])});
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({...displayStore, catalogShape: CatalogOverlayShape.CIRCLE_FILLED, isImagePixelSize: true});

        const source = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay circle");
        expect(source).toHaveAttribute("r", `${6 * pixelRatio}`);
    });

    test("sizes mapped angular ellipse axes using the matched reference view's Y scale", () => {
        mockAppStore.pixelRatio = 2;
        frame.spatialReference = {requiredFrameView: {xMin: 0, xMax: 25, yMin: 0, yMax: 40}, effectiveZoomLevel: {x: 4, y: 2}, zoomLevel: 2};
        frame.spatialTransform = {scale: 1, rotation: 0, transformCoordinate: (point: {x: number; y: number}) => point};
        mockAppStore.catalogStore.catalogGLData.set(11, {x: new Float32Array([10]), y: new Float32Array([10])});
        const displayStore = mockAppStore.catalogStore.getCatalogDisplayStore();
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            ...displayStore,
            catalogShape: CatalogOverlayShape.ELLIPSE_LINED,
            isImagePixelSize: true,
            isAngularSize: true,
            sizeArray: () => new Float32Array([6]),
            sizeMinorArray: () => new Float32Array([3])
        });

        const ellipse = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never)?.querySelector("#catalog-overlay ellipse");
        expect(ellipse).toHaveAttribute("rx", "24");
        expect(ellipse).toHaveAttribute("ry", "12");
    });

    test("applies ellipse diameter tuning to angular-size exports", () => {
        mockAppStore.pixelRatio = 2;
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            catalogShape: 11,
            isSourceSizeDefined: true,
            catalogSize: 6,
            catalogColor: "#00ff00",
            isImagePixelSize: true,
            isAngularSize: true,
            shapeSettings: {diameterBase: 0}
        });

        const panelSvg = getPanelSvg(0, 0, 100, {type: ImageType.FRAME, store: frame} as never);
        const source = panelSvg?.querySelector("#catalog-overlay ellipse");

        expect(source).toHaveAttribute("rx", "12");
    });
});

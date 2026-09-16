import {CARTA} from "carta-protobuf";

import {AstFonts} from "components/Shared";
import {ContourDashMode, ImageType, VectorOverlaySource} from "enums";
import {AppStore} from "stores";
import * as colorUtils from "utilities/color/color";
import {renderAstOverlayToSvg} from "utilities/export/astSvgExport";
import {renderColorbarToSvg} from "utilities/export/colorbarSvgExport";

import {getPanelSvg} from "./ImageViewComponent";

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
            contourStores: new Map([[1, {exportVertexData: [new Float32Array([10, 10, 0, 0, 10, 10, 0, 0, 20, 20, 0, 0, 20, 20, 0, 0])], exportIndexOffsets: [new Int32Array([2])]}]]),
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
                getCatalogDisplayStore: jest.fn(() => ({catalogShape: 3, catalogSize: 6, catalogColor: "#00ff00", isImagePixelSize: false, shapeSettings: {diameterBase: 0}})),
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
        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);

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
        expect(panelSvg?.querySelector("#vector-overlays")).toHaveAttribute("clip-path", "url(#vector-clip-0-0)");
        const vectorClipRect = panelSvg?.querySelector("#vector-clip-0-0 rect");
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

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);

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

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);

        expect(panelSvg?.querySelector("#regions")).toHaveAttribute("clip-path", "url(#regions-clip-0-0)");
        const regionClipRect = panelSvg?.querySelector("#regions-clip-0-0 rect");
        expect(regionClipRect).toHaveAttribute("x", "0");
        expect(regionClipRect).toHaveAttribute("y", "0");
        expect(regionClipRect).toHaveAttribute("width", "100");
        expect(regionClipRect).toHaveAttribute("height", "80");
    });

    test("renders the AST grid below contours and vector overlays", () => {
        const astOverlay = document.createElementNS("http://www.w3.org/2000/svg", "g");
        astOverlay.id = "ast-overlay";
        renderAstOverlayToSvgMock.mockReturnValue(astOverlay);

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const children = [...(panelSvg?.children ?? [])];
        const indexOf = (id: string) => children.findIndex(child => child.id === id);

        expect(indexOf("ast-overlay")).toBeGreaterThanOrEqual(0);
        expect(indexOf("ast-overlay")).toBeLessThan(indexOf("contours"));
        expect(indexOf("ast-overlay")).toBeLessThan(indexOf("vector-overlays"));
    });

    test("uses the vector overlay vertical axis as the zero-angle direction", () => {
        frame.vectorOverlayStore.tiles[0].vertexData[3] = 0;

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
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

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const line = panelSvg?.querySelector("#vector-overlay line");

        expect(line).toHaveAttribute("stroke", "rgba(0, 10, 20, 1)");
    });

    test("maps spatial contours into the reference frame before exporting", () => {
        frame.spatialReference = {
            requiredFrameView: {xMin: 0, xMax: 100, yMin: 0, yMax: 80},
            zoomLevel: 2
        };
        frame.spatialTransform = {
            transformCoordinate: jest.fn(({x, y}: {x: number; y: number}) => ({x: x + 10, y: y + 20})),
            scale: 1
        };
        frame.vectorOverlayConfig.isVisible = false;
        mockAppStore.catalogStore.visibleCatalogFiles = new Map();

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const path = panelSvg?.querySelector("#contours path");

        expect(path).toHaveAttribute("d", "M24.50,57.50L34.50,47.50");
        expect(frame.spatialTransform.transformCoordinate).toHaveBeenCalledWith({x: 9.5, y: 9.5}, true);
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

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const coordinateViewports = panelSvg?.querySelectorAll("#channel-map-coordinate-overlays > svg");

        expect(coordinateViewports).toHaveLength(4);
        expect(panelSvg?.querySelectorAll("#channel-map-coordinate-overlays defs > #channel-map-coordinate-source-1")).toHaveLength(1);
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
        expect(renderAstOverlayToSvgMock).toHaveBeenNthCalledWith(2, frame.channelMapOuterOverlayStore, expect.anything(), mockAppStore.overlaySettings, 1);
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

        getPanelSvg(0, 0, 100, padding, {type: ImageType.COLOR_BLENDING, store: {baseFrame: frame}} as never);

        expect(renderColorbarToSvgMock).not.toHaveBeenCalled();
    });

    test("places the beam in the bottom-left channel map cell", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const beams = panelSvg?.querySelector("#beams");

        expect(beams).toHaveAttribute("transform", "translate(5,57)");
    });

    test("renders vector overlays in front of the beam", () => {
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const children = [...(panelSvg?.children ?? [])];
        const indexOf = (id: string) => children.findIndex(child => child.id === id);

        expect(indexOf("vector-overlays")).toBeGreaterThan(indexOf("beams"));
    });

    test("renders contours in front of the beam", () => {
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const children = [...(panelSvg?.children ?? [])];
        const indexOf = (id: string) => children.findIndex(child => child.id === id);

        expect(indexOf("contours")).toBeGreaterThan(indexOf("beams"));
    });

    test("scales beam geometry once for SVG output", () => {
        mockAppStore.pixelRatio = 2;
        frame.hasVisibleBeam = true;
        frame.beamProperties = {x: 10, y: 6, angle: 0};
        frame.overlayBeamSettings = {isVisible: true, color: "#fff", width: 1, shiftX: 0, shiftY: 0};

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const beam = panelSvg?.querySelector("#beam-profile ellipse");

        expect(panelSvg?.querySelector("#beams")).toHaveAttribute("transform", "translate(10,14)");
        expect(beam).toHaveAttribute("cx", "32");
        expect(beam).toHaveAttribute("cy", "120");
        expect(beam).toHaveAttribute("rx", "20");
        expect(beam).toHaveAttribute("ry", "12");
    });

    test("scales screen-pixel catalog source dimensions on Retina displays", () => {
        mockAppStore.pixelRatio = 2;
        mockAppStore.imageRatio = 1;
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            catalogShape: 1,
            catalogSize: 6,
            catalogColor: "#00ff00",
            isImagePixelSize: false,
            thickness: 2,
            shapeSettings: {diameterBase: 0}
        });

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const source = panelSvg?.querySelector("#catalog-overlay rect");

        expect(source).toHaveAttribute("width", "12");
        expect(source).toHaveAttribute("stroke-width", "4");
    });

    test("scales image-pixel catalog source sizes with the exported image view", () => {
        mockAppStore.pixelRatio = 2;
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            catalogShape: 2,
            catalogSize: 6,
            catalogColor: "#00ff00",
            isImagePixelSize: true,
            shapeSettings: {diameterBase: 0}
        });

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const source = panelSvg?.querySelector("#catalog-overlay circle");

        expect(source).toHaveAttribute("r", "6");
    });

    test("does not apply WebGL quad tuning to angular-size ellipses", () => {
        mockAppStore.pixelRatio = 2;
        mockAppStore.catalogStore.getCatalogDisplayStore.mockReturnValue({
            catalogShape: 11,
            catalogSize: 6,
            catalogColor: "#00ff00",
            isImagePixelSize: true,
            isAngularSize: true,
            shapeSettings: {diameterBase: 0}
        });

        const panelSvg = getPanelSvg(0, 0, 100, padding, {type: ImageType.FRAME, store: frame} as never);
        const source = panelSvg?.querySelector("#catalog-overlay ellipse");

        expect(source).toHaveAttribute("rx", "6");
    });
});

import {ContourDashMode, ImageType, VectorOverlaySource} from "enums";
import {AppStore} from "stores";
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
            channelMapStore: {isChannelMapEnabled: false},
            overlaySettings: {
                colorbar: {isVisible: false, position: "right"},
                colorbarHoverInfoHeight: 0
            },
            contourFrames: new Map([[frame, [frame]]]),
            vectorOverlayFrames: new Map([[frame, [frame]]]),
            catalogStore: {
                visibleCatalogFiles: new Map([[frame, [11]]]),
                catalogGLData: new Map([[11, {x: new Float32Array([30]), y: new Float32Array([40])}]]),
                catalogCounts: new Map([[11, 1]]),
                getCatalogWidgetStore: jest.fn(() => ({catalogShape: 3, catalogSize: 6, catalogColor: "#00ff00", isImagePixelSize: false, shapeSettings: {diameterBase: 0}})),
                getFrameIdByCatalogId: jest.fn(() => 1)
            },
            getFrame: jest.fn(() => frame)
        };

        renderAstOverlayToSvgMock.mockReturnValue(null);
        renderColorbarToSvgMock.mockReturnValue(null);
        appStoreSpy = jest.spyOn(AppStore, "Instance", "get").mockReturnValue(mockAppStore as never);
    });

    afterEach(() => {
        appStoreSpy.mockRestore();
    });

    test("keeps only the raster layer embedded as an image while vectorizing overlays", () => {
        const panelSvg = getPanelSvg(0, 0, 120, 100, padding, "right", {type: ImageType.FRAME, store: frame} as never);

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
        expect(panelSvg?.querySelector("#catalog-overlay")).not.toBeNull();
    });

    test("places coordinate overlays in each channel map cell", () => {
        mockAppStore.channelMapStore = {isChannelMapEnabled: true, channelArray: [0, 1, 2, 3], numColumns: 2, numRows: 2};
        mockAppStore.overlaySettings.colorbar = {
            isVisible: true,
            position: "right",
            width: 10,
            offset: 2,
            hasTickCustomColor: true,
            tickColor: "#fff",
            tickWidth: 1,
            tickLen: 4,
            textGap: 5,
            hasNumberCustomColor: true,
            numberColor: "#fff",
            numberFontSize: 12,
            numberRotation: 0,
            hasLabelCustomColor: true,
            labelColor: "#fff",
            isLabelVisible: false,
            labelFontSize: 12,
            labelRotation: 0,
            hasBorderCustomColor: true,
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

        const panelSvg = getPanelSvg(0, 0, 120, 100, padding, "right", {type: ImageType.FRAME, store: frame} as never);
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
        expect(renderColorbarToSvgMock).toHaveBeenCalledWith(
            expect.anything(),
            "right",
            107,
            7,
            10,
            80,
            expect.anything(),
            expect.anything(),
            expect.anything(),
            1,
            4,
            5,
            expect.anything(),
            12,
            expect.anything(),
            0,
            "",
            expect.anything(),
            12,
            expect.anything(),
            0,
            false,
            expect.anything(),
            1
        );
    });
});

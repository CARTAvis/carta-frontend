import {ImageType, VectorOverlaySource} from "enums";
import {AppStore} from "stores";

import {getPanelSvg} from "./ImageViewComponent";

jest.mock("utilities/export/astSvgExport", () => ({
    renderAstOverlayToSvg: jest.fn(() => null)
}));

describe("getPanelSvg", () => {
    const padding = {left: 5, right: 0, top: 7, bottom: 0};
    let appStoreSpy: jest.SpyInstance;
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
            frameInfo: {fileId: 1},
            renderWidth: 100,
            renderHeight: 80,
            zoomLevel: 1,
            spatialReference: null,
            spatialTransform: null,
            overlayStore: {viewWidth: 120, viewHeight: 100, padding},
            channelMapOuterOverlayStore: {viewWidth: 120, viewHeight: 100},
            requiredFrameView: {xMin: 0, xMax: 100, yMin: 0, yMax: 80},
            renderConfig: {colorscaleArray: []},
            colorbarStore: null,
            requiredUnit: "Jy/beam",
            colorbarLabelCustomText: "Jy/beam",
            hasVisibleBeam: false,
            beamProperties: null,
            overlayBeamSettings: {visible: false},
            contourConfig: {
                visible: true,
                color: {r: 255, g: 255, b: 0, a: 1},
                colormapEnabled: false,
                colormap: "viridis",
                colormapBias: 0,
                colormapContrast: 1,
                thickness: 2,
                dashMode: 0
            },
            contourStores: new Map([[1, {exportVertexData: [new Float32Array([10, 10, 0, 0, 0, 0, 0, 0, 20, 20, 0, 0, 0, 0, 0, 0])], exportIndexOffsets: [new Int32Array([2])]}]]),
            vectorOverlayConfig: {
                visible: true,
                thickness: 2,
                rotationOffset: 0,
                angularSource: VectorOverlaySource.Current,
                intensitySource: VectorOverlaySource.Current,
                color: {r: 255, g: 0, b: 0, a: 1},
                colormapEnabled: false,
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

        const mockAppStore = {
            pixelRatio: 1,
            channelMapStore: {channelMapEnabled: false},
            overlaySettings: {
                colorbar: {visible: false, position: "right"},
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

        appStoreSpy = jest.spyOn(AppStore, "Instance", "get").mockReturnValue(mockAppStore as never);
    });

    afterEach(() => {
        appStoreSpy.mockRestore();
    });

    test("keeps only the raster layer embedded as an image while vectorizing overlays", () => {
        const panelSvg = getPanelSvg(0, 0, 120, 100, padding, "right", {type: ImageType.FRAME, store: frame} as never);

        expect(panelSvg).not.toBeNull();
        expect(panelSvg?.querySelectorAll("image")).toHaveLength(1);
        expect(panelSvg?.querySelector("#contours")).not.toBeNull();
        expect(panelSvg?.querySelector("#vector-overlay")).not.toBeNull();
        expect(panelSvg?.querySelector("#catalog-overlay")).not.toBeNull();
    });
});

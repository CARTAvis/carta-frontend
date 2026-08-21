jest.mock("services", () => ({
    PreviewWebGLService: {Instance: {}},
    TileService: {Instance: {tileStream: {subscribe: jest.fn()}}},
    TileWebGLService: {Instance: {cmapTexture: {}}}
}));
jest.mock("stores", () => ({
    AppStore: Object.defineProperty({}, "Instance", {configurable: true, get: () => undefined})
}));

import {ImageType} from "enums";
import {AppStore} from "stores";

import {RasterViewComponent} from "./RasterViewComponent";

describe("RasterViewComponent", () => {
    afterEach(() => jest.restoreAllMocks());

    test("keeps the current canvas until the new channel histogram is ready", () => {
        const clearRect = jest.fn();
        const drawImage = jest.fn();
        const frame = {
            channel: 2,
            stokes: 0,
            polarizations: [],
            isPreview: false,
            renderWidth: 10,
            renderHeight: 10,
            renderConfig: {
                histChannel: 1,
                stokesIndex: 0,
                isUsingCubeHistogram: false
            }
        };
        const component = new RasterViewComponent({image: {type: ImageType.FRAME, store: frame}, column: 0, row: 0, pixelHighlightValue: NaN} as any) as any;
        component.canvas = {width: 10, height: 10, getContext: () => ({clearRect, drawImage})};
        component.gl = {canvas: {height: 10}};
        component.updateCanvasSize = jest.fn();
        component.updateUniforms = jest.fn();
        component.renderCanvas = jest.fn();
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
            setCanvasUpdated: jest.fn(),
            imageViewConfigStore: {numImageColumns: 1, numImageRows: 1},
            pixelRatio: 1,
            channelMapStore: {isChannelMapEnabled: false}
        } as any);

        component.updateCanvas();
        expect(clearRect).not.toHaveBeenCalled();

        frame.renderConfig.histChannel = 2;
        component.updateCanvas();
        expect(clearRect).toHaveBeenCalledTimes(1);
    });

    test("observes every histogram readiness field used to gate canvas updates", () => {
        const readChannel = jest.fn(() => 2);
        const readStokes = jest.fn(() => 0);
        const readHistChannel = jest.fn(() => 1);
        const readHistStokesIndex = jest.fn(() => 0);
        const readIsUsingCubeHistogram = jest.fn(() => false);
        const frame = {
            get channel() {
                return readChannel();
            },
            get stokes() {
                return readStokes();
            },
            polarizations: [],
            spatialReference: null,
            requiredFrameView: {},
            currentFrameView: {},
            isRenderable: true,
            renderWidth: 10,
            renderHeight: 10,
            overlayStore: {padding: {top: 0, left: 0}},
            renderConfig: {
                get histChannel() {
                    return readHistChannel();
                },
                get stokesIndex() {
                    return readHistStokesIndex();
                },
                get isUsingCubeHistogram() {
                    return readIsUsingCubeHistogram();
                },
                scaleMinVal: 0,
                scaleMaxVal: 1,
                colorMapIndex: 0,
                customColormapHexEnd: "#ffffff",
                customColormapHexStart: "#000000",
                contrast: 1,
                bias: 0,
                scaling: 0,
                gamma: 1,
                alpha: 1,
                isInverted: false,
                isVisible: true
            }
        };
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
            preferenceStore: {
                shouldUseSmoothedBiasContrast: false,
                nanColorHex: "#000000",
                isPixelGridVisible: false,
                pixelGridColor: "#000000"
            },
            imageRatio: 1
        } as any);
        const component = new RasterViewComponent({image: {type: ImageType.FRAME, store: frame}, column: 0, row: 0, pixelHighlightValue: NaN} as any);

        component.render();

        expect(readChannel).toHaveBeenCalled();
        expect(readStokes).toHaveBeenCalled();
        expect(readHistChannel).toHaveBeenCalled();
        expect(readHistStokesIndex).toHaveBeenCalled();
        expect(readIsUsingCubeHistogram).toHaveBeenCalled();
    });
});

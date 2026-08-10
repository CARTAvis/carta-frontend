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
});

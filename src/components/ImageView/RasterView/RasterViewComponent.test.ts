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

    test("composites every channel-map layer without clearing earlier layers", () => {
        const clearRect = jest.fn();
        const compositeStates: Array<{alpha: number; operation: string}> = [];
        const context = {
            clearRect,
            globalAlpha: 1,
            globalCompositeOperation: "source-over",
            drawImage: jest.fn(() => compositeStates.push({alpha: context.globalAlpha, operation: context.globalCompositeOperation}))
        };
        const makeFrame = (channel: number) => ({
            channel,
            stokes: 0,
            polarizations: [],
            isPreview: false,
            renderWidth: 10,
            renderHeight: 10,
            renderConfig: {
                histChannel: channel,
                stokesIndex: 0,
                isUsingCubeHistogram: false
            }
        });
        const baseFrame = makeFrame(0);
        const secondFrame = makeFrame(2);
        const image = {type: ImageType.COLOR_BLENDING, store: {baseFrame, frames: [baseFrame, secondFrame], alpha: [0.25, 0.75]}};
        const component = new RasterViewComponent({image, channel: [0, 1], column: 0, row: 0, pixelHighlightValue: NaN} as any) as any;
        component.canvas = {width: 10, height: 10, getContext: () => context};
        component.gl = {canvas: {height: 10}};
        component.updateCanvasSize = jest.fn();
        component.updateUniforms = jest.fn();
        component.renderMultipleCanvas = jest.fn();
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
            setCanvasUpdated: jest.fn(),
            imageViewConfigStore: {numImageColumns: 1, numImageRows: 1},
            channelMapStore: {isChannelMapEnabled: true, getChannelsForFrame: frame => (frame === baseFrame ? [0, 1] : [2, 2])},
            pixelRatio: 1
        } as any);

        component.updateCanvas();

        expect(clearRect).toHaveBeenCalledTimes(1);
        expect(component.renderMultipleCanvas).toHaveBeenNthCalledWith(1, baseFrame, [0, 1]);
        expect(component.renderMultipleCanvas).toHaveBeenNthCalledWith(2, secondFrame, [2, 2]);
        expect(compositeStates).toEqual([
            {alpha: 0.25, operation: "lighter"},
            {alpha: 0.75, operation: "lighter"}
        ]);

        component.props = {...component.props, image: {type: ImageType.FRAME, store: baseFrame}, channel: undefined};
        component.renderCanvas = jest.fn();
        component.updateCanvas();
        expect(compositeStates.at(-1)).toEqual({alpha: 1, operation: "source-over"});
    });
});

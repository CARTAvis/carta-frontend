import {action, observable} from "mobx";

jest.mock("components/Shared", () => ({
    AppToaster: {show: jest.fn()}
}));

import {ColormapSet} from "../../enums";
import * as colorUtils from "../../utilities/color/color";
import {AppStore} from "../AppStore/AppStore";
import {RenderConfigStore} from "../Frame/RenderConfigStore/RenderConfigStore";

import {ColorBlendingStore} from "./ColorBlendingStore";

const MOCK_CONSOLE_ERROR = jest.spyOn(console, "error").mockImplementation(() => {});
const GET_COLORS_FOR_VALUES = jest.spyOn(colorUtils, "getColorsForValues");

describe("ColorBlendingStore", () => {
    let colorBlendingStore: ColorBlendingStore;
    const mockMatchedFrame1 = "mockFrameStore1";
    const mockMatchedFrame2 = "mockFrameStore2";
    const mockMatchedFrame3 = "mockFrameStore3";
    const mockMatchedFrame4 = "mockFrameStore4";

    const mockReferenceSetColorMap = jest.fn();
    const mockSpatialReference = observable({
        secondarySpatialImages: [] as any[],
        renderConfig: {setColorMap: mockReferenceSetColorMap}
    });
    const setMatchedFrames = action((frames: any[]) => {
        mockSpatialReference.secondarySpatialImages = frames;
    });

    beforeEach(() => {
        jest.spyOn(AppStore, "Instance", "get").mockImplementation(() => {
            return {spatialReference: mockSpatialReference} as any;
        });
        setMatchedFrames([mockMatchedFrame1 as any, mockMatchedFrame2 as any]);
        colorBlendingStore = new ColorBlendingStore(0);
    });

    afterAll(() => {
        MOCK_CONSOLE_ERROR.mockRestore();
    });

    it("initializes the values correctly", () => {
        expect(colorBlendingStore.id).toBe(0);
        expect(colorBlendingStore.filename).toBe("Color Blending 1");
        expect(colorBlendingStore.titleCustomText).toBe("Color Blending 1");
        expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1, mockMatchedFrame2]);
        expect(colorBlendingStore.alpha).toEqual([1, 1, 1]);
        expect(colorBlendingStore.isRasterVisible).toBe(true);
        expect(colorBlendingStore.isContourVisible).toBe(true);
        expect(colorBlendingStore.isVectorOverlayVisible).toBe(true);
    });

    it("removes a selected frame when it's unmatched", () => {
        setMatchedFrames([mockMatchedFrame1, mockMatchedFrame3]);
        expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1]);
        expect(colorBlendingStore.alpha).toEqual([1, 1]);
    });

    describe("setTitleCustomText", () => {
        it("sets the custom title correctly", () => {
            colorBlendingStore.setTitleCustomText("Test");
            expect(colorBlendingStore.titleCustomText).toBe("Test");
        });
    });

    describe("addSelectedFrame", () => {
        it("adds a layer correctly", () => {
            setMatchedFrames([mockMatchedFrame1, mockMatchedFrame2, mockMatchedFrame3]);

            colorBlendingStore.addSelectedFrame(mockMatchedFrame3 as any);
            expect(colorBlendingStore.selectedFrames).toContain(mockMatchedFrame3);
            expect(colorBlendingStore.alpha).toHaveLength(4);
        });

        it("fails when the frame is unmatched", () => {
            colorBlendingStore.addSelectedFrame(mockMatchedFrame4 as any);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("The selected frame is not matched to the base frame.");
            expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1, mockMatchedFrame2]);
        });

        it("fails when the frame is used in other layers", () => {
            colorBlendingStore.addSelectedFrame(mockMatchedFrame1 as any);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("The selected frame is selected in other layers.");
            expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1, mockMatchedFrame2]);
        });
    });

    describe("setSelectedFrame", () => {
        it("sets a layer correctly", () => {
            setMatchedFrames([mockMatchedFrame1, mockMatchedFrame2, mockMatchedFrame3]);

            colorBlendingStore.setSelectedFrame(0, mockMatchedFrame3 as any);
            expect(colorBlendingStore.selectedFrames[0]).toBe(mockMatchedFrame3);
        });

        it("fails when the frame is unmatched", () => {
            colorBlendingStore.setSelectedFrame(0, mockMatchedFrame4 as any);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("The selected frame is not matched to the base frame.");
            expect(colorBlendingStore.selectedFrames[0]).toBe(mockMatchedFrame1);
        });

        it("fails when the frame is used in other layers", () => {
            colorBlendingStore.setSelectedFrame(1, mockMatchedFrame1 as any);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("The selected frame is selected in other layers.");
            expect(colorBlendingStore.selectedFrames[1]).toBe(mockMatchedFrame2);
        });

        it("fails when the index is invalid", () => {
            setMatchedFrames([mockMatchedFrame1, mockMatchedFrame2, mockMatchedFrame3]);

            colorBlendingStore.setSelectedFrame(-1, mockMatchedFrame3 as any);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid layer index.");

            colorBlendingStore.setSelectedFrame(2, mockMatchedFrame3 as any);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid layer index.");
        });
    });

    describe("setAlpha", () => {
        it("sets alpha correctly", () => {
            colorBlendingStore.setAlpha(0, 0.5);
            expect(colorBlendingStore.alpha[0]).toBe(0.5);
        });

        it("fails when the index is invalid", () => {
            colorBlendingStore.setAlpha(-1, 0.5);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid layer index.");

            colorBlendingStore.setAlpha(3, 0.5);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid layer index.");
        });

        it("fails when the value is invalid", () => {
            colorBlendingStore.setAlpha(0, -1);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid alpha value.");
            expect(colorBlendingStore.alpha[0]).toBe(1);

            colorBlendingStore.setAlpha(0, 1.1);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid alpha value.");
            expect(colorBlendingStore.alpha[0]).toBe(1);
        });
    });

    describe("deleteSelectedFrame", () => {
        it("removes a layer correctly", () => {
            colorBlendingStore.deleteSelectedFrame(0);
            expect(colorBlendingStore.selectedFrames).not.toContain(mockMatchedFrame1);
            expect(colorBlendingStore.alpha).toHaveLength(2);
        });

        it("fails when the index is invalid", () => {
            colorBlendingStore.deleteSelectedFrame(-1);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid layer index.");

            colorBlendingStore.deleteSelectedFrame(3);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid layer index.");
        });
    });

    describe("toggleRasterVisible", () => {
        it("toggles the visibility correctly", () => {
            colorBlendingStore.toggleRasterVisible();
            expect(colorBlendingStore.isRasterVisible).toBe(false);
            colorBlendingStore.toggleRasterVisible();
            expect(colorBlendingStore.isRasterVisible).toBe(true);
        });
    });

    describe("toggleContourVisible", () => {
        it("toggles the visibility correctly", () => {
            colorBlendingStore.toggleContourVisible();
            expect(colorBlendingStore.isContourVisible).toBe(false);
            colorBlendingStore.toggleContourVisible();
            expect(colorBlendingStore.isContourVisible).toBe(true);
        });
    });

    describe("toggleVectorOverlayVisible", () => {
        it("toggles the visibility correctly", () => {
            colorBlendingStore.toggleVectorOverlayVisible();
            expect(colorBlendingStore.isVectorOverlayVisible).toBe(false);
            colorBlendingStore.toggleVectorOverlayVisible();
            expect(colorBlendingStore.isVectorOverlayVisible).toBe(true);
        });
    });

    describe("baseFrame", () => {
        it("returns the spatial reference", () => {
            expect(colorBlendingStore.baseFrame).toBe(mockSpatialReference);
        });
    });

    describe("frames", () => {
        it("should return the frames from the layers correctly", () => {
            expect(colorBlendingStore.frames).toEqual([mockSpatialReference, mockMatchedFrame1, mockMatchedFrame2]);
        });
    });

    describe("applyColormapSet", () => {
        it("applies a single gradient colormap correctly", () => {
            const mockSetColorMap1 = jest.fn();
            const mockSetCustomHexEnd1 = jest.fn();
            const mockSetColorMap2 = jest.fn();
            const mockSetCustomHexEnd2 = jest.fn();

            const red = [255, 0, 0, 255]; // Red
            const orange = [254, 180, 97, 255];
            const green = [128, 254, 179, 255]; // #80feb3
            const blue = [0, 180, 235, 255];
            const violet = [127, 0, 255, 255]; // Violet
            const mockRainbowGradient = {color: new Uint8ClampedArray([...violet, ...blue, ...green, ...orange, ...red]), size: 5};
            GET_COLORS_FOR_VALUES.mockReturnValue(mockRainbowGradient);

            // one layer
            colorBlendingStore.selectedFrames = [];
            colorBlendingStore.applyColormapSet(ColormapSet.Rainbow);
            expect(mockReferenceSetColorMap).toHaveBeenCalledWith("Red");

            // two layers
            colorBlendingStore.selectedFrames = [{renderConfig: {setColorMap: mockSetColorMap1, setCustomHexEnd: mockSetCustomHexEnd1}} as any];
            colorBlendingStore.applyColormapSet(ColormapSet.Rainbow);
            expect(mockReferenceSetColorMap).toHaveBeenCalledWith("Red");
            expect(mockSetColorMap1).toHaveBeenCalledWith("Violet");

            // three layers
            colorBlendingStore.selectedFrames = [{renderConfig: {setColorMap: mockSetColorMap1, setCustomHexEnd: mockSetCustomHexEnd1}} as any, {renderConfig: {setColorMap: mockSetColorMap2, setCustomHexEnd: mockSetCustomHexEnd2}} as any];
            colorBlendingStore.applyColormapSet(ColormapSet.Rainbow);
            expect(mockReferenceSetColorMap).toHaveBeenCalledWith("Red");
            expect(mockSetCustomHexEnd1).toHaveBeenCalledWith("#80feb3");
            expect(mockSetColorMap1).toHaveBeenCalledWith(RenderConfigStore.COLOR_MAPS_CUSTOM);
            expect(mockSetColorMap2).toHaveBeenCalledWith("Violet");
        });

        it("applies a collection of colormaps correctly", () => {
            const mockSetColorMap1 = jest.fn();
            const mockSetColorMap2 = jest.fn();

            // one layer
            colorBlendingStore.selectedFrames = [];
            colorBlendingStore.applyColormapSet(ColormapSet.RGB);
            expect(mockReferenceSetColorMap).toHaveBeenCalledWith("Red");

            // two layers
            colorBlendingStore.selectedFrames = [{renderConfig: {setColorMap: mockSetColorMap1}} as any];
            colorBlendingStore.applyColormapSet(ColormapSet.RGB);
            expect(mockReferenceSetColorMap).toHaveBeenCalledWith("Red");
            expect(mockSetColorMap1).toHaveBeenCalledWith("Blue");

            // three layers
            colorBlendingStore.selectedFrames = [{renderConfig: {setColorMap: mockSetColorMap1}} as any, {renderConfig: {setColorMap: mockSetColorMap2}} as any];
            colorBlendingStore.applyColormapSet(ColormapSet.RGB);
            expect(mockReferenceSetColorMap).toHaveBeenCalledWith("Red");
            expect(mockSetColorMap1).toHaveBeenCalledWith("Green");
            expect(mockSetColorMap2).toHaveBeenCalledWith("Blue");
        });

        it("handles invalid colormap set names", () => {
            colorBlendingStore.applyColormapSet("InvalidSet" as ColormapSet);
            expect(MOCK_CONSOLE_ERROR).toHaveBeenCalledWith("Invalid colormap set name.");
        });
    });
});

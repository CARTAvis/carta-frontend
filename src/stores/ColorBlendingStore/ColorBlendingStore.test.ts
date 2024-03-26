import {AppStore} from "stores";

import {ColorBlendingStore} from "./ColorBlendingStore";
import {action, observable} from "mobx";

const mockConsoleError = jest.spyOn(console, "error");

describe("ColorBlendingStore", () => {
    let colorBlendingStore: ColorBlendingStore;
    const mockMatchedFrame1 = "mockFrameStore1";
    const mockMatchedFrame2 = "mockFrameStore2";
    const mockMatchedFrame3 = "mockFrameStore3";
    const mockMatchedFrame4 = "mockFrameStore4";
    const mockSpatialReference = observable({
        secondarySpatialImages: []
    });
    const setMatchedFrames = action(frames => {
        mockSpatialReference.secondarySpatialImages = frames;
    });

    beforeEach(() => {
        jest.spyOn(AppStore, "Instance", "get").mockImplementation(() => {
            return {spatialReference: mockSpatialReference};
        });
        setMatchedFrames([mockMatchedFrame1, mockMatchedFrame2, mockMatchedFrame3]);
        colorBlendingStore = new ColorBlendingStore(0);
    });

    it("initializes the values correctly", () => {
        expect(colorBlendingStore.id).toBe(0);
        expect(colorBlendingStore.filename).toBe("Color Blending 1");
        expect(colorBlendingStore.titleCustomText).toBe("Color Blending 1");
        expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1, mockMatchedFrame2]);
        expect(colorBlendingStore.alpha).toEqual([1, 1, 1]);
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
            colorBlendingStore.addSelectedFrame(mockMatchedFrame3);
            expect(colorBlendingStore.selectedFrames).toContain(mockMatchedFrame3);
            expect(colorBlendingStore.alpha).toHaveLength(4);
        });

        it("fails when the frame is unmatched", () => {
            colorBlendingStore.addSelectedFrame(mockMatchedFrame4);
            expect(mockConsoleError).toHaveBeenCalledWith("The selected frame is not matched to the base frame.");
            expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1, mockMatchedFrame2]);
        });

        it("fails when the frame is used in other layers", () => {
            colorBlendingStore.addSelectedFrame(mockMatchedFrame1);
            expect(mockConsoleError).toHaveBeenCalledWith("The selected frame is selected in other layers.");
            expect(colorBlendingStore.selectedFrames).toEqual([mockMatchedFrame1, mockMatchedFrame2]);
        });
    });

    describe("setSelectedFrame", () => {
        it("sets a layer correctly", () => {
            colorBlendingStore.setSelectedFrame(0, mockMatchedFrame3);
            expect(colorBlendingStore.selectedFrames[0]).toBe(mockMatchedFrame3);
        });

        it("fails when the frame is unmatched", () => {
            colorBlendingStore.setSelectedFrame(0, mockMatchedFrame4);
            expect(mockConsoleError).toHaveBeenCalledWith("The selected frame is not matched to the base frame.");
            expect(colorBlendingStore.selectedFrames[0]).toBe(mockMatchedFrame1);
        });

        it("fails when the frame is used in other layers", () => {
            colorBlendingStore.setSelectedFrame(1, mockMatchedFrame1);
            expect(mockConsoleError).toHaveBeenCalledWith("The selected frame is selected in other layers.");
            expect(colorBlendingStore.selectedFrames[1]).toBe(mockMatchedFrame2);
        });

        it("fails when the index is invalid", () => {
            colorBlendingStore.setSelectedFrame(-1, mockMatchedFrame3);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid layer index.");

            colorBlendingStore.setSelectedFrame(2, mockMatchedFrame3);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid layer index.");
        });
    });

    describe("setAlpha", () => {
        it("sets alpha correctly", () => {
            colorBlendingStore.setAlpha(0, 0.5);
            expect(colorBlendingStore.alpha[0]).toBe(0.5);
        });

        it("fails when the index is invalid", () => {
            colorBlendingStore.setAlpha(-1, 0.5);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid layer index.");

            colorBlendingStore.setAlpha(3, 0.5);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid layer index.");
        });

        it("fails when the value is invalid", () => {
            colorBlendingStore.setAlpha(0, -1);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid alpha value.");
            expect(colorBlendingStore.alpha[0]).toBe(1);

            colorBlendingStore.setAlpha(0, 1.1);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid alpha value.");
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
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid layer index.");

            colorBlendingStore.deleteSelectedFrame(3);
            expect(mockConsoleError).toHaveBeenCalledWith("Invalid layer index.");
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
});

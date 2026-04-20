import {ImageType} from "enums";
import {FrameStore} from "stores";

import {ImageViewConfigStore} from "./ImageViewConfigStore";

const mockUpdateActiveImage = jest.fn();
const mockIsActiveImage = jest.fn();
const mockSetActiveImage = jest.fn();
const mockSetSpatialReference = jest.fn();

// Mock RenderConfigStore to handle import chain
jest.mock("stores/Frame", () => ({
    RenderConfigStore: {
        COLOR_MAPS_SELECTED: ["viridis", "plasma", "inferno", "magma"],
        COLOR_MAPS_MONO: new Map([
            ["red", "#ff0000"],
            ["green", "#00ff00"],
            ["blue", "#0000ff"]
        ]),
        COLOR_MAPS_CUSTOM: "custom",
        COLOR_MAPS_PANEL: "panel",
        COLOR_MAPS_ALL: ["viridis", "plasma", "inferno", "magma", "red", "green", "blue", "custom", "panel"],
        SCALING_TYPES: new Map([
            ["linear", "Linear"],
            ["log", "Log"],
            ["sqrt", "Square Root"],
            ["square", "Square"],
            ["power", "Power"]
        ])
    }
}));

jest.mock("stores", () => {
    class MockColorBlendingStore {
        id;
        selectedFrames: any[] = [];
        alpha: number[] = [1];
        static readonly DefaultLayerLimit = 10;
        constructor(id) {
            this.id = id;
        }
    }

    return {
        AppStore: {
            Instance: {
                activeImage: null,
                updateActiveImage: x => mockUpdateActiveImage(x),
                isActiveImage: () => mockIsActiveImage(),
                setActiveImage: x => mockSetActiveImage(x),
                setSpatialReference: (...args) => mockSetSpatialReference(...args)
            }
        },
        FrameStore: jest.fn(frameInfo => ({
            id: frameInfo.fileId,
            clearContours: jest.fn(),
            setSpatialReference: jest.fn(() => true)
        })),
        ColorBlendingStore: MockColorBlendingStore
    };
});

describe("ImageViewConfigStore", () => {
    const imageViewConfigStore = ImageViewConfigStore.Instance;

    // Create mock FrameInfo objects
    const mockFrameInfo1 = {
        fileId: 0,
        directory: "/mock/path",
        lelExpr: false,
        hdu: "",
        fileInfo: {} as any,
        fileInfoExtended: {} as any,
        fileFeatureFlags: 0,
        renderMode: 0, // Use number instead of enum
        beamTable: [],
        generated: false
    };

    const mockFrameInfo2 = {
        fileId: 1,
        directory: "/mock/path",
        lelExpr: false,
        hdu: "",
        fileInfo: {} as any,
        fileInfoExtended: {} as any,
        fileFeatureFlags: 0,
        renderMode: 0,
        beamTable: [],
        generated: false
    };

    const mockFrameInfo3 = {
        fileId: 2,
        directory: "/mock/path",
        lelExpr: false,
        hdu: "",
        fileInfo: {} as any,
        fileInfoExtended: {} as any,
        fileFeatureFlags: 0,
        renderMode: 0,
        beamTable: [],
        generated: false
    };

    const mockFrame1 = new FrameStore(mockFrameInfo1);
    const mockFrame2 = new FrameStore(mockFrameInfo2);
    const mockFrame3 = new FrameStore(mockFrameInfo3);
    let colorBlendingImage1, colorBlendingImage2;

    // let mock frames become instance of FrameStore
    Object.setPrototypeOf(mockFrame1, FrameStore.prototype);
    Object.setPrototypeOf(mockFrame2, FrameStore.prototype);
    Object.setPrototypeOf(mockFrame3, FrameStore.prototype);

    describe("addFrame", () => {
        it("adds a frame correctly", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            expect(imageViewConfigStore.imageNum).toBe(1);
            expect(imageViewConfigStore.getImage(0).type).toBe(ImageType.FRAME);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame1);
        });
    });

    describe("replaceFrame", () => {
        it("replaces a frame correctly", () => {
            imageViewConfigStore.replaceFrame(0, mockFrame2);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame2);
        });

        it("fails with incorrect index", () => {
            imageViewConfigStore.replaceFrame(-1, mockFrame1);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame2);

            imageViewConfigStore.replaceFrame(1, mockFrame1);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame2);
        });
    });

    describe("removeFrame", () => {
        it("removes a frame correctly", () => {
            imageViewConfigStore.removeFrame(mockFrame2.id);
            expect(imageViewConfigStore.imageNum).toBe(0);
        });
    });

    describe("createColorBlending", () => {
        it("creates a color blended image correctly", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            colorBlendingImage1 = imageViewConfigStore.createColorBlending();
            expect(colorBlendingImage1.id).toBe(0);
            expect(imageViewConfigStore.getImage(1).type).toBe(ImageType.COLOR_BLENDING);
            expect(imageViewConfigStore.getImage(1).store).toBe(colorBlendingImage1);
            expect(mockUpdateActiveImage).toHaveBeenCalledWith(imageViewConfigStore.getImage(1));

            colorBlendingImage2 = imageViewConfigStore.createColorBlending();
            expect(colorBlendingImage2.id).toBe(1);
            expect(imageViewConfigStore.getImage(2).type).toBe(ImageType.COLOR_BLENDING);
            expect(imageViewConfigStore.getImage(2).store).toBe(colorBlendingImage2);
            expect(mockUpdateActiveImage).toHaveBeenCalledWith(imageViewConfigStore.getImage(2));
        });
    });

    describe("removeColorBlending", () => {
        it("removes a color blending image correctly", () => {
            mockIsActiveImage.mockImplementationOnce(() => false);
            imageViewConfigStore.removeColorBlending(colorBlendingImage1);
            expect(imageViewConfigStore.colorBlendingImages).not.toContain(colorBlendingImage1);
        });

        it("removes a active color blending image correctly", () => {
            mockIsActiveImage.mockImplementationOnce(() => true);
            imageViewConfigStore.removeColorBlending(colorBlendingImage2);
            expect(imageViewConfigStore.colorBlendingImages).not.toContain(colorBlendingImage2);
            expect(mockSetActiveImage).toHaveBeenCalledWith(imageViewConfigStore.getImage(0));
        });
    });

    describe("reorderImage", () => {
        it("reorders images correctly", () => {
            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.addFrame(mockFrame3);
            imageViewConfigStore.reorderImage(0, 1, 2);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame3);
            expect(imageViewConfigStore.getImage(1).store).toBe(mockFrame1);
            expect(imageViewConfigStore.getImage(2).store).toBe(mockFrame2);
        });
    });

    describe("removeAllImages", () => {
        it("removes all images correctly", () => {
            imageViewConfigStore.removeAllImages();
            expect(imageViewConfigStore.imageNum).toBe(0);
        });
    });

    describe("imageListSummary", () => {
        beforeEach(() => {
            imageViewConfigStore.removeAllImages();
        });

        it("returns {type, id} pairs in imageList order", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);
            const cb = imageViewConfigStore.createColorBlending();
            imageViewConfigStore.addFrame(mockFrame3);

            expect(imageViewConfigStore.imageListSummary).toEqual([
                {type: ImageType.FRAME, id: mockFrame1.id},
                {type: ImageType.FRAME, id: mockFrame2.id},
                {type: ImageType.COLOR_BLENDING, id: cb.id},
                {type: ImageType.FRAME, id: mockFrame3.id}
            ]);
        });

        it("reflects updates after addFrame / removeFrame / createColorBlending / removeColorBlending / reorderImage", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            expect(imageViewConfigStore.imageListSummary).toEqual([{type: ImageType.FRAME, id: mockFrame1.id}]);

            const cb = imageViewConfigStore.createColorBlending();
            expect(imageViewConfigStore.imageListSummary).toEqual([
                {type: ImageType.FRAME, id: mockFrame1.id},
                {type: ImageType.COLOR_BLENDING, id: cb.id}
            ]);

            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.reorderImage(2, 0, 1);
            expect(imageViewConfigStore.imageListSummary[0]).toEqual({type: ImageType.FRAME, id: mockFrame2.id});

            mockIsActiveImage.mockImplementationOnce(() => false);
            imageViewConfigStore.removeColorBlending(cb);
            expect(imageViewConfigStore.imageListSummary.some(entry => entry.type === ImageType.COLOR_BLENDING)).toBe(false);

            imageViewConfigStore.removeFrame(mockFrame1.id);
            expect(imageViewConfigStore.imageListSummary).toEqual([{type: ImageType.FRAME, id: mockFrame2.id}]);
        });

        it("does not include the full store object", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            const summary = imageViewConfigStore.imageListSummary;
            expect(Object.keys(summary[0]).sort()).toEqual(["id", "type"]);
        });
    });

    describe("createColorBlendingFromFrames", () => {
        beforeEach(() => {
            imageViewConfigStore.removeAllImages();
            mockSetSpatialReference.mockClear();
        });

        it("returns {id} and creates a color blending with exactly frames.slice(1) as layers", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.addFrame(mockFrame3);

            const result = imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, mockFrame2, mockFrame3]);
            expect(result).not.toBeNull();
            const cbImages = imageViewConfigStore.colorBlendingImages;
            expect(cbImages.length).toBe(1);
            expect(result!.id).toBe(cbImages[0].id);
            expect(cbImages[0].selectedFrames).toEqual([mockFrame2, mockFrame3]);
            expect(cbImages[0].alpha.length).toBe(3);
        });

        it("sets frames[0] as the spatial reference and matches the rest", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.addFrame(mockFrame3);

            imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, mockFrame2, mockFrame3]);

            expect(mockSetSpatialReference).toHaveBeenCalledWith(mockFrame1, false);
            expect(mockFrame2.setSpatialReference).toHaveBeenCalledWith(mockFrame1);
            expect(mockFrame3.setSpatialReference).toHaveBeenCalledWith(mockFrame1);
        });

        it("returns null when frames is empty", () => {
            expect(imageViewConfigStore.createColorBlendingFromFrames([])).toBeNull();
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(0);
        });

        it("returns null when frames contains a falsy entry", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            expect(imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, null as any])).toBeNull();
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(0);
        });

        it("returns null when frames exceeds the layer-count limit", () => {
            const manyFrames: any[] = [];
            for (let i = 0; i < 11; i++) {
                manyFrames.push(mockFrame1);
            }
            imageViewConfigStore.addFrame(mockFrame1);
            expect(imageViewConfigStore.createColorBlendingFromFrames(manyFrames)).toBeNull();
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(0);
        });

        it("does not mutate or close existing color blendings", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);
            const existingCb = imageViewConfigStore.createColorBlending();
            const existingId = existingCb!.id;

            imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, mockFrame2]);

            const ids = imageViewConfigStore.colorBlendingImages.map(cb => cb.id);
            expect(ids).toContain(existingId);
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(2);
        });

        it("returns null when frames contain duplicate entries", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);

            expect(imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, mockFrame2, mockFrame2])).toBeNull();
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(0);
        });

        it("returns null when any frame is not in the current image list", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            // mockFrame2 intentionally not added.

            expect(imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, mockFrame2])).toBeNull();
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(0);
        });

        it("returns null and does not create a color blending when a non-base frame fails to spatially match", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.addFrame(mockFrame3);
            (mockFrame3.setSpatialReference as jest.Mock).mockReturnValueOnce(false);

            expect(imageViewConfigStore.createColorBlendingFromFrames([mockFrame1, mockFrame2, mockFrame3])).toBeNull();
            expect(imageViewConfigStore.colorBlendingImages.length).toBe(0);
            // Session-wide spatial reference is still updated to the base frame (documented side effect).
            expect(mockSetSpatialReference).toHaveBeenCalledWith(mockFrame1, false);
        });
    });
});

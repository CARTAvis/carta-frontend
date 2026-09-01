import {ImagePanelMode, ImageType} from "enums";
import {FrameStore} from "stores";

import {ImageViewConfigStore} from "./ImageViewConfigStore";

const MockUpdateActiveImage = jest.fn();
const MockIsActiveImage = jest.fn();
const MockSetActiveImage = jest.fn();
var mockChannelMapStore;
var mockPreferenceStore;

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
        public static readonly DEFAULT_LAYER_LIMIT = 10;
        constructor(id) {
            this.id = id;
        }
    }

    mockChannelMapStore = {isChannelMapEnabled: false};
    mockPreferenceStore = {
        imagePanelColumns: 3,
        imagePanelRows: 2,
        imagePanelMode: ImagePanelMode.None,
        isImageMultiPanelEnabled: true
    };

    return {
        AppStore: {
            Instance: {
                activeImage: null,
                channelMapStore: mockChannelMapStore,
                updateActiveImage: x => MockUpdateActiveImage(x),
                isActiveImage: () => MockIsActiveImage(),
                setActiveImage: x => MockSetActiveImage(x)
            }
        },
        PreferenceStore: {
            Instance: mockPreferenceStore
        },
        FrameStore: jest.fn(frameInfo => ({
            id: frameInfo.fileId,
            clearContours: jest.fn()
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
    // let mock frames become instance of FrameStore
    Object.setPrototypeOf(mockFrame1, FrameStore.prototype);
    Object.setPrototypeOf(mockFrame2, FrameStore.prototype);
    Object.setPrototypeOf(mockFrame3, FrameStore.prototype);

    const resetStoreState = () => {
        imageViewConfigStore.removeAllImages();
        (imageViewConfigStore as any).nextColorBlendingId = 0;
        MockUpdateActiveImage.mockReset();
        MockIsActiveImage.mockReset();
        MockSetActiveImage.mockReset();
    };

    const setupColorBlendings = () => {
        imageViewConfigStore.addFrame(mockFrame1);
        const first = imageViewConfigStore.createColorBlending();
        const second = imageViewConfigStore.createColorBlending();
        return {first, second};
    };

    beforeEach(() => {
        resetStoreState();
    });

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
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.replaceFrame(0, mockFrame2);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame2);
        });

        it("fails with incorrect index", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.replaceFrame(0, mockFrame2);
            imageViewConfigStore.replaceFrame(-1, mockFrame1);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame2);

            imageViewConfigStore.replaceFrame(1, mockFrame1);
            expect(imageViewConfigStore.getImage(0).store).toBe(mockFrame2);
        });
    });

    describe("removeFrame", () => {
        it("removes a frame correctly", () => {
            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.removeFrame(mockFrame2.id);
            expect(imageViewConfigStore.imageNum).toBe(0);
        });
    });

    describe("createColorBlending", () => {
        it("creates a color blended image correctly", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            const colorBlendingImage1 = imageViewConfigStore.createColorBlending();
            expect(colorBlendingImage1.id).toBe(0);
            expect(imageViewConfigStore.getImage(1).type).toBe(ImageType.COLOR_BLENDING);
            expect(imageViewConfigStore.getImage(1).store).toBe(colorBlendingImage1);
            expect(MockUpdateActiveImage).toHaveBeenCalledWith(imageViewConfigStore.getImage(1));

            const colorBlendingImage2 = imageViewConfigStore.createColorBlending();
            expect(colorBlendingImage2.id).toBe(1);
            expect(imageViewConfigStore.getImage(2).type).toBe(ImageType.COLOR_BLENDING);
            expect(imageViewConfigStore.getImage(2).store).toBe(colorBlendingImage2);
            expect(MockUpdateActiveImage).toHaveBeenCalledWith(imageViewConfigStore.getImage(2));
        });

        it("does not reuse ids after a color blending is removed", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            const first = imageViewConfigStore.createColorBlending();
            MockIsActiveImage.mockReturnValue(false);
            imageViewConfigStore.removeColorBlending(first);

            const second = imageViewConfigStore.createColorBlending();
            expect(second.id).toBe(1);
        });

        it("does not reuse ids after a color blending is removed", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            const first = imageViewConfigStore.createColorBlending();
            MockIsActiveImage.mockReturnValue(false);
            imageViewConfigStore.removeColorBlending(first);

            const second = imageViewConfigStore.createColorBlending();
            expect(second.id).toBe(1);
        });
    });

    describe("removeColorBlending", () => {
        it("removes a color blending image correctly", () => {
            const {first} = setupColorBlendings();
            MockIsActiveImage.mockImplementationOnce(() => false);
            imageViewConfigStore.removeColorBlending(first);
            expect(imageViewConfigStore.colorBlendingImages).not.toContain(first);
        });

        it("removes a active color blending image correctly", () => {
            const {second} = setupColorBlendings();
            MockIsActiveImage.mockImplementationOnce(() => true);
            imageViewConfigStore.removeColorBlending(second);
            expect(imageViewConfigStore.colorBlendingImages).not.toContain(second);
            expect(MockSetActiveImage).toHaveBeenCalledWith(imageViewConfigStore.getImage(0));
        });
    });

    describe("reorderImage", () => {
        it("reorders images correctly", () => {
            imageViewConfigStore.addFrame(mockFrame1);
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
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.removeAllImages();
            expect(imageViewConfigStore.imageNum).toBe(0);
        });
    });

    describe("sortImagesByTime", () => {
        const makeTimedFrame = (fileId: number, obsTimeMjdUtc?: number) => {
            const frame = new FrameStore({fileId} as any);
            Object.setPrototypeOf(frame, FrameStore.prototype);
            return Object.assign(frame, {obsTimeMjdUtc});
        };

        it("sorts images by ascending observation time", () => {
            const late = makeTimedFrame(10, 59100);
            const early = makeTimedFrame(11, 58900);
            const middle = makeTimedFrame(12, 59000);
            imageViewConfigStore.addFrame(late);
            imageViewConfigStore.addFrame(early);
            imageViewConfigStore.addFrame(middle);

            imageViewConfigStore.sortImagesByTime();
            expect(imageViewConfigStore.getImage(0).store).toBe(early);
            expect(imageViewConfigStore.getImage(1).store).toBe(middle);
            expect(imageViewConfigStore.getImage(2).store).toBe(late);
        });

        it("keeps images without a valid time at the end in their original order", () => {
            const late = makeTimedFrame(10, 59100);
            const noTime = makeTimedFrame(11);
            const early = makeTimedFrame(12, 58900);
            imageViewConfigStore.addFrame(late);
            imageViewConfigStore.addFrame(noTime);
            imageViewConfigStore.addFrame(early);
            const colorBlending = imageViewConfigStore.createColorBlending();

            imageViewConfigStore.sortImagesByTime();
            expect(imageViewConfigStore.getImage(0).store).toBe(early);
            expect(imageViewConfigStore.getImage(1).store).toBe(late);
            expect(imageViewConfigStore.getImage(2).store).toBe(noTime);
            expect(imageViewConfigStore.getImage(3).store).toBe(colorBlending);
        });
    });

    describe("image panel dimensions", () => {
        beforeEach(() => {
            imageViewConfigStore.removeAllImages();
            mockChannelMapStore.isChannelMapEnabled = false;
            mockPreferenceStore.isImageMultiPanelEnabled = true;
            mockPreferenceStore.imagePanelMode = ImagePanelMode.Dynamic;
            mockPreferenceStore.imagePanelColumns = 4;
            mockPreferenceStore.imagePanelRows = 3;
        });

        it("uses dynamic panel counts when multi-panel mode is dynamic", () => {
            imageViewConfigStore.addFrame(mockFrame1);
            imageViewConfigStore.addFrame(mockFrame2);
            imageViewConfigStore.addFrame(mockFrame3);

            expect(imageViewConfigStore.numImageColumns).toBe(3);
            expect(imageViewConfigStore.numImageRows).toBe(1);
        });

        it("uses fixed panel counts when multi-panel mode is fixed", () => {
            mockPreferenceStore.imagePanelMode = ImagePanelMode.Fixed;
            mockPreferenceStore.imagePanelColumns = 5;
            mockPreferenceStore.imagePanelRows = 4;

            expect(imageViewConfigStore.numImageColumns).toBe(5);
            expect(imageViewConfigStore.numImageRows).toBe(4);
        });

        it("collapses to a single panel when channel map mode is enabled", () => {
            mockChannelMapStore.isChannelMapEnabled = true;
            mockPreferenceStore.imagePanelMode = ImagePanelMode.Fixed;

            expect(imageViewConfigStore.numImageColumns).toBe(1);
            expect(imageViewConfigStore.numImageRows).toBe(1);
        });
    });

    describe("imageListSummary", () => {
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

            MockIsActiveImage.mockImplementationOnce(() => false);
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
});

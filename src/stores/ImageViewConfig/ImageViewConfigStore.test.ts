import {ImageType} from "enums";
import {FrameStore} from "stores";

import {ImageViewConfigStore} from "./ImageViewConfigStore";

const mockUpdateActiveImage = jest.fn();
const mockIsActiveImage = jest.fn();
const mockSetActiveImage = jest.fn();

// Mock RenderConfigStore to handle import chain
jest.mock("stores/Frame", () => ({
    RenderConfigStore: {
        COLOR_MAPS_SELECTED: ['viridis', 'plasma', 'inferno', 'magma'],
        COLOR_MAPS_MONO: new Map([
            ['red', '#ff0000'],
            ['green', '#00ff00'],
            ['blue', '#0000ff']
        ]),
        COLOR_MAPS_CUSTOM: 'custom',
        COLOR_MAPS_PANEL: 'panel',
        COLOR_MAPS_ALL: ['viridis', 'plasma', 'inferno', 'magma', 'red', 'green', 'blue', 'custom', 'panel'],
        SCALING_TYPES: new Map([
            ['linear', 'Linear'],
            ['log', 'Log'],
            ['sqrt', 'Square Root'],
            ['square', 'Square'],
            ['power', 'Power']
        ])
    }
}));

jest.mock("stores", () => {
    class MockColorBlendingStore {
        id;
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
                setActiveImage: x => mockSetActiveImage(x)
            }
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
});

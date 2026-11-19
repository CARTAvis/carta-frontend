import {ImageType} from "enums";
import {AppStore} from "stores/AppStore/AppStore";

import {WidgetsStore} from "./WidgetsStore";

function titleOf(activeImage: unknown, visibleImages: unknown[]): string {
    jest.spyOn(AppStore, "Instance", "get").mockReturnValue({
        activeImage,
        imageViewConfigStore: {visibleImages},
        isActiveImage: (image: any) => image?.type === (activeImage as any)?.type && image?.store === (activeImage as any)?.store
    } as unknown as AppStore);
    return Object.getOwnPropertyDescriptor(WidgetsStore.prototype, "imageViewWidgetTitle")!.get!.call({});
}

describe("imageViewWidgetTitle", () => {
    const frame = {type: ImageType.FRAME, store: {filename: "disk_0.fits"}};
    const blendStore = {filename: "Color Blending 1"};

    test("names the active image when the Image List keeps another item for it", () => {
        const listItem = {type: ImageType.COLOR_BLENDING, store: blendStore};
        const activeImage = {type: ImageType.COLOR_BLENDING, store: blendStore};
        expect(titleOf(activeImage, [frame, listItem])).toBe("Color Blending 1");
    });

    test("names the first shown image when the active image is not shown", () => {
        const activeImage = {type: ImageType.COLOR_BLENDING, store: blendStore};
        expect(titleOf(activeImage, [frame])).toBe("disk_0.fits");
    });

    test("names the first shown image when the active image is a PV preview", () => {
        const preview = {type: ImageType.PV_PREVIEW, store: {filename: "PV preview"}};
        expect(titleOf(preview, [frame, preview])).toBe("disk_0.fits");
    });

    test("says that no image is loaded", () => {
        expect(titleOf(undefined, [])).toBe("No image loaded");
    });
});

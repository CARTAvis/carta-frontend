import {runInAction} from "mobx";

import * as imageView from "components/ImageView/ImageViewComponent";
import {ImageType} from "enums/imageView";
import {AppStore} from "stores";
import * as svgExport from "utilities/export/imageViewSvgExport";
import * as svgDownload from "utilities/export/svgExport";

// Export tests exercise store actions without starting unrelated application reactions.
jest.mock("mobx", () => ({...jest.requireActual("mobx"), autorun: jest.fn(() => jest.fn()), reaction: jest.fn(() => jest.fn())}));

describe("AppStore image export lifecycle", () => {
    const store = AppStore.Instance;
    const originalRevoke = URL.revokeObjectURL;
    beforeAll(() => {
        if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();
    });
    afterAll(() => {
        if (!originalRevoke) delete (URL as any).revokeObjectURL;
    });
    let oldImage: typeof store.activeImage;
    beforeEach(() => {
        oldImage = store.activeImage;
        runInAction(() => {
            store.activeImage = {type: ImageType.FRAME, store: {overlayStore: {padding: {left: 0, right: 0, top: 0, bottom: 0}}}} as any;
        });
        jest.spyOn(store as any, "canExportActiveImage").mockReturnValue(true);
        jest.spyOn(store, "waitForImageData").mockResolvedValue();
        jest.spyOn(store as any, "getExportFilename").mockImplementation((extension: unknown) => `test.${extension}`);
    });
    afterEach(() => {
        runInAction(() => {
            store.activeImage = oldImage;
        });
        store.setIsExportingImage(false);
        store.setImageRatio(1);
        jest.restoreAllMocks();
    });

    test("keeps PNG export active through encoding and releases its blob URL", async () => {
        let encode: BlobCallback | undefined;
        const canvas = document.createElement("canvas");
        jest.spyOn(canvas, "toBlob").mockImplementation(callback => {
            encode = callback;
        });
        jest.spyOn(imageView, "getImageViewCanvas").mockReturnValue(canvas);
        const create = jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
        const revoke = jest.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
        jest.spyOn(HTMLAnchorElement.prototype, "dispatchEvent").mockReturnValue(true);
        const exportResult = store.exportImage(1);
        await Promise.resolve();
        expect(store.isExportingImage).toBe(true);
        encode?.(new Blob(["png"]));
        await exportResult;
        expect(create).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledWith("blob:test");
        expect(store.isExportingImage).toBe(false);
    });

    test("resets export state after a rendering failure", async () => {
        jest.spyOn(imageView, "getImageViewCanvas").mockImplementation(() => {
            throw new Error("render failed");
        });
        await expect(store.exportImage(1)).rejects.toThrow("render failed");
        expect(store.isExportingImage).toBe(false);
    });

    test("runs SVG export through the same lifecycle", async () => {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        jest.spyOn(svgExport, "getImageViewSvg").mockReturnValue(svg);
        const download = jest.spyOn(svgDownload, "downloadSvg").mockImplementation(() => {});
        await store.exportSvgImage(1);
        expect(download).toHaveBeenCalledWith(svg, "test.svg");
        expect(store.isExportingImage).toBe(false);
    });

    test("ignores overlapping exports without changing the pending request's resolution or state", async () => {
        let release!: () => void;
        jest.mocked(store.waitForImageData).mockImplementation(
            () =>
                new Promise(resolve => {
                    release = resolve;
                })
        );
        const render = jest.spyOn(svgExport, "getImageViewSvg").mockReturnValue(null);
        const first = store.exportSvgImage(4);
        await store.exportImage(1);
        await store.exportPdfImage(2);
        expect(store.imageRatio).toBe(4);
        expect(store.isExportingImage).toBe(true);
        expect(store.waitForImageData).toHaveBeenCalledTimes(1);
        release();
        await first;
        expect(render).toHaveBeenCalledTimes(1);
        expect(store.isExportingImage).toBe(false);
        jest.mocked(store.waitForImageData).mockResolvedValue();
        await store.exportSvgImage(1);
        expect(render).toHaveBeenCalledTimes(2);
    });
});

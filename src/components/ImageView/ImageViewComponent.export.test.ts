import {AppStore} from "stores";

import {getPanelCanvas} from "./ImageViewComponent";

describe("PNG panel export", () => {
    const padding = {left: 5, right: 0, top: 7, bottom: 0};
    const frame = {overlayStore: {padding}};
    let raster: HTMLCanvasElement;
    let contour: HTMLCanvasElement;
    let vector: HTMLCanvasElement;
    let overlay: HTMLCanvasElement;

    beforeEach(() => {
        document.body.innerHTML = "";
        const panel = document.createElement("div");
        panel.id = "image-panel-0-0";
        document.body.appendChild(panel);
        const addCanvas = (className: string) => {
            const canvas = document.createElement("canvas");
            canvas.className = className;
            canvas.width = 200;
            canvas.height = 160;
            panel.appendChild(canvas);
            return canvas;
        };
        raster = addCanvas("raster-canvas");
        contour = addCanvas("contour-canvas");
        vector = addCanvas("vector-overlay-canvas");
        overlay = addCanvas("overlay-canvas");
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({pixelRatio: 2, channelMapStore: {isChannelMapEnabled: false}} as any);
    });

    afterEach(() => jest.restoreAllMocks());

    test.each([true, false])("composites color-blending layers with raster visibility %s", isRasterVisible => {
        if (!isRasterVisible) raster.remove();

        const canvas = getPanelCanvas(0, 0, 240, 200, frame as any, "white", true);
        expect(canvas).not.toBeNull();
        expect(canvas?.width).toBe(240);
        expect(canvas?.height).toBe(200);
        const ctx = canvas?.getContext("2d");
        expect(ctx?.drawImage).toHaveBeenCalledWith(contour, 10, 14);
        expect(ctx?.drawImage).toHaveBeenCalledWith(vector, 10, 14);
        expect(ctx?.drawImage).toHaveBeenCalledWith(overlay, 0, 0);
        expect(ctx?.drawImage).toHaveBeenCalledTimes(isRasterVisible ? 4 : 3);
        if (isRasterVisible) expect(ctx?.drawImage).toHaveBeenCalledWith(raster, 10, 14);
    });

    test("retains the raster requirement for ordinary image panels", () => {
        raster.remove();
        expect(getPanelCanvas(0, 0, 240, 200, frame as any)).toBeNull();
    });
});

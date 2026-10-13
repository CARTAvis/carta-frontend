import {RegionId} from "enums";

import "stores";

import {HistogramComponent} from "./HistogramComponent";

describe("HistogramComponent export headers", () => {
    const exportHeadersGetter = Object.getOwnPropertyDescriptor(HistogramComponent.prototype, "exportHeaders")!.get!;
    const getExportHeaders = (widgetStore: unknown): string[] => exportHeadersGetter.call({widgetStore});

    test("includes both the image and the world definition of the region", () => {
        const pixel = "ellipse[[320.000000pix, 400.000000pix], [100.000000pix, 50.000000pix], 30.000000deg]";
        const world = 'ellipse(wcs:ICRS)[[18:20:21.0000000240, -16:12:10.0000000440], [40.0000000000", 20.0000000000"], 30.000000deg]';
        const getRegionProperties = jest.fn().mockReturnValue([pixel, world]);

        expect(getExportHeaders({effectiveFrame: {getRegionProperties}, effectiveRegionId: 1})).toEqual([pixel, world]);
        expect(getRegionProperties).toHaveBeenCalledWith(1);
    });

    test("has no region lines without a frame or a region", () => {
        const getRegionProperties = jest.fn().mockReturnValue([]);
        expect(getExportHeaders({effectiveFrame: null, effectiveRegionId: 1})).toEqual([]);
        expect(getExportHeaders({effectiveFrame: {getRegionProperties}, effectiveRegionId: null})).toEqual([]);
        expect(getExportHeaders({effectiveFrame: {getRegionProperties}, effectiveRegionId: RegionId.IMAGE})).toEqual([]);
    });
});

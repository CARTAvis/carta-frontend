import {CARTA} from "carta-protobuf";
import {configure} from "mobx";

import {ImageFittingStore} from "stores";
import {type FrameStore} from "stores/Frame";

configure({safeDescriptors: false});

describe("ImageFittingStore region info log", () => {
    const fovInfo = {
        regionType: CARTA.RegionType.RECTANGLE,
        controlPoints: [
            {x: 50, y: 60},
            {x: 20, y: 10}
        ],
        rotation: 0
    };
    const getFovLog = (frame: Partial<FrameStore> | null): string => {
        const store = new ImageFittingStore();
        jest.spyOn(store, "effectiveFrame", "get").mockReturnValue(frame as FrameStore | null);
        return (store as unknown as {getRegionInfoLog: (regionId: number, fovInfo: CARTA.RegionInfo.$Properties) => string}).getRegionInfoLog(0, fovInfo);
    };

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("lists the field of view in pixel and world coordinates", () => {
        const world = 'rotbox(wcs:ICRS)[[18:20:21.0, -16:12:10.0], [40.0", 20.0"], 0.000000deg]';
        const lines = getFovLog({genRegionWcsProperties: () => world}).split("\n");
        expect(lines[0]).toBe("Region: field of view");
        expect(lines[1]).toMatch(/^rotbox\[\[50\.000000pix, 60\.000000pix\]/);
        expect(lines[2]).toBe(world);
    });

    test("omits the world line when it is unavailable or there is no frame", () => {
        for (const frame of [{genRegionWcsProperties: () => undefined}, null]) {
            const log = getFovLog(frame);
            expect(log).toMatch(/^Region: field of view\nrotbox\[\[50\.000000pix, 60\.000000pix\].*\n$/);
            expect(log).not.toContain("Invalid");
            expect(log).not.toContain("undefined");
        }
    });
});

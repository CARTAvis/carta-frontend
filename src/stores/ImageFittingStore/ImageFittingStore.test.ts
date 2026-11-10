import {CARTA} from "carta-protobuf";
import {configure} from "mobx";

import {AppStore, ImageFittingStore} from "stores";
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
        return (store as unknown as {getRegionInfoLog: (frame: FrameStore | null, regionId: number, fovInfo: CARTA.RegionInfo.$Properties) => string}).getRegionInfoLog(frame as FrameStore | null, 0, fovInfo);
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

describe("ImageFittingStore in a workspace", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("saves the dialog settings, with an empty initial value as null, and applies them again", () => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({frames: [], activeFrame: null, frameNames: []} as unknown as AppStore);
        const saved = new ImageFittingStore();
        saved.setComponents(2);
        saved.components[0].setCenterX(10);
        saved.components[0].setAmplitude(2);
        saved.components[0].toggleAmplitudeFixed();
        saved.components[1].setPa(30);
        saved.setIsAutoInitVal(false);
        saved.setBackgroundOffset(0.5);
        saved.toggleBackgroundOffsetFixed();
        saved.setSolverType(CARTA.FittingSolverType.Svd);
        saved.toggleCreateResidualImage();

        const config = saved.toWorkspaceConfig(3, 5);

        expect(config).toEqual({
            imageId: 3,
            regionId: 5,
            components: [
                {center: {x: 10, y: null}, amp: 2, fwhm: {x: null, y: null}, pa: null, fixed: [false, false, true, false, false, false]},
                {center: {x: null, y: null}, amp: null, fwhm: {x: null, y: null}, pa: 30, fixed: [false, false, false, false, false, false]}
            ],
            autoInitialValues: false,
            backgroundOffset: 0.5,
            backgroundOffsetFixed: false,
            solver: CARTA.FittingSolverType.Svd,
            createModelImage: true,
            createResidualImage: false
        });

        const restored = new ImageFittingStore();
        restored.applyWorkspaceConfig(JSON.parse(JSON.stringify(config)), 7, 105);

        expect(restored.toWorkspaceConfig(3, 5)).toEqual(config);
        expect([restored.selectedFileId, restored.selectedRegionId]).toEqual([7, 105]);
    });

    test("keeps the default of each saved value that is not valid", () => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({frames: [], activeFrame: null, frameNames: []} as unknown as AppStore);
        const store = new ImageFittingStore();

        store.applyWorkspaceConfig({components: [{center: {x: "1"}, fwhm: {x: -2}}], solver: 99, backgroundOffset: "x"} as never, -1, 0);

        expect(store.components.map(component => [component.center.x, component.fwhm.x])).toEqual([[NaN, NaN]]);
        expect([store.solverType, store.backgroundOffset, store.isAutoInitVal, store.isBackgroundOffsetFixed]).toEqual([CARTA.FittingSolverType.Cholesky, 0, true, true]);
    });
});

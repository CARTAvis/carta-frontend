import {CARTA} from "carta-protobuf";

import {TelemetryService} from "../../../services";
import {AppStore} from "../..";
import {ACTIVE_FILE_ID} from "../RegionWidgetStore/RegionWidgetStore";

import {PvGeneratorWidgetStore} from "./PvGeneratorWidgetStore";

describe("PvGeneratorWidgetStore on a nonlinear spectral axis", () => {
    const createStore = (isSpectralAxisNonlinear: boolean) => {
        const region = {regionId: 1, regionType: CARTA.RegionType.LINE, size: {x: 3, y: 4}, isTemporary: false, nameString: "line"};
        const frame = {
            isSpectralAxisNonlinear,
            channelValueBounds: {min: 0, max: 10},
            findChannelIndexByValue: rs.fn((value: number) => value),
            frameInfo: {fileId: 3},
            getRegion: rs.fn(() => region),
            regionSet: {focusedRegion: undefined, regions: [region]},
            resetPvRequestState: rs.fn(),
            setIsRequestingPV: rs.fn()
        };
        const appStore = {activeFrame: frame, frames: [frame], getFrame: rs.fn(() => frame), focusedRegion: undefined, requestPV: rs.fn(), requestPreviewPV: rs.fn()};
        rs.spyOn(AppStore, "Instance", "get").mockReturnValue(appStore as unknown as AppStore);
        rs.spyOn(TelemetryService.Instance, "addTelemetryEntry").mockResolvedValue(undefined);
        const store = new PvGeneratorWidgetStore();
        store.setRegionId(ACTIVE_FILE_ID, region.regionId);
        return {store, appStore};
    };

    afterEach(() => {
        rs.restoreAllMocks();
    });

    test("requests neither a PV image nor a preview", () => {
        const {store, appStore} = createStore(true);
        store.requestPV();
        store.requestPV(true, "pv-generator-0-1");
        expect(appStore.requestPV).not.toHaveBeenCalled();
        expect(appStore.requestPreviewPV).not.toHaveBeenCalled();
    });

    test("still requests a PV image for a linear spectral axis", () => {
        const {store, appStore} = createStore(false);
        store.requestPV();
        expect(appStore.requestPV).toHaveBeenCalledTimes(1);
    });
});

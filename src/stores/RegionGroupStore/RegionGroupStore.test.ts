jest.mock(
    "carta-protobuf",
    () => ({
        CARTA: {
            StatsType: {Sum: 2, FluxDensity: 3, Mean: 4}
        }
    }),
    {virtual: true}
);

import {RegionGroupStore} from "./RegionGroupStore";

describe("RegionGroupStore", () => {
    test("updates and removes frame-region associations", () => {
        const store = new RegionGroupStore("group-1", "Group 1");

        store.setRegion(10, 3, {regionSum: 12, regionMean: 4});
        expect(store.regionGroup.get(10)).toEqual({regionId: 3, regionSum: 12, regionFluxDensity: NaN, regionMean: 4});

        store.setRegion(10, 4);
        expect(store.regionGroup.get(10)).toEqual({regionId: 4, regionSum: NaN, regionFluxDensity: NaN, regionMean: NaN});

        store.removeRegion(10);
        expect(store.regionGroup.has(10)).toBe(false);
    });

    test("updates statistics only for the registered region", () => {
        const store = new RegionGroupStore("group-1", "Group 1");
        store.setRegion(10, 3);

        store.updateRegionStats({
            fileId: 10,
            regionId: 99,
            statistics: [
                {statsType: 2, value: 1},
                {statsType: 4, value: 2}
            ]
        } as any);
        expect(store.regionGroup.get(10)).toEqual({regionId: 3, regionSum: NaN, regionFluxDensity: NaN, regionMean: NaN});

        store.updateRegionStats({
            fileId: 10,
            regionId: 3,
            statistics: [
                {statsType: 2, value: 12},
                {statsType: 3, value: 6},
                {statsType: 4, value: 4}
            ]
        } as any);
        expect(store.regionGroup.get(10)).toEqual({regionId: 3, regionSum: 12, regionFluxDensity: 6, regionMean: 4});
    });

    test("synchronizes time-series frames and automatically selects the first region", () => {
        const store = new RegionGroupStore("group-1", "Group 1");

        store.syncTimeSeriesFrames(
            [
                {frameId: 10, mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00", stokes: 0, regionIds: [3, 4], regionSumUnit: "Jy/beam", regionFluxDensityUnit: "Jy"},
                {frameId: 11, mjdUtc: 59001, isoUtc: "2020-06-01T00:00:00", stokes: 0, regionIds: [], regionSumUnit: "Jy/beam", regionFluxDensityUnit: "Jy"}
            ],
            (frameId, regionId, stokes) => (frameId === 10 && regionId === 3 && stokes === 0 ? {regionFluxDensity: 6} : undefined)
        );

        expect(store.regionGroup.get(10)).toMatchObject({regionId: 3, mjdUtc: 59000, regionSum: NaN, regionFluxDensity: 6});
        expect(store.regionGroup.get(11)).toMatchObject({regionId: undefined, mjdUtc: 59001, regionSum: NaN, regionFluxDensity: NaN});

        store.updateRegionStats({fileId: 10, regionId: 3, stokes: 1, statistics: [{statsType: 2, value: 99}]} as any);
        expect(store.regionGroup.get(10)?.regionSum).toBeNaN();

        store.updateRegionStats({fileId: 10, regionId: 3, stokes: 0, statistics: [{statsType: 2, value: 12}]} as any);
        expect(store.regionGroup.get(10)?.regionSum).toBe(12);

        store.setRegion(10, 4);
        store.syncTimeSeriesFrames([{frameId: 10, mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00", stokes: 0, regionIds: [3, 4], regionSumUnit: "Jy/beam", regionFluxDensityUnit: "Jy"}]);
        expect(store.regionGroup.get(10)?.regionId).toBe(4);
        expect(store.regionGroup.has(11)).toBe(false);
    });
});

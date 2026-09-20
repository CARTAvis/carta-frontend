jest.mock(
    "carta-protobuf",
    () => ({
        CARTA: {
            StatsType: {Sum: 2, Mean: 4}
        }
    }),
    {virtual: true}
);

import {RegionGroupType} from "enums";

import {RegionGroupStore} from "./RegionGroupStore";

describe("RegionGroupStore", () => {
    test("updates and removes frame-region associations", () => {
        const store = new RegionGroupStore("group-1", "Group 1");

        store.setRegion(10, 3, {regionSum: 12, regionMean: 4});
        expect(store.regionGroup.get(10)).toEqual({regionId: 3, regionSum: 12, regionMean: 4});

        store.setRegion(10, 4);
        expect(store.regionGroup.get(10)).toEqual({regionId: 4});

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
        expect(store.regionGroup.get(10)).toEqual({regionId: 3});

        store.updateRegionStats({
            fileId: 10,
            regionId: 3,
            statistics: [
                {statsType: 2, value: 12},
                {statsType: 4, value: 4}
            ]
        } as any);
        expect(store.regionGroup.get(10)).toEqual({regionId: 3, regionSum: 12, regionMean: 4});
    });

    test("copies entries without sharing mutable values", () => {
        const original = new RegionGroupStore("group-1", "Group 1", RegionGroupType.REGION_SERIES);
        original.setRegion(10, 3, {regionSum: 12, regionMean: 4});

        const copy = original.copy("group-2", "Group 2");
        copy.setRegion(10, 5, {regionSum: 20});

        expect(copy.regionGroupId).toBe("group-2");
        expect(copy.regionGroupType).toBe(RegionGroupType.REGION_SERIES);
        expect(original.regionGroup.get(10)).toEqual({regionId: 3, regionSum: 12, regionMean: 4});
        expect(copy.regionGroup.get(10)).toEqual({regionId: 5, regionSum: 20});
    });
});

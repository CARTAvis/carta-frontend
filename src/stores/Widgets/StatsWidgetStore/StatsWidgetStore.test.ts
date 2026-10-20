import {CARTA} from "carta-protobuf";

import {AppStore} from "stores";

import {StatsWidgetStore} from "./StatsWidgetStore";

jest.mock("enums", () => ({Polarizations: {}, RegionsType: {CLOSED: 0}}));
jest.mock("models", () => ({VALID_COORDINATES: ["z"]}));
jest.mock("stores", () => ({AppStore: {Instance: {preferenceStore: {statistics: []}}}}));
jest.mock("stores/Widgets", () => ({RegionWidgetStore: class {}}));

describe("StatsWidgetStore requirements", () => {
    test("detects changes to requested statistic types", () => {
        const originalRequirements = new Map([
            [
                0,
                new Map([
                    [
                        -1,
                        new CARTA.SetStatsRequirements({
                            fileId: 0,
                            regionId: -1,
                            statsConfigs: [{coordinate: "z", statsTypes: [CARTA.StatsType.Mean]}]
                        })
                    ]
                ])
            ]
        ]);
        const updatedRequirements = new Map([
            [
                0,
                new Map([
                    [
                        -1,
                        new CARTA.SetStatsRequirements({
                            fileId: 0,
                            regionId: -1,
                            statsConfigs: [{coordinate: "z", statsTypes: [CARTA.StatsType.Mean, CARTA.StatsType.Median]}]
                        })
                    ]
                ])
            ]
        ]);

        expect(StatsWidgetStore.diffStatsRequirements(originalRequirements, updatedRequirements)).toEqual([updatedRequirements.get(0)?.get(-1)]);
    });

    test("shares selected-statistic processing but gives each coordinate its own list", () => {
        const previousStatistics = AppStore.Instance.preferenceStore.statistics;
        Object.assign(AppStore.Instance.preferenceStore, {statistics: [CARTA.StatsType.Mean, "SNR"]});
        const frame = {frameInfo: {fileId: 0}, regionSet: {regions: []}};
        const widgets = new Map([
            ["a", {effectiveFrame: frame, effectiveRegionId: -1, coordinate: "z"} as any],
            ["b", {effectiveFrame: frame, effectiveRegionId: -1, coordinate: "x"} as any]
        ]);

        const requirements = StatsWidgetStore.calculateRequirementsMap(widgets).get(0)?.get(-1)?.statsConfigs ?? [];

        expect(requirements).toHaveLength(2);
        expect(requirements[0].statsTypes).toEqual([CARTA.StatsType.NumPixels, CARTA.StatsType.Mean]);
        expect(requirements[1].statsTypes).toEqual([CARTA.StatsType.NumPixels, CARTA.StatsType.Mean]);
        expect(requirements[0].statsTypes).not.toBe(requirements[1].statsTypes);
        Object.assign(AppStore.Instance.preferenceStore, {statistics: previousStatistics});
    });
});

import {CARTA} from "carta-protobuf";

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
});

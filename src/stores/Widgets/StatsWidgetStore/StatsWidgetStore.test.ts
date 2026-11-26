import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {PreferenceKeys} from "enums/preference";
import {DEFAULT_STATS_DISPLAY_TYPES, QUANTILE_STATISTICS_TYPES} from "models/StatisticsDefinition/StatisticsDefinition";
import {ApiService} from "services";
import {AppStore, PreferenceStore} from "stores";

import {StatsWidgetStore} from "./StatsWidgetStore";

describe("StatsWidgetStore requirements", () => {
    const preferenceStore = PreferenceStore.Instance;
    const standardTypes = DEFAULT_STATS_DISPLAY_TYPES.filter(type => typeof type === "number");
    const frame = {frameInfo: {fileId: 0}, regionSet: {regions: []}};
    const widget = {effectiveFrame: frame, effectiveRegionId: -1, coordinate: "z"} as StatsWidgetStore;

    beforeEach(() => {
        jest.spyOn(AppStore, "Instance", "get").mockReturnValue({preferenceStore} as AppStore);
        jest.spyOn(ApiService.Instance, "setPreference").mockResolvedValue(true);
    });

    afterEach(() => {
        runInAction(() => preferenceStore.preferences.delete(PreferenceKeys.STATISTICS));
        jest.restoreAllMocks();
    });

    test.each(QUANTILE_STATISTICS_TYPES)("adds and drops only the enabled quantile %s", type => {
        const widgets = new Map([["a", widget]]);
        const original = StatsWidgetStore.calculateRequirementsMap(widgets);
        expect(original.get(0)?.get(-1)?.statsConfigs?.[0].statsTypes).toEqual(standardTypes);

        preferenceStore.toggleStatistic(type);
        const enabled = StatsWidgetStore.calculateRequirementsMap(widgets);
        expect(StatsWidgetStore.diffStatsRequirements(original, enabled).map(req => req.statsConfigs?.[0].statsTypes)).toEqual([[...standardTypes, type]]);

        const nextType = type === CARTA.StatsType.Median ? CARTA.StatsType.Q1 : CARTA.StatsType.Median;
        preferenceStore.toggleStatistic(type);
        preferenceStore.toggleStatistic(nextType);
        const switched = StatsWidgetStore.calculateRequirementsMap(widgets);
        expect(StatsWidgetStore.diffStatsRequirements(enabled, switched).map(req => req.statsConfigs?.[0].statsTypes)).toEqual([[...standardTypes, nextType]]);

        preferenceStore.toggleStatistic(nextType);
        const disabled = StatsWidgetStore.calculateRequirementsMap(widgets);
        expect(StatsWidgetStore.diffStatsRequirements(switched, disabled).map(req => req.statsConfigs?.[0].statsTypes)).toEqual([standardTypes]);
    });

    test("requests pixel counts and gives each coordinate its own list", () => {
        const widgets = new Map([
            ["a", widget],
            ["b", {...widget, coordinate: "Iz"} as StatsWidgetStore]
        ]);
        const requirements = StatsWidgetStore.calculateRequirementsMap(widgets).get(0)?.get(-1)?.statsConfigs ?? [];
        expect(requirements).toHaveLength(2);
        expect(requirements[0].statsTypes).toContain(CARTA.StatsType.NumPixels);
        expect(requirements[1].statsTypes).toEqual(requirements[0].statsTypes);
        expect(requirements[1].statsTypes).not.toBe(requirements[0].statsTypes);
    });
});

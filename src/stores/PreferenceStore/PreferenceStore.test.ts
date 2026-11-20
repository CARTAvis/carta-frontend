import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {PreferenceKeys} from "enums/preference";
import {DEFAULT_STATS_DISPLAY_TYPES, EXTRA_STATISTICS_TYPES, NUM_BEAMS_STATS_TYPE, STATISTICS_NAME_MAP} from "models/StatisticsDefinition/StatisticsDefinition";
import {PreferenceStore} from "stores";

describe("PreferenceStore statistics", () => {
    const preferenceStore = PreferenceStore.Instance;

    afterEach(() => {
        runInAction(() => preferenceStore.preferences.delete(PreferenceKeys.STATISTICS));
    });

    test("orders extra quantities consistently in preferences and the statistics table", () => {
        const expectedOrder = [CARTA.StatsType.Median, CARTA.StatsType.Q1, CARTA.StatsType.Q3, CARTA.StatsType.Quartile, CARTA.StatsType.MedAbsDevMed];
        expect(EXTRA_STATISTICS_TYPES).toEqual(expectedOrder);
        expect(Array.from(STATISTICS_NAME_MAP.keys()).filter(type => EXTRA_STATISTICS_TYPES.includes(type as CARTA.StatsType))).toEqual(expectedOrder);
    });

    test.each([undefined, null, 17, "Mean", {}, [999], ["bad", 999], [CARTA.StatsType.Mean, "bad"]].map(selection => ({selection})))("uses defaults for invalid stored selection $selection", ({selection}) => {
        runInAction(() => preferenceStore.preferences.set(PreferenceKeys.STATISTICS, selection));
        expect(preferenceStore.statistics).toEqual(DEFAULT_STATS_DISPLAY_TYPES);
    });

    test.each([[], [CARTA.StatsType.Median], [CARTA.StatsType.Mean, NUM_BEAMS_STATS_TYPE]].map(selection => ({selection})))("keeps standard quantities visible with stored selection $selection", ({selection}) => {
        runInAction(() => preferenceStore.preferences.set(PreferenceKeys.STATISTICS, selection));
        expect(preferenceStore.statistics).toEqual(Array.from(new Set([...DEFAULT_STATS_DISPLAY_TYPES, ...selection])));
    });
});

import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {PreferenceKeys} from "enums/preference";
import {DEFAULT_STATS_DISPLAY_TYPES, NUM_BEAMS_STATS_TYPE} from "models/StatisticsDefinition/StatisticsDefinition";
import {PreferenceStore} from "stores";

describe("PreferenceStore statistics", () => {
    const preferenceStore = PreferenceStore.Instance;

    afterEach(() => {
        runInAction(() => preferenceStore.preferences.delete(PreferenceKeys.STATISTICS));
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

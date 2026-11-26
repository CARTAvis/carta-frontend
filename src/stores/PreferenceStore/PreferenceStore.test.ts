import {CARTA} from "carta-protobuf";
import {runInAction} from "mobx";

import {PreferenceKeys} from "enums/preference";
import {DEFAULT_STATS_DISPLAY_TYPES, EXTRA_STATISTICS_TYPES, NUM_BEAMS_STATS_TYPE} from "models/StatisticsDefinition/StatisticsDefinition";
import {ApiService} from "services";
import {PreferenceStore} from "stores";

describe("PreferenceStore statistics", () => {
    const preferenceStore = PreferenceStore.Instance;

    afterEach(() => {
        runInAction(() => preferenceStore.preferences.delete(PreferenceKeys.STATISTICS));
        jest.restoreAllMocks();
    });

    test("keeps known saved quantities and removes unknown entries and duplicates", () => {
        runInAction(() => preferenceStore.preferences.set(PreferenceKeys.STATISTICS, [CARTA.StatsType.Median, "bad", CARTA.StatsType.Q1, 999, CARTA.StatsType.Median]));
        expect(preferenceStore.statistics).toEqual([...DEFAULT_STATS_DISPLAY_TYPES, CARTA.StatsType.Median, CARTA.StatsType.Q1]);
    });

    test("toggles an extra quantity and persists the resulting selection", () => {
        const save = jest.spyOn(ApiService.Instance, "setPreference").mockResolvedValue(true);
        preferenceStore.toggleStatistic(CARTA.StatsType.Q1);
        expect(preferenceStore.statistics).toEqual([...DEFAULT_STATS_DISPLAY_TYPES, CARTA.StatsType.Q1]);
        expect(save).toHaveBeenLastCalledWith(PreferenceKeys.STATISTICS, preferenceStore.statistics);
        preferenceStore.toggleStatistic(CARTA.StatsType.Q1);
        expect(preferenceStore.statistics).toEqual(DEFAULT_STATS_DISPLAY_TYPES);
        expect(save).toHaveBeenLastCalledWith(PreferenceKeys.STATISTICS, DEFAULT_STATS_DISPLAY_TYPES);
    });

    test.each([[], [CARTA.StatsType.Q1]].map(selection => ({selection})))("selects all from $selection and clears all on the next toggle", ({selection}) => {
        const save = jest.spyOn(ApiService.Instance, "setPreference").mockResolvedValue(true);
        runInAction(() => preferenceStore.preferences.set(PreferenceKeys.STATISTICS, selection));
        preferenceStore.toggleAllExtraStatistics();
        expect(preferenceStore.statistics).toEqual([...DEFAULT_STATS_DISPLAY_TYPES, ...EXTRA_STATISTICS_TYPES]);
        expect(save).toHaveBeenLastCalledWith(PreferenceKeys.STATISTICS, preferenceStore.statistics);
        preferenceStore.toggleAllExtraStatistics();
        expect(preferenceStore.statistics).toEqual(DEFAULT_STATS_DISPLAY_TYPES);
        expect(save).toHaveBeenLastCalledWith(PreferenceKeys.STATISTICS, DEFAULT_STATS_DISPLAY_TYPES);
    });

    test("resets extra statistics and clears the saved preference", () => {
        const clear = jest.spyOn(ApiService.Instance, "clearPreferences").mockResolvedValue(true);
        runInAction(() => preferenceStore.preferences.set(PreferenceKeys.STATISTICS, [CARTA.StatsType.Q1]));
        preferenceStore.resetStatisticsSettings();
        expect(preferenceStore.statistics).toEqual(DEFAULT_STATS_DISPLAY_TYPES);
        expect(clear).toHaveBeenCalledWith([PreferenceKeys.STATISTICS]);
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

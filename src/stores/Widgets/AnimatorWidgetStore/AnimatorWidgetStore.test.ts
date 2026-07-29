import {IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";

import {AnimatorWidgetStore} from "./AnimatorWidgetStore";

describe("AnimatorWidgetStore", () => {
    test("uses backward-compatible time label defaults", () => {
        expect(new AnimatorWidgetStore().toConfig()).toEqual({
            timeLabelFormat: TimeLabelFormat.AUTO,
            timeZoneMode: TimeZoneMode.UTC,
            ianaTimeZone: "UTC",
            timeScale: TimeScale.UTC,
            isoTimePrecision: IsoTimePrecision.AUTO,
            numericTimePrecision: null,
            relativeTimeReference: RelativeTimeReference.FIRST,
            relativeReferenceMjdUtc: null,
            relativeTimeUnit: RelativeTimeUnit.AUTO
        });
    });

    test("restores valid settings from a layout config", () => {
        const store = new AnimatorWidgetStore();
        store.init({
            timeLabelFormat: TimeLabelFormat.RELATIVE,
            timeZoneMode: TimeZoneMode.IANA,
            ianaTimeZone: "Asia/Taipei",
            timeScale: TimeScale.TCG,
            isoTimePrecision: IsoTimePrecision.MICROSECOND,
            numericTimePrecision: 4,
            relativeTimeReference: RelativeTimeReference.CUSTOM,
            relativeReferenceMjdUtc: 59000,
            relativeTimeUnit: RelativeTimeUnit.DAY
        });

        expect(store.toConfig()).toEqual({
            timeLabelFormat: TimeLabelFormat.RELATIVE,
            timeZoneMode: TimeZoneMode.IANA,
            ianaTimeZone: "Asia/Taipei",
            timeScale: TimeScale.TCG,
            isoTimePrecision: IsoTimePrecision.MICROSECOND,
            numericTimePrecision: 4,
            relativeTimeReference: RelativeTimeReference.CUSTOM,
            relativeReferenceMjdUtc: 59000,
            relativeTimeUnit: RelativeTimeUnit.DAY
        });
    });

    test("ignores invalid persisted values", () => {
        const store = new AnimatorWidgetStore();
        store.init({
            timeLabelFormat: "invalid",
            timeZoneMode: "invalid",
            timeScale: "invalid",
            isoTimePrecision: "invalid",
            numericTimePrecision: 10,
            relativeTimeReference: "invalid",
            relativeReferenceMjdUtc: NaN,
            relativeTimeUnit: "invalid"
        });

        expect(store.toConfig()).toEqual({
            timeLabelFormat: TimeLabelFormat.AUTO,
            timeZoneMode: TimeZoneMode.UTC,
            ianaTimeZone: "UTC",
            timeScale: TimeScale.UTC,
            isoTimePrecision: IsoTimePrecision.AUTO,
            numericTimePrecision: null,
            relativeTimeReference: RelativeTimeReference.FIRST,
            relativeReferenceMjdUtc: null,
            relativeTimeUnit: RelativeTimeUnit.AUTO
        });
    });

    test("restores a time-series image reference", () => {
        const store = new AnimatorWidgetStore();
        store.init({
            relativeTimeReference: RelativeTimeReference.IMAGE,
            relativeReferenceMjdUtc: 59000
        });

        expect(store.relativeTimeReference).toBe(RelativeTimeReference.IMAGE);
        expect(store.relativeReferenceMjdUtc).toBe(59000);
    });
});

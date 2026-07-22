import * as AST from "ast_wrapper";

import {IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";

import {
    convertMjdToUtc,
    formatIsoUtcTickLabels,
    formatMjdUtcAsIso,
    formatTimeSeriesTickLabels,
    getTimeSeriesTickLabelResult,
    isValidIanaTimeZone,
    mapTimeSysToAstScale,
    normalizeDateObsString,
    parseIsoUtcToMjdUtc,
    parseObsDateToMjdUtc
} from "./time";

const SECONDS_PER_DAY = 86400;

describe("TimeScale", () => {
    test("includes the time scales supported by Animator", () => {
        expect(Object.values(TimeScale)).toEqual(["UTC", "TAI", "TT", "TCG"]);
    });
});

describe("mapTimeSysToAstScale", () => {
    test("defaults to UTC when TIMESYS is absent or empty", () => {
        expect(mapTimeSysToAstScale(undefined)).toEqual({scale: "UTC", offsetDays: 0});
        expect(mapTimeSysToAstScale("")).toEqual({scale: "UTC", offsetDays: 0});
    });

    test("maps the FITS time scales to AST time scales", () => {
        expect(mapTimeSysToAstScale("UTC")).toEqual({scale: "UTC", offsetDays: 0});
        expect(mapTimeSysToAstScale("GMT")).toEqual({scale: "UTC", offsetDays: 0});
        expect(mapTimeSysToAstScale("TAI")).toEqual({scale: "TAI", offsetDays: 0});
        expect(mapTimeSysToAstScale("IAT")).toEqual({scale: "TAI", offsetDays: 0});
        expect(mapTimeSysToAstScale("TT")).toEqual({scale: "TT", offsetDays: 0});
        expect(mapTimeSysToAstScale("TDT")).toEqual({scale: "TT", offsetDays: 0});
        expect(mapTimeSysToAstScale("ET")).toEqual({scale: "TT", offsetDays: 0});
        expect(mapTimeSysToAstScale("TDB")).toEqual({scale: "TDB", offsetDays: 0});
        expect(mapTimeSysToAstScale("TCB")).toEqual({scale: "TCB", offsetDays: 0});
        expect(mapTimeSysToAstScale("TCG")).toEqual({scale: "TCG", offsetDays: 0});
        expect(mapTimeSysToAstScale("UT1")).toEqual({scale: "UT1", offsetDays: 0});
    });

    test("handles GPS as TAI with a 19-second offset", () => {
        expect(mapTimeSysToAstScale("GPS")).toEqual({scale: "TAI", offsetDays: 19 / SECONDS_PER_DAY});
    });

    test("is tolerant to case and whitespace", () => {
        expect(mapTimeSysToAstScale("  utc ")).toEqual({scale: "UTC", offsetDays: 0});
        expect(mapTimeSysToAstScale("tai")).toEqual({scale: "TAI", offsetDays: 0});
    });

    test("returns null for unrecognized time scales", () => {
        expect(mapTimeSysToAstScale("LOCAL")).toBeNull();
        expect(mapTimeSysToAstScale("FOO")).toBeNull();
    });
});

describe("normalizeDateObsString", () => {
    test("converts the legacy DD/MM/YY format to ISO-8601", () => {
        expect(normalizeDateObsString("25/12/98")).toBe("1998-12-25");
        expect(normalizeDateObsString("01/02/03")).toBe("1903-02-01");
    });

    test("passes ISO-8601 strings through trimmed", () => {
        expect(normalizeDateObsString("2018-04-23T05:12:31.5")).toBe("2018-04-23T05:12:31.5");
        expect(normalizeDateObsString(" 2018-04-23 ")).toBe("2018-04-23");
    });
});

describe("parseObsDateToMjdUtc", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("parses the date string in the TIMESYS scale and converts to UTC", () => {
        (AST.parseDateToMJD as jest.Mock).mockReturnValue(58849.5);
        (AST.convertMJD as jest.Mock).mockImplementation(mjd => mjd);

        expect(parseObsDateToMjdUtc("2020-01-01T12:00:00", "TAI")).toBe(58849.5);
        expect(AST.parseDateToMJD).toHaveBeenCalledWith("2020-01-01T12:00:00", "TAI");
        expect(AST.convertMJD).toHaveBeenCalledWith(58849.5, "TAI", "UTC");
    });

    test("normalizes legacy date strings before parsing", () => {
        (AST.parseDateToMJD as jest.Mock).mockReturnValue(51172);
        parseObsDateToMjdUtc("25/12/98");
        expect(AST.parseDateToMJD).toHaveBeenCalledWith("1998-12-25", "UTC");
    });

    test("returns NaN for unrecognized TIMESYS or unparsable dates", () => {
        expect(parseObsDateToMjdUtc("2020-01-01", "FOO")).toBeNaN();

        (AST.parseDateToMJD as jest.Mock).mockReturnValue(NaN);
        expect(parseObsDateToMjdUtc("not a date")).toBeNaN();
    });
});

describe("parseIsoUtcToMjdUtc", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AST.parseDateToMJD as jest.Mock).mockReturnValue(59000.5);
        (AST.convertMJD as jest.Mock).mockImplementation(mjd => mjd);
    });

    test("parses a complete ISO UTC value with microsecond precision", () => {
        expect(parseIsoUtcToMjdUtc("2020-05-31T12:00:00.123456Z")).toBe(59000.5);
        expect(AST.parseDateToMJD).toHaveBeenCalledWith("2020-05-31T12:00:00.123456", "UTC");
    });

    test("rejects incomplete values and explicit non-UTC offsets", () => {
        expect(parseIsoUtcToMjdUtc("2020-05-31")).toBeNaN();
        expect(parseIsoUtcToMjdUtc("2020-05-31T12:00:00+08:00")).toBeNaN();
        expect(AST.parseDateToMJD).not.toHaveBeenCalled();
    });
});

describe("convertMjdToUtc", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (AST.convertMJD as jest.Mock).mockImplementation(mjd => mjd);
    });

    test("converts an MJD in the TIMESYS scale to UTC", () => {
        expect(convertMjdToUtc(59000, "TT")).toBe(59000);
        expect(AST.convertMJD).toHaveBeenCalledWith(59000, "TT", "UTC");
    });

    test("applies the GPS offset before converting as TAI", () => {
        convertMjdToUtc(59000, "GPS");
        expect(AST.convertMJD).toHaveBeenCalledWith(59000 + 19 / SECONDS_PER_DAY, "TAI", "UTC");
    });

    test("returns NaN for invalid inputs", () => {
        expect(convertMjdToUtc(NaN, "UTC")).toBeNaN();
        expect(convertMjdToUtc(59000, "FOO")).toBeNaN();
    });
});

describe("formatMjdUtcAsIso", () => {
    test("formats an MJD in UTC via AST", () => {
        (AST.formatMJDToDate as jest.Mock).mockReturnValue("2020-05-31T00:00:00.000");
        expect(formatMjdUtcAsIso(59000)).toBe("2020-05-31T00:00:00.000");
        expect(AST.formatMJDToDate).toHaveBeenCalledWith(59000, "UTC", 3);
    });

    test("returns an empty string for invalid MJD values", () => {
        expect(formatMjdUtcAsIso(NaN)).toBe("");
    });
});

describe("formatIsoUtcTickLabels", () => {
    test("uses time only for timestamps on the same UTC date", () => {
        expect(formatIsoUtcTickLabels(["2019-06-06T14:06:00.000", "2019-06-06T15:30:00.000"])).toEqual(["14:06", "15:30"]);
    });

    test("adds seconds when timestamps share a minute", () => {
        expect(formatIsoUtcTickLabels(["2019-06-06T14:06:01.000", "2019-06-06T14:06:37.000"])).toEqual(["14:06:01", "14:06:37"]);
    });

    test("uses month and day for distinct dates in the same year", () => {
        expect(formatIsoUtcTickLabels(["2019-06-06T14:06:00.000", "2019-07-08T14:06:00.000"])).toEqual(["06-06", "07-08"]);
    });

    test("adds time when multiple timestamps share a date", () => {
        expect(formatIsoUtcTickLabels(["2019-06-06T14:06:00.000", "2019-06-06T15:30:00.000", "2019-07-08T14:06:00.000"])).toEqual(["06-06 14:06", "06-06 15:30", "07-08 14:06"]);
    });

    test("includes the year when the series spans multiple years", () => {
        expect(formatIsoUtcTickLabels(["2019-06-06T14:06:00.000", "2020-06-06T14:06:00.000"])).toEqual(["2019-06-06", "2020-06-06"]);
    });

    test("preserves values that are not full ISO date-time strings", () => {
        expect(formatIsoUtcTickLabels(["2019-06-06", "unknown"])).toEqual(["2019-06-06", "unknown"]);
    });
});

describe("formatTimeSeriesTickLabels", () => {
    const values = [
        {mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00.000"},
        {mjdUtc: 59000.25, isoUtc: "2020-05-31T06:00:00.000"}
    ];

    test("preserves the existing compact UTC labels in automatic mode", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.AUTO,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["00:00", "06:00"]);
    });

    test("automatically uses hours when they distinguish all observations", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T00Z", "2020-05-31T06Z"]);
    });

    test.each([
        [IsoTimePrecision.YEAR, "2020"],
        [IsoTimePrecision.MONTH, "2020-05"],
        [IsoTimePrecision.DAY, "2020-05-31"],
        [IsoTimePrecision.HOUR, "2020-05-31T00Z"]
    ])("formats ISO labels with %s precision", (precision, expected) => {
        expect(
            formatTimeSeriesTickLabels([values[0]], {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.UTC,
                isoTimePrecision: precision,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual([expected]);
    });

    test("starts automatic precision at days for observations in different years", () => {
        expect(
            formatTimeSeriesTickLabels(
                [
                    {mjdUtc: 58640, isoUtc: "2019-06-06T14:06:00.000000"},
                    {mjdUtc: 59006, isoUtc: "2020-06-06T14:06:00.000000"}
                ],
                {
                    timeLabelFormat: TimeLabelFormat.ISO,
                    timeZoneMode: TimeZoneMode.UTC,
                    isoTimePrecision: IsoTimePrecision.AUTO,
                    relativeTimeUnit: RelativeTimeUnit.AUTO
                }
            )
        ).toEqual(["2019-06-06", "2020-06-06"]);
    });

    test("formats ISO labels with microsecond precision", () => {
        const preciseValues = [
            {mjdUtc: 59000.00000142889, isoUtc: "2020-05-31T00:00:00.123456"},
            {mjdUtc: 59000.25000912616, isoUtc: "2020-05-31T06:00:00.788500"}
        ];
        expect(
            formatTimeSeriesTickLabels(preciseValues, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.UTC,
                isoTimePrecision: IsoTimePrecision.MICROSECOND,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T00:00:00.123456Z", "2020-05-31T06:00:00.788500Z"]);
    });

    test("preserves microseconds in custom IANA time zones", () => {
        expect(
            formatTimeSeriesTickLabels([{mjdUtc: 59000.00000142889, isoUtc: "2020-05-31T00:00:00.123456"}], {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.IANA,
                ianaTimeZone: "Asia/Taipei",
                isoTimePrecision: IsoTimePrecision.MICROSECOND,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T08:00:00.123456+08:00"]);
    });

    test("automatically uses microseconds for sub-millisecond spacing", () => {
        const preciseValues = [
            {mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00.000100"},
            {mjdUtc: 59000 + 0.0005 / SECONDS_PER_DAY, isoUtc: "2020-05-31T00:00:00.000600"}
        ];
        expect(
            formatTimeSeriesTickLabels(preciseValues, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.UTC,
                isoTimePrecision: IsoTimePrecision.AUTO,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T00:00:00.000100Z", "2020-05-31T00:00:00.000600Z"]);
    });

    test("does not increase automatic precision for insignificant timestamp tails", () => {
        const preciseValues = [
            {mjdUtc: 59000.00000142889, isoUtc: "2020-05-31T00:00:00.123456"},
            {mjdUtc: 59000.25000912616, isoUtc: "2020-05-31T06:00:00.788500"}
        ];
        expect(
            formatTimeSeriesTickLabels(preciseValues, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.UTC,
                isoTimePrecision: IsoTimePrecision.AUTO,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T00Z", "2020-05-31T06Z"]);
    });

    test("formats ISO labels in browser local time with an explicit offset", () => {
        const labels = formatTimeSeriesTickLabels(values, {
            timeLabelFormat: TimeLabelFormat.ISO,
            timeZoneMode: TimeZoneMode.LOCAL,
            relativeTimeUnit: RelativeTimeUnit.AUTO
        });
        expect(labels).toHaveLength(2);
        labels.forEach(label => expect(label).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}[+-]\d{2}:\d{2}$/));
    });

    test("formats ISO labels in a custom IANA time zone", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.IANA,
                ianaTimeZone: "Asia/Taipei",
                isoTimePrecision: IsoTimePrecision.SECOND,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T08:00:00+08:00", "2020-05-31T14:00:00+08:00"]);
    });

    test("validates IANA time zone identifiers", () => {
        expect(isValidIanaTimeZone("Asia/Taipei")).toBe(true);
        expect(isValidIanaTimeZone("Not/A_Zone")).toBe(false);
        expect(isValidIanaTimeZone(" ")).toBe(false);
    });

    test("falls back to UTC when a custom IANA time zone is invalid", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.IANA,
                ianaTimeZone: "Not/A_Zone",
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["2020-05-31T00Z", "2020-05-31T06Z"]);
    });

    test("formats MJD and JD with automatically selected precision", () => {
        const baseSettings = {timeZoneMode: TimeZoneMode.UTC, relativeTimeUnit: RelativeTimeUnit.AUTO};
        expect(formatTimeSeriesTickLabels(values, {...baseSettings, timeLabelFormat: TimeLabelFormat.MJD})).toEqual(["59000.00", "59000.25"]);
        expect(formatTimeSeriesTickLabels(values, {...baseSettings, timeLabelFormat: TimeLabelFormat.JD})).toEqual(["2459000.50", "2459000.75"]);
    });

    test("converts MJD and JD labels to the selected astronomical time scale", () => {
        (AST.convertMJD as jest.Mock).mockImplementation(mjd => mjd + 0.0004);
        const labels = formatTimeSeriesTickLabels(values, {
            timeLabelFormat: TimeLabelFormat.MJD,
            timeZoneMode: TimeZoneMode.UTC,
            timeScale: TimeScale.TT,
            numericTimePrecision: 4,
            relativeTimeUnit: RelativeTimeUnit.AUTO
        });

        expect(labels).toEqual(["59000.0004", "59000.2504"]);
        expect(AST.convertMJD).toHaveBeenCalledWith(59000, "UTC", "TT");
    });

    test("converts labels to the TCG time scale", () => {
        (AST.convertMJD as jest.Mock).mockImplementation(mjd => mjd);

        formatTimeSeriesTickLabels(values, {
            timeLabelFormat: TimeLabelFormat.MJD,
            timeZoneMode: TimeZoneMode.UTC,
            timeScale: TimeScale.TCG,
            relativeTimeUnit: RelativeTimeUnit.AUTO
        });

        expect(AST.convertMJD).toHaveBeenCalledWith(59000, TimeScale.UTC, TimeScale.TCG);
        expect(AST.convertMJD).toHaveBeenCalledWith(59000.25, TimeScale.UTC, TimeScale.TCG);
    });

    test("uses the first observation and a stable common unit for relative labels", () => {
        const relativeValues = [
            {mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00.000"},
            {mjdUtc: 59010, isoUtc: "2020-06-10T00:00:00.000"},
            {mjdUtc: 59050, isoUtc: "2020-07-20T00:00:00.000"}
        ];
        expect(
            formatTimeSeriesTickLabels(relativeValues, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["0 d", "+10 d", "+50 d"]);
    });

    test("honours an explicitly selected relative unit", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeUnit: RelativeTimeUnit.HOUR
            })
        ).toEqual(["0 h", "+6 h"]);
    });

    test("calculates relative intervals in the selected astronomical time scale", () => {
        (AST.convertMJD as jest.Mock).mockImplementation(mjd => (mjd === 59000.25 ? 59000.2501 : mjd));

        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                timeScale: TimeScale.TCG,
                relativeTimeUnit: RelativeTimeUnit.DAY,
                numericTimePrecision: 4
            })
        ).toEqual(["0.0000 d", "+0.2501 d"]);
        expect(AST.convertMJD).toHaveBeenCalledWith(59000, "UTC", TimeScale.TCG);
        expect(AST.convertMJD).toHaveBeenCalledWith(59000.25, "UTC", TimeScale.TCG);
    });

    test("supports Julian years as an explicitly selected relative unit", () => {
        const yearlyValues = [
            {mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00.000"},
            {mjdUtc: 59365.25, isoUtc: "2021-05-31T06:00:00.000"}
        ];
        expect(
            formatTimeSeriesTickLabels(yearlyValues, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeUnit: RelativeTimeUnit.YEAR
            })
        ).toEqual(["0 yr", "+1 yr"]);
    });

    test("automatically uses Julian years for multi-year spans", () => {
        const yearlyValues = [
            {mjdUtc: 59000, isoUtc: "2020-05-31T00:00:00.000"},
            {mjdUtc: 59730.5, isoUtc: "2022-05-31T12:00:00.000"}
        ];
        expect(
            formatTimeSeriesTickLabels(yearlyValues, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual(["0 yr", "+2 yr"]);
    });

    test("supports a custom relative reference epoch and precision", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeReference: RelativeTimeReference.CUSTOM,
                relativeReferenceMjdUtc: 58999,
                relativeTimeUnit: RelativeTimeUnit.DAY,
                numericTimePrecision: 1
            })
        ).toEqual(["+1.0 d", "+1.3 d"]);
    });

    test("uses the selected time-series image as the relative reference", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeReference: RelativeTimeReference.IMAGE,
                relativeReferenceMjdUtc: values[1].mjdUtc,
                relativeTimeUnit: RelativeTimeUnit.HOUR
            })
        ).toEqual(["-6 h", "0 h"]);
    });

    test("falls back to the first observation when the selected reference image is not in the time series", () => {
        expect(
            formatTimeSeriesTickLabels(values, {
                timeLabelFormat: TimeLabelFormat.RELATIVE,
                timeZoneMode: TimeZoneMode.UTC,
                relativeTimeReference: RelativeTimeReference.IMAGE,
                relativeReferenceMjdUtc: 58000,
                relativeTimeUnit: RelativeTimeUnit.HOUR
            })
        ).toEqual(["0 h", "+6 h"]);
    });

    test("reports label collisions caused by manually limited precision", () => {
        const closeValues = [
            {mjdUtc: 59000.001, isoUtc: "2020-05-31T00:01:26.400"},
            {mjdUtc: 59000.002, isoUtc: "2020-05-31T00:02:52.800"}
        ];
        expect(
            getTimeSeriesTickLabelResult(closeValues, {
                timeLabelFormat: TimeLabelFormat.MJD,
                timeZoneMode: TimeZoneMode.UTC,
                timeScale: TimeScale.UTC,
                numericTimePrecision: 0,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual({labels: ["59000", "59000"], hasCollisions: true});
    });

    test("reports ISO label collisions caused by manually limited precision", () => {
        const closeValues = [
            {mjdUtc: 59000, isoUtc: "2020-05-31T00:00:01.000"},
            {mjdUtc: 59000.0001, isoUtc: "2020-05-31T00:00:09.640"}
        ];
        expect(
            getTimeSeriesTickLabelResult(closeValues, {
                timeLabelFormat: TimeLabelFormat.ISO,
                timeZoneMode: TimeZoneMode.UTC,
                isoTimePrecision: IsoTimePrecision.MINUTE,
                relativeTimeUnit: RelativeTimeUnit.AUTO
            })
        ).toEqual({labels: ["2020-05-31T00:00Z", "2020-05-31T00:00Z"], hasCollisions: true});
    });
});

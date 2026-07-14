import * as AST from "ast_wrapper";

import {convertMjdToUtc, formatIsoUtcTickLabels, formatMjdUtcAsIso, mapTimeSysToAstScale, normalizeDateObsString, parseObsDateToMjdUtc} from "./time";

const SECONDS_PER_DAY = 86400;

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

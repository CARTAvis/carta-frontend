import * as AST from "ast_wrapper";

interface AstTimeScale {
    scale: string;
    // Additive offset (in days) applied to the raw value before interpreting it in `scale`,
    // for time scales AST lacks (e.g. GPS, handled as TAI = GPS + 19 s)
    offsetDays: number;
}

const SECONDS_PER_DAY = 86400;

/**
 * Maps a FITS TIMESYS header value to an AST TimeScale attribute value.
 * Defaults to UTC when the header is absent. Returns null for unrecognized
 * time scales, in which case the observation time should be considered invalid.
 */
export function mapTimeSysToAstScale(timesys: string | undefined): AstTimeScale | null {
    switch ((timesys ?? "UTC").trim().toUpperCase()) {
        case "":
        case "UTC":
        // GMT is a deprecated FITS synonym for UTC
        case "GMT":
            return {scale: "UTC", offsetDays: 0};
        case "TAI":
        case "IAT":
            return {scale: "TAI", offsetDays: 0};
        case "TT":
        case "TDT":
        case "ET":
            return {scale: "TT", offsetDays: 0};
        case "TDB":
            return {scale: "TDB", offsetDays: 0};
        case "TCB":
            return {scale: "TCB", offsetDays: 0};
        case "TCG":
            return {scale: "TCG", offsetDays: 0};
        // DUT1 (< 0.9 s) is unknown from headers alone; treating UT/UT1 exactly is
        // beyond the accuracy needed for sorting and labelling epochs
        case "UT":
        case "UT1":
            return {scale: "UT1", offsetDays: 0};
        // AST has no GPS time scale; TAI = GPS + 19 s exactly
        case "GPS":
            return {scale: "TAI", offsetDays: 19 / SECONDS_PER_DAY};
        default:
            return null;
    }
}

/**
 * Normalizes a FITS DATE-OBS string to the ISO-8601 form understood by AST.
 * Handles the legacy 'DD/MM/YY' format (which by FITS convention refers to
 * years 1900-1999); other strings are returned trimmed and unmodified.
 */
export function normalizeDateObsString(dateObs: string): string {
    const trimmed = dateObs?.trim() ?? "";
    const legacyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{2})$/);
    if (legacyMatch) {
        return `19${legacyMatch[3]}-${legacyMatch[2]}-${legacyMatch[1]}`;
    }
    return trimmed;
}

/**
 * Parses a FITS DATE-OBS string expressed in the given TIMESYS scale and
 * returns the corresponding MJD in UTC. Returns NaN when the date string or
 * time scale cannot be interpreted.
 */
export function parseObsDateToMjdUtc(dateObs: string, timesys?: string): number {
    const timeScale = mapTimeSysToAstScale(timesys);
    if (!timeScale) {
        return NaN;
    }
    const mjd = AST.parseDateToMJD(normalizeDateObsString(dateObs), timeScale.scale);
    if (!isFinite(mjd)) {
        return NaN;
    }
    return AST.convertMJD(mjd + timeScale.offsetDays, timeScale.scale, "UTC");
}

/** Converts an MJD expressed in the given TIMESYS scale to MJD in UTC. */
export function convertMjdToUtc(mjd: number, timesys?: string): number {
    if (!isFinite(mjd)) {
        return NaN;
    }
    const timeScale = mapTimeSysToAstScale(timesys);
    if (!timeScale) {
        return NaN;
    }
    return AST.convertMJD(mjd + timeScale.offsetDays, timeScale.scale, "UTC");
}

/** Formats an MJD in UTC as an ISO-8601 date-time string. */
export function formatMjdUtcAsIso(mjd: number, digits: number = 3): string {
    if (!isFinite(mjd)) {
        return "";
    }
    return AST.formatMJDToDate(mjd, "UTC", digits) ?? "";
}

interface IsoUtcParts {
    year: string;
    date: string;
    monthDay: string;
    minute: string;
    second: string;
    fullTime: string;
}

function parseIsoUtcParts(isoUtc: string): IsoUtcParts | null {
    const match = isoUtc.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?Z?$/);
    if (!match) {
        return null;
    }

    const [, year, month, day, hour, minute, second, fraction] = match;
    return {
        year,
        date: `${year}-${month}-${day}`,
        monthDay: `${month}-${day}`,
        minute: `${hour}:${minute}`,
        second: `${hour}:${minute}:${second}`,
        fullTime: `${hour}:${minute}:${second}${fraction ? `.${fraction}` : ""}`
    };
}

function areUnique(values: string[]): boolean {
    return new Set(values).size === values.length;
}

/**
 * Formats ISO UTC timestamps as compact, unambiguous time-series slider labels.
 * The labels add date, year, seconds, or fractional seconds only when needed to
 * distinguish the supplied timestamps.
 */
export function formatIsoUtcTickLabels(isoUtcValues: string[]): string[] {
    const parts = isoUtcValues.map(parseIsoUtcParts);
    if (parts.some(value => value === null)) {
        return isoUtcValues;
    }

    const validParts = parts as IsoUtcParts[];
    const dates = validParts.map(value => value.date);
    const isSameDate = new Set(dates).size === 1;

    if (isSameDate) {
        const minutes = validParts.map(value => value.minute);
        if (areUnique(minutes)) {
            return minutes;
        }
        const seconds = validParts.map(value => value.second);
        return areUnique(seconds) ? seconds : validParts.map(value => value.fullTime);
    }

    const isSameYear = new Set(validParts.map(value => value.year)).size === 1;
    const compactDates = validParts.map(value => (isSameYear ? value.monthDay : value.date));
    if (areUnique(compactDates)) {
        return compactDates;
    }

    const minuteDateTimes = validParts.map((value, index) => `${compactDates[index]} ${value.minute}`);
    if (areUnique(minuteDateTimes)) {
        return minuteDateTimes;
    }

    const secondDateTimes = validParts.map((value, index) => `${compactDates[index]} ${value.second}`);
    return areUnique(secondDateTimes) ? secondDateTimes : validParts.map((value, index) => `${compactDates[index]} ${value.fullTime}`);
}

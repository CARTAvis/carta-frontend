import * as AST from "ast_wrapper";

import {IsoTimePrecision, RelativeTimeReference, RelativeTimeUnit, TimeLabelFormat, TimeScale, TimeZoneMode} from "enums";

interface AstTimeScale {
    scale: string;
    // Additive offset (in days) applied to the raw value before interpreting it in `scale`,
    // for time scales AST lacks (e.g. GPS, handled as TAI = GPS + 19 s)
    offsetDays: number;
}

const SECONDS_PER_DAY = 86400;
const DAYS_PER_JULIAN_YEAR = 365.25;
const JD_MJD_OFFSET = 2400000.5;

export interface TimeLabelValue {
    mjdUtc: number;
    isoUtc: string;
}

export interface TimeLabelSettings {
    timeLabelFormat: TimeLabelFormat;
    timeZoneMode: TimeZoneMode;
    ianaTimeZone?: string | null;
    timeScale?: TimeScale;
    isoTimePrecision?: IsoTimePrecision;
    numericTimePrecision?: number | null;
    relativeTimeReference?: RelativeTimeReference;
    relativeReferenceMjdUtc?: number | null;
    relativeTimeUnit: RelativeTimeUnit;
}

export interface TimeLabelResult {
    labels: string[];
    hasCollisions: boolean;
}

/**
 * Maps a FITS TIMESYS header value to an AST TimeScale attribute value.
 * Defaults to UTC when the header is absent. Returns null for unrecognized
 * time scales, in which case the observation time should be considered invalid.
 */
export function mapTimeSysToAstScale(timesys: string | undefined): AstTimeScale | null {
    switch ((timesys ?? "UTC").trim().toUpperCase()) {
        case "":
        case "UTC":
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

/** Parses a complete ISO-8601 UTC date-time and returns the corresponding MJD in UTC. */
export function parseIsoUtcToMjdUtc(isoUtc: string): number {
    return parseIsoInScaleToMjdUtc(isoUtc, TimeScale.UTC);
}

/** Parses a complete ISO-8601 date-time in the selected scale and returns the corresponding MJD in UTC. */
export function parseIsoInScaleToMjdUtc(iso: string, scale: TimeScale): number {
    const trimmed = iso?.trim() ?? "";
    if (scale !== TimeScale.UTC && /Z$/i.test(trimmed)) {
        return NaN;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(trimmed)) {
        return NaN;
    }
    return parseObsDateToMjdUtc(trimmed.replace(/Z$/i, ""), scale);
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
    return formatMjdUtcAsIsoInScale(mjd, TimeScale.UTC, digits);
}

/** Formats a canonical MJD UTC value as an ISO-8601 date-time in the selected scale. */
export function formatMjdUtcAsIsoInScale(mjdUtc: number, scale: TimeScale, digits: number = 3): string {
    if (!isFinite(mjdUtc)) {
        return "";
    }
    const scaledMjd = convertMjdUtcToScale(mjdUtc, scale);
    return AST.formatMJDToDate(scaledMjd, scale, digits) ?? "";
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

function areUnique(values: readonly string[]): boolean {
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

function getMinimumPositiveDifference(values: readonly number[]): number | undefined {
    const sorted = [...values].filter(isFinite).sort((a, b) => a - b);
    let minimum: number | undefined;
    for (let i = 1; i < sorted.length; i++) {
        const difference = sorted[i] - sorted[i - 1];
        if (difference > 0 && (minimum === undefined || difference < minimum)) {
            minimum = difference;
        }
    }
    return minimum;
}

function getAutoDecimalPlaces(values: readonly number[]): number {
    if (values.every(value => Math.abs(value - Math.round(value)) < 1e-9)) {
        return 0;
    }
    const minimumDifference = getMinimumPositiveDifference(values);
    if (minimumDifference === undefined) {
        return 0;
    }
    return Math.max(0, Math.min(9, Math.ceil(-Math.log10(minimumDifference)) + 1));
}

function parseIsoUtc(isoUtc: string): Date | null {
    const hasTimeZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoUtc);
    const date = new Date(hasTimeZone ? isoUtc : `${isoUtc}Z`);
    return isNaN(date.getTime()) ? null : date;
}

function pad(value: number, length: number = 2): string {
    return value.toString().padStart(length, "0");
}

export function isValidIanaTimeZone(timeZone: string | null | undefined): boolean {
    if (!timeZone?.trim()) {
        return false;
    }
    try {
        new Intl.DateTimeFormat("en-US", {timeZone}).format();
        return true;
    } catch {
        return false;
    }
}

function getIsoFractionDigits(isoUtc: string, digits: number): string {
    const fraction = isoUtc.match(/\.(\d+)/)?.[1] ?? "";
    return fraction.padEnd(digits, "0").slice(0, digits);
}

const AUTO_ISO_PRECISIONS = [IsoTimePrecision.DAY, IsoTimePrecision.HOUR, IsoTimePrecision.MINUTE, IsoTimePrecision.SECOND, IsoTimePrecision.MILLISECOND, IsoTimePrecision.MICROSECOND] as const;

function getAutoIsoPrecision(values: readonly TimeLabelValue[], timeZoneMode: TimeZoneMode, ianaTimeZone: string): IsoTimePrecision {
    const numericValues = values.map(value => value.mjdUtc);
    for (const precision of AUTO_ISO_PRECISIONS) {
        const labels = values.map(value => formatIsoLabel(value, timeZoneMode, ianaTimeZone, precision));
        if (!hasDistinctValueLabelCollisions(numericValues, labels)) {
            return precision;
        }
    }
    return IsoTimePrecision.MICROSECOND;
}

interface ZonedDateParts {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    offsetMinutes: number;
    useUtcSuffix: boolean;
}

function getZonedDateParts(date: Date, timeZoneMode: TimeZoneMode, ianaTimeZone: string): ZonedDateParts {
    if (timeZoneMode === TimeZoneMode.UTC) {
        return {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
            hour: date.getUTCHours(),
            minute: date.getUTCMinutes(),
            second: date.getUTCSeconds(),
            offsetMinutes: 0,
            useUtcSuffix: true
        };
    }

    if (timeZoneMode === TimeZoneMode.LOCAL) {
        return {
            year: date.getFullYear(),
            month: date.getMonth() + 1,
            day: date.getDate(),
            hour: date.getHours(),
            minute: date.getMinutes(),
            second: date.getSeconds(),
            offsetMinutes: -date.getTimezoneOffset(),
            useUtcSuffix: false
        };
    }

    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: ianaTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    });
    const partValues = new Map(formatter.formatToParts(date).map(part => [part.type, part.value]));
    const year = Number(partValues.get("year"));
    const month = Number(partValues.get("month"));
    const day = Number(partValues.get("day"));
    const hour = Number(partValues.get("hour"));
    const minute = Number(partValues.get("minute"));
    const second = Number(partValues.get("second"));
    const zonedTimestampAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const instantWithoutMilliseconds = date.getTime() - date.getUTCMilliseconds();

    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        offsetMinutes: Math.round((zonedTimestampAsUtc - instantWithoutMilliseconds) / 60000),
        useUtcSuffix: false
    };
}

function formatIsoLabel(value: TimeLabelValue, timeZoneMode: TimeZoneMode, ianaTimeZone: string, precision: IsoTimePrecision): string {
    const date = parseIsoUtc(value.isoUtc);
    if (!date) {
        return value.isoUtc;
    }

    const parts = getZonedDateParts(date, timeZoneMode, ianaTimeZone);
    const hasMonth = precision !== IsoTimePrecision.YEAR;
    const hasDay = hasMonth && precision !== IsoTimePrecision.MONTH;
    const hasHour = hasDay && precision !== IsoTimePrecision.DAY;
    const hasMinute = hasHour && precision !== IsoTimePrecision.HOUR;
    const hasSecond = precision === IsoTimePrecision.SECOND || precision === IsoTimePrecision.MILLISECOND || precision === IsoTimePrecision.MICROSECOND;

    let label = pad(parts.year, 4);
    if (hasMonth) {
        label += `-${pad(parts.month)}`;
    }
    if (hasDay) {
        label += `-${pad(parts.day)}`;
    }
    if (hasHour) {
        label += `T${pad(parts.hour)}`;
    }
    if (hasMinute) {
        label += `:${pad(parts.minute)}`;
    }
    if (hasSecond) {
        label += `:${pad(parts.second)}`;
    }
    if (precision === IsoTimePrecision.MICROSECOND) {
        label += `.${getIsoFractionDigits(value.isoUtc, 6)}`;
    } else if (precision === IsoTimePrecision.MILLISECOND) {
        label += `.${getIsoFractionDigits(value.isoUtc, 3)}`;
    }
    if (!hasHour) {
        return label;
    }
    if (parts.useUtcSuffix) {
        return `${label}Z`;
    }
    const offsetSign = parts.offsetMinutes >= 0 ? "+" : "-";
    const absoluteOffset = Math.abs(parts.offsetMinutes);
    return `${label}${offsetSign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
}

function hasDistinctValueLabelCollisions(values: readonly number[], labels: readonly string[]): boolean {
    const labelledValues = new Map<string, number>();
    return labels.some((label, index) => {
        const existingValue = labelledValues.get(label);
        if (existingValue !== undefined && existingValue !== values[index]) {
            return true;
        }
        labelledValues.set(label, values[index]);
        return false;
    });
}

function resolveNumericPrecision(values: readonly number[], configuredPrecision: number | null | undefined): number {
    if (configuredPrecision !== null && configuredPrecision !== undefined && Number.isInteger(configuredPrecision) && configuredPrecision >= 0 && configuredPrecision <= 9) {
        return configuredPrecision;
    }
    let precision = getAutoDecimalPlaces(values);
    while (
        precision < 9 &&
        hasDistinctValueLabelCollisions(
            values,
            values.map(value => value.toFixed(precision))
        )
    ) {
        precision++;
    }
    return precision;
}

export function convertMjdUtcToScale(mjdUtc: number, scale: TimeScale): number {
    if (scale === TimeScale.UTC) {
        return mjdUtc;
    }
    const converted = AST.convertMJD(mjdUtc, TimeScale.UTC, scale);
    return isFinite(converted) ? converted : mjdUtc;
}

function resolveRelativeTimeUnit(values: readonly number[], configuredUnit: RelativeTimeUnit): RelativeTimeUnit {
    if (configuredUnit !== RelativeTimeUnit.AUTO) {
        return configuredUnit;
    }
    const maximumSeconds = Math.max(...values.map(Math.abs)) * SECONDS_PER_DAY;
    if (maximumSeconds >= 2 * DAYS_PER_JULIAN_YEAR * SECONDS_PER_DAY) {
        return RelativeTimeUnit.YEAR;
    }
    if (maximumSeconds >= 2 * SECONDS_PER_DAY) {
        return RelativeTimeUnit.DAY;
    }
    if (maximumSeconds >= 2 * 3600) {
        return RelativeTimeUnit.HOUR;
    }
    if (maximumSeconds >= 2 * 60) {
        return RelativeTimeUnit.MINUTE;
    }
    return RelativeTimeUnit.SECOND;
}

function getRelativeUnitInfo(unit: RelativeTimeUnit): {seconds: number; suffix: string} {
    switch (unit) {
        case RelativeTimeUnit.YEAR:
            return {seconds: DAYS_PER_JULIAN_YEAR * SECONDS_PER_DAY, suffix: "yr"};
        case RelativeTimeUnit.DAY:
            return {seconds: SECONDS_PER_DAY, suffix: "d"};
        case RelativeTimeUnit.HOUR:
            return {seconds: 3600, suffix: "h"};
        case RelativeTimeUnit.MINUTE:
            return {seconds: 60, suffix: "min"};
        case RelativeTimeUnit.SECOND:
        case RelativeTimeUnit.AUTO:
        default:
            return {seconds: 1, suffix: "s"};
    }
}

function getIsoLabels(values: readonly TimeLabelValue[], settings: TimeLabelSettings): string[] {
    const ianaTimeZone = settings.ianaTimeZone ?? "UTC";
    const timeZoneMode = settings.timeZoneMode === TimeZoneMode.IANA && !isValidIanaTimeZone(ianaTimeZone) ? TimeZoneMode.UTC : settings.timeZoneMode;
    const configuredPrecision = settings.isoTimePrecision ?? IsoTimePrecision.AUTO;
    const precision = configuredPrecision === IsoTimePrecision.AUTO ? getAutoIsoPrecision(values, timeZoneMode, ianaTimeZone) : configuredPrecision;
    return values.map(value => formatIsoLabel(value, timeZoneMode, ianaTimeZone, precision));
}

function getJulianDateLabels(values: readonly TimeLabelValue[], settings: TimeLabelSettings): string[] {
    const offset = settings.timeLabelFormat === TimeLabelFormat.JD ? JD_MJD_OFFSET : 0;
    const scale = settings.timeScale ?? TimeScale.UTC;
    const numericValues = values.map(value => convertMjdUtcToScale(value.mjdUtc, scale) + offset);
    const decimalPlaces = resolveNumericPrecision(numericValues, settings.numericTimePrecision);
    return numericValues.map(value => value.toFixed(decimalPlaces));
}

function getRelativeReferenceMjd(values: readonly TimeLabelValue[], settings: TimeLabelSettings): number {
    const configuredReference = settings.relativeReferenceMjdUtc;
    if (typeof configuredReference !== "number" || !isFinite(configuredReference)) {
        return values[0].mjdUtc;
    }

    const isCustomReference = settings.relativeTimeReference === RelativeTimeReference.CUSTOM;
    const isExistingImage = settings.relativeTimeReference === RelativeTimeReference.IMAGE && values.some(value => value.mjdUtc === configuredReference);
    return isCustomReference || isExistingImage ? configuredReference : values[0].mjdUtc;
}

function getRelativeLabels(values: readonly TimeLabelValue[], settings: TimeLabelSettings): string[] {
    const scale = settings.timeScale ?? TimeScale.UTC;
    const referenceMjd = convertMjdUtcToScale(getRelativeReferenceMjd(values, settings), scale);
    const relativeDays = values.map(value => convertMjdUtcToScale(value.mjdUtc, scale) - referenceMjd);
    const {seconds, suffix} = getRelativeUnitInfo(resolveRelativeTimeUnit(relativeDays, settings.relativeTimeUnit));
    const relativeValues = relativeDays.map(value => (value * SECONDS_PER_DAY) / seconds);
    const decimalPlaces = resolveNumericPrecision(relativeValues, settings.numericTimePrecision);

    return relativeValues.map(value => {
        const roundedValue = Number(value.toFixed(decimalPlaces));
        const prefix = roundedValue > 0 ? "+" : "";
        return `${prefix}${roundedValue.toFixed(decimalPlaces)} ${suffix}`;
    });
}

/** Formats time-series slider labels and reports collisions without changing canonical MJD UTC values. */
export function getTimeSeriesTickLabelResult(values: readonly TimeLabelValue[], settings: TimeLabelSettings): TimeLabelResult {
    if (values.length === 0) {
        return {labels: [], hasCollisions: false};
    }

    const numericValues = values.map(value => value.mjdUtc);
    let labels: string[];
    switch (settings.timeLabelFormat) {
        case TimeLabelFormat.ISO:
            labels = getIsoLabels(values, settings);
            break;
        case TimeLabelFormat.MJD:
        case TimeLabelFormat.JD:
            labels = getJulianDateLabels(values, settings);
            break;
        case TimeLabelFormat.RELATIVE:
            labels = getRelativeLabels(values, settings);
            break;
        case TimeLabelFormat.AUTO:
        default:
            labels = formatIsoUtcTickLabels(values.map(value => value.isoUtc));
            break;
    }

    return {
        labels,
        hasCollisions: hasDistinctValueLabelCollisions(numericValues, labels)
    };
}

/** Formats time-series slider labels without changing their canonical MJD UTC values. */
export function formatTimeSeriesTickLabels(values: readonly TimeLabelValue[], settings: TimeLabelSettings): string[] {
    return getTimeSeriesTickLabelResult(values, settings).labels;
}

/** Returns a human-readable name for the configured time label format. */
export function getTimeLabelFormatName(settings: TimeLabelSettings): string {
    switch (settings.timeLabelFormat) {
        case TimeLabelFormat.ISO:
            if (settings.timeZoneMode === TimeZoneMode.LOCAL) {
                return "ISO 8601 (local)";
            }
            if (settings.timeZoneMode === TimeZoneMode.IANA) {
                return `ISO 8601 (${settings.ianaTimeZone ?? "UTC"})`;
            }
            return "ISO 8601 (UTC)";
        case TimeLabelFormat.MJD:
            return `MJD (${settings.timeScale ?? TimeScale.UTC})`;
        case TimeLabelFormat.JD:
            return `JD (${settings.timeScale ?? TimeScale.UTC})`;
        case TimeLabelFormat.RELATIVE: {
            const scale = settings.timeScale ?? TimeScale.UTC;
            if (settings.relativeTimeReference === RelativeTimeReference.IMAGE) {
                return `Relative to selected image (${scale})`;
            }
            if (settings.relativeTimeReference === RelativeTimeReference.CUSTOM) {
                return `Relative to custom epoch (${scale})`;
            }
            return `Relative to first observation (${scale})`;
        }
        case TimeLabelFormat.AUTO:
        default:
            return "Auto (UTC)";
    }
}

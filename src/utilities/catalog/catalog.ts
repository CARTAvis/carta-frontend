import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType, NumberFormatType} from "enums";

import {CATALOG_ARCMIN_UNITS, CATALOG_ARCSEC_UNITS, CATALOG_DEGREE_UNITS} from "./constants";

type AxisMatchCandidate = {
    columnName: string;
    matchPriority: number;
    optionIndex: number;
    patternIndex: number;
};

enum AxisMatchPriority {
    Exact = 0,
    Compatible = 1,
    Generic = 2
}

const INCOMPATIBLE_AXIS_PRIORITY = Number.MAX_SAFE_INTEGER;
const CATALOG_AXIS_DATA_TYPES: CARTA.ColumnType[] = [
    CARTA.ColumnType.Double,
    CARTA.ColumnType.Float,
    CARTA.ColumnType.Int8,
    CARTA.ColumnType.Uint8,
    CARTA.ColumnType.Int16,
    CARTA.ColumnType.Uint16,
    CARTA.ColumnType.Int32,
    CARTA.ColumnType.Uint32,
    CARTA.ColumnType.Int64,
    CARTA.ColumnType.Uint64
];
const COORDINATE_COLUMN_EXCLUSION_PATTERNS = [/^e_/i, /(?:^|_)pm(?=$|_|[a-z])/i, /(?:^|_)(?:propermotion|err(?:or)?|sigma|sig|unc(?:ertainty)?|offset|resid(?:ual)?)(?:_|$)/i];
const RIGHT_ASCENSION_PATTERNS = [
    /^_?ra[._]?icrs\b/i,
    /^_?raj20\d{2}\b/i,
    /^_?rab19\d{2}\b/i,
    /^coord_ra\b/i,
    /^target_ra\b/i,
    /^alpha_?j20\d{2}\b/i,
    /^alpha_?b19\d{2}\b/i,
    /^alpha_?sky\b/i,
    /^ra(?:\b|[0-9])/i,
    /^ra(?:mean|stack)\b/i,
    /^ra_?deg\b/i,
    /^ra_/i,
    /^r\.?a\.?(?:$|[_\s-])/i,
    /^right[ _-]?asc(?:ension)?\b/i,
    /^alpha\b/i,
    /^_?raj(?:\b|[0-9])/i
];
const DECLINATION_PATTERNS = [
    /^_?(?:de|dec)[._]?icrs\b/i,
    /^_?dej20\d{2}\b/i,
    /^_?deb19\d{2}\b/i,
    /^coord_dec\b/i,
    /^target_dec\b/i,
    /^delta_?j20\d{2}\b/i,
    /^delta_?b19\d{2}\b/i,
    /^delta_?sky\b/i,
    /^dec(?:\b|[0-9])/i,
    /^dec(?:mean|stack)\b/i,
    /^(?:de|dec)_?deg\b/i,
    /^dec_/i,
    /^decl(?:ination)?\b/i,
    /^delta\b/i,
    /^_?dej(?:\b|[0-9])/i
];
const GALACTIC_LONGITUDE_PATTERNS = [/^glon(?:\b|[0-9])/i, /^glon_?deg$/i, /^gal(?:actic)?_?lon(?:gitude)?(?:_?deg)?$/i, /^lon_?gal(?:actic)?$/i, /^gal_?l$/i, /^l$/i];
const GALACTIC_LATITUDE_PATTERNS = [/^glat(?:\b|[0-9])/i, /^glat_?deg$/i, /^gal(?:actic)?_?lat(?:itude)?(?:_?deg)?$/i, /^lat_?gal(?:actic)?$/i, /^gal_?b$/i, /^b$/i];
const ECLIPTIC_LONGITUDE_PATTERNS = [/^elon(?:\b|[0-9])/i, /^elon_?deg$/i, /^ecl(?:iptic)?_?lon(?:gitude)?(?:_?deg)?$/i, /^lon_?ecl(?:iptic)?$/i, /^lambda(?:_?(?:deg|j2000))?$/i];
const ECLIPTIC_LATITUDE_PATTERNS = [/^elat(?:\b|[0-9])/i, /^elat_?deg$/i, /^ecl(?:iptic)?_?lat(?:itude)?(?:_?deg)?$/i, /^lat_?ecl(?:iptic)?$/i, /^beta(?:_?(?:deg|j2000))?$/i];
const PIXEL0_X_PATTERNS = [/^x$/i, /^xcentroid$/i, /^xcentroid_win$/i, /^xcpeak$/i, /^xpeak$/i];
const PIXEL0_Y_PATTERNS = [/^y$/i, /^ycentroid$/i, /^ycentroid_win$/i, /^ycpeak$/i, /^ypeak$/i];
const PIXEL1_X_PATTERNS = [/^x_?image$/i, /^xwin_?image$/i];
const PIXEL1_Y_PATTERNS = [/^y_?image$/i, /^ywin_?image$/i];
const AXIS_AUTO_SELECT_PATTERNS = new Map<CatalogOverlay, RegExp[]>([
    [CatalogOverlay.RA, RIGHT_ASCENSION_PATTERNS],
    [CatalogOverlay.DEC, DECLINATION_PATTERNS],
    [CatalogOverlay.GLON, GALACTIC_LONGITUDE_PATTERNS],
    [CatalogOverlay.GLAT, GALACTIC_LATITUDE_PATTERNS],
    [CatalogOverlay.ELON, ECLIPTIC_LONGITUDE_PATTERNS],
    [CatalogOverlay.ELAT, ECLIPTIC_LATITUDE_PATTERNS],
    [CatalogOverlay.X0, PIXEL0_X_PATTERNS],
    [CatalogOverlay.Y0, PIXEL0_Y_PATTERNS],
    [CatalogOverlay.X1, PIXEL1_X_PATTERNS],
    [CatalogOverlay.Y1, PIXEL1_Y_PATTERNS]
]);
const SKY_COORDINATE_AXES = new Set<CatalogOverlay>([CatalogOverlay.RA, CatalogOverlay.DEC, CatalogOverlay.GLON, CatalogOverlay.GLAT, CatalogOverlay.ELON, CatalogOverlay.ELAT]);
const PIXEL_COORDINATE_AXES = new Set<CatalogOverlay>([CatalogOverlay.X0, CatalogOverlay.Y0, CatalogOverlay.X1, CatalogOverlay.Y1]);
const EXPLICIT_ICRS_PATTERN = /(?:^|[_.])icrs(?:$|[_.])/i;
const EXPLICIT_FK5_PATTERN = /20\d{2}/;
const EXPLICIT_FK5_J2000_PATTERN = /(?:^|\D)2000(?!\d)/;
const EXPLICIT_FK4_PATTERN = /19\d{2}/;

export const CATALOG_NUMERIC_FORMAT = "numeric" as const;
export type CatalogCoordinateFormat = NumberFormatType.HMS | NumberFormatType.DMS | NumberFormatType.Degrees | typeof CATALOG_NUMERIC_FORMAT;
export function isCatalogAxisDataType(dataType: CARTA.ColumnType | null | undefined): boolean {
    return dataType != null && CATALOG_AXIS_DATA_TYPES.includes(dataType);
}

export function getCatalogCoordinateFormat(dataType: CARTA.ColumnType | null | undefined, units: string | null | undefined, columnName?: string): CatalogCoordinateFormat | undefined {
    if (dataType !== CARTA.ColumnType.String) {
        return undefined;
    }

    const normalizedUnits = normalizeCatalogUnits(units);
    if (!normalizedUnits) {
        return getNameInferredCoordinateFormat(columnName);
    }

    if (CATALOG_DEGREE_UNITS.includes(normalizedUnits)) {
        return NumberFormatType.Degrees;
    }

    const sexagesimalFormat = getSexagesimalUnitFormat(normalizedUnits);
    if (!sexagesimalFormat) {
        return undefined;
    }

    const axis = getCatalogCoordinateAxis(columnName);
    if (sexagesimalFormat === NumberFormatType.HMS && axis !== undefined && axis !== CatalogOverlay.RA) {
        return undefined;
    }
    if (sexagesimalFormat === NumberFormatType.DMS && axis === CatalogOverlay.RA) {
        return undefined;
    }
    return sexagesimalFormat;
}

export function isCatalogCoordinateDataType(dataType: CARTA.ColumnType | null | undefined, units: string | null | undefined, axis: CatalogOverlay, columnName?: string): boolean {
    if (isCatalogAxisDataType(dataType)) {
        const namedAxis = getCatalogCoordinateAxis(columnName);
        if (namedAxis !== undefined) {
            return namedAxis === axis && (!PIXEL_COORDINATE_AXES.has(axis) || !isAngularCatalogUnit(units));
        }
        return !PIXEL_COORDINATE_AXES.has(axis) || !isAngularCatalogUnit(units);
    }

    const format = getCatalogCoordinateFormat(dataType, units, columnName);
    if (format === undefined) {
        return false;
    }

    const namedAxis = getCatalogCoordinateAxis(columnName);
    if (namedAxis !== undefined && namedAxis !== axis) {
        return false;
    }
    return isCatalogCoordinateFormatCompatible(axis, format) && (Boolean(normalizeCatalogUnits(units)) || namedAxis === axis);
}

export function parseCatalogCoordinateValue(value: string | number | null | undefined, format: CatalogCoordinateFormat, units?: string | null): number {
    if (value === null || value === undefined || value === "") {
        return NaN;
    }

    const text = String(value).replace(/\0/g, "").trim();
    if (!text) {
        return NaN;
    }
    if (format === CATALOG_NUMERIC_FORMAT || format === NumberFormatType.Degrees) {
        return Number(text);
    }

    const components = text
        .replace(/[hmsd]/gi, ":")
        .split(/[:\s]+/)
        .filter(Boolean)
        .map(Number);
    if (!components.length || components.length > 3 || components.some(component => !isFinite(component))) {
        return NaN;
    }

    const firstComponent = components[0];
    const sign = /^\s*-/.test(text) ? -1 : 1;
    const absoluteFirstComponent = Math.abs(firstComponent);
    const minutes = Math.abs(components[1] ?? 0);
    const seconds = Math.abs(components[2] ?? 0);
    if (minutes >= 60 || seconds >= 60) {
        return NaN;
    }

    // A lone component carries no sexagesimal notation, so it is only read as hours when the column
    // declares hms units. Where the hms format was inferred from the column name instead, a bare
    // decimal is far more likely to be degrees, and scaling it by 15 would silently misplace sources.
    // An explicit degree marker also prevents hour scaling in sexagesimal values.
    const isSexagesimalNotation = components.length > 1 || /h/i.test(text);
    const isHourValue = format === NumberFormatType.HMS && !/d/i.test(text) && (Boolean(normalizeCatalogUnits(units)) || isSexagesimalNotation);
    const valueInUnits = absoluteFirstComponent + minutes / 60 + seconds / 3600;
    return sign * (isHourValue ? valueInUnits * 15 : valueInUnits);
}

function getCatalogCoordinateAxis(columnName: string | undefined): CatalogOverlay | undefined {
    if (!columnName || isExcludedCoordinateName(columnName)) {
        return undefined;
    }

    for (const [axis, patterns] of AXIS_AUTO_SELECT_PATTERNS) {
        if (patterns.some(pattern => pattern.test(columnName))) {
            return axis;
        }
    }

    return undefined;
}

function getNameInferredCoordinateFormat(columnName: string | undefined): CatalogCoordinateFormat | undefined {
    const axis = getCatalogCoordinateAxis(columnName);
    if (axis === CatalogOverlay.RA) {
        return NumberFormatType.HMS;
    }
    if (axis && SKY_COORDINATE_AXES.has(axis)) {
        return NumberFormatType.DMS;
    }
    if (axis && PIXEL_COORDINATE_AXES.has(axis)) {
        return CATALOG_NUMERIC_FORMAT;
    }
    return undefined;
}

function isCatalogCoordinateFormatCompatible(axis: CatalogOverlay, format: CatalogCoordinateFormat): boolean {
    if (PIXEL_COORDINATE_AXES.has(axis)) {
        return format === CATALOG_NUMERIC_FORMAT;
    }
    if (!SKY_COORDINATE_AXES.has(axis)) {
        return false;
    }
    if (axis === CatalogOverlay.RA) {
        return format === NumberFormatType.HMS || format === NumberFormatType.Degrees;
    }
    return format === NumberFormatType.DMS || format === NumberFormatType.Degrees;
}

function isAngularCatalogUnit(units: string | null | undefined): boolean {
    const normalizedUnits = normalizeCatalogUnits(units);
    if (!normalizedUnits) {
        return false;
    }
    return CATALOG_DEGREE_UNITS.includes(normalizedUnits) || CATALOG_ARCMIN_UNITS.includes(normalizedUnits) || CATALOG_ARCSEC_UNITS.includes(normalizedUnits) || getSexagesimalUnitFormat(normalizedUnits) !== undefined;
}

function getSexagesimalUnitFormat(normalizedUnits: string): NumberFormatType.HMS | NumberFormatType.DMS | undefined {
    // Sexagesimal units are spelled many ways, and dropping the separators leaves repeated letters
    // behind: "h:m:s" gives "hms", "hh:mm:ss" gives "hhmmss", "dd:mm:ss.ss" gives "ddmmssss".
    // Collapsing runs of the same letter reduces all of those to "hms" or "dms".
    const collapsedUnits = normalizedUnits.replace(/(.)\1*/g, "$1");
    if (collapsedUnits === "hms") {
        return NumberFormatType.HMS;
    }
    return collapsedUnits === "dms" ? NumberFormatType.DMS : undefined;
}

export function normalizeCatalogUnits(units: string | null | undefined): string | undefined {
    return units?.toLowerCase().replace(/[^a-z]/g, "");
}

export function isExcludedCoordinateName(name: string): boolean {
    const normalizedName = name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toLowerCase();
    return COORDINATE_COLUMN_EXCLUSION_PATTERNS.some(pattern => pattern.test(normalizedName));
}

export function findAutoSelectedCatalogAxisColumn(axisLabel: CatalogOverlay, currentAxis: string, axisOptions: string[], system: CatalogSystemType | undefined): string | undefined {
    if (currentAxis !== CatalogOverlay.NONE) {
        return undefined;
    }

    const patterns = AXIS_AUTO_SELECT_PATTERNS.get(axisLabel);
    if (!patterns) {
        return undefined;
    }

    return findPreferredAxisColumn(axisLabel, axisOptions, patterns, system);
}

export function getCatalogDataTypeDisplayName(type: CARTA.ColumnType | null | undefined): string {
    switch (type) {
        case CARTA.ColumnType.Bool:
            return "bool";
        case CARTA.ColumnType.Int8:
            return "byte";
        case CARTA.ColumnType.Int16:
            return "short";
        case CARTA.ColumnType.Int32:
            return "int";
        case CARTA.ColumnType.Int64:
            return "long";
        case CARTA.ColumnType.Uint8:
            return "unsigned byte";
        case CARTA.ColumnType.Uint16:
            return "unsigned short";
        case CARTA.ColumnType.Uint32:
            return "unsigned int";
        case CARTA.ColumnType.Uint64:
            return "unsigned long";
        case CARTA.ColumnType.Double:
            return "double";
        case CARTA.ColumnType.Float:
            return "float";
        case CARTA.ColumnType.String:
            return "string";
        default:
            return "unsupported";
    }
}

function getExplicitEquatorialSystem(columnName: string): CatalogSystemType | undefined {
    if (EXPLICIT_ICRS_PATTERN.test(columnName)) {
        return CatalogSystemType.ICRS;
    }
    if (EXPLICIT_FK4_PATTERN.test(columnName)) {
        return CatalogSystemType.FK4;
    }
    if (EXPLICIT_FK5_PATTERN.test(columnName)) {
        return CatalogSystemType.FK5;
    }
    return undefined;
}

function getExactEquatorialSystemPriority(explicitSystem: CatalogSystemType | undefined, expectedSystem: CatalogSystemType): number {
    if (explicitSystem === expectedSystem) {
        return AxisMatchPriority.Exact;
    }
    if (explicitSystem === undefined) {
        return AxisMatchPriority.Compatible;
    }
    return INCOMPATIBLE_AXIS_PRIORITY;
}

function getEquatorialColumnPriority(columnName: string, system: CatalogSystemType | undefined): number {
    const explicitSystem = getExplicitEquatorialSystem(columnName.toLowerCase());

    switch (system) {
        case CatalogSystemType.FK4:
            return getExactEquatorialSystemPriority(explicitSystem, CatalogSystemType.FK4);
        case CatalogSystemType.FK5:
            return getExactEquatorialSystemPriority(explicitSystem, CatalogSystemType.FK5);
        case CatalogSystemType.ICRS:
            if (explicitSystem === CatalogSystemType.FK4) {
                return INCOMPATIBLE_AXIS_PRIORITY;
            }
            if (explicitSystem === CatalogSystemType.ICRS) {
                return AxisMatchPriority.Exact;
            }
            if (explicitSystem === CatalogSystemType.FK5) {
                return EXPLICIT_FK5_J2000_PATTERN.test(columnName) ? AxisMatchPriority.Compatible : INCOMPATIBLE_AXIS_PRIORITY;
            }
            return AxisMatchPriority.Generic;
        default:
            return AxisMatchPriority.Exact;
    }
}

function isBetterAxisMatch(candidate: AxisMatchCandidate, bestMatch: AxisMatchCandidate | undefined): boolean {
    return (
        !bestMatch ||
        candidate.matchPriority < bestMatch.matchPriority ||
        (candidate.matchPriority === bestMatch.matchPriority && candidate.patternIndex < bestMatch.patternIndex) ||
        (candidate.matchPriority === bestMatch.matchPriority && candidate.patternIndex === bestMatch.patternIndex && candidate.optionIndex < bestMatch.optionIndex)
    );
}

function findPreferredAxisColumn(axisLabel: CatalogOverlay, axisOptions: string[], patterns: RegExp[], system: CatalogSystemType | undefined): string | undefined {
    let bestMatch: AxisMatchCandidate | undefined;
    const hasEquatorialPriority = axisLabel === CatalogOverlay.RA || axisLabel === CatalogOverlay.DEC;

    axisOptions.forEach((option, optionIndex) => {
        const patternIndex = patterns.findIndex(pattern => pattern.test(option));
        if (patternIndex === -1) {
            return;
        }

        const matchPriority = hasEquatorialPriority ? getEquatorialColumnPriority(option, system) : 0;
        if (matchPriority >= INCOMPATIBLE_AXIS_PRIORITY) {
            return;
        }

        const candidate = {columnName: option, matchPriority, optionIndex, patternIndex};
        if (isBetterAxisMatch(candidate, bestMatch)) {
            bestMatch = candidate;
        }
    });

    return bestMatch?.columnName;
}

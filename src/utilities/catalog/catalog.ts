import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType} from "enums";

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
    /^ra\b/i,
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
    /^dec\b/i,
    /^dec(?:mean|stack)\b/i,
    /^(?:de|dec)_?deg\b/i,
    /^dec_/i,
    /^decl(?:ination)?\b/i,
    /^delta\b/i,
    /^_?dej(?:\b|[0-9])/i
];
const GALACTIC_LONGITUDE_PATTERNS = [/^glon$/i, /^glon_?deg$/i, /^gal(?:actic)?_?lon(?:gitude)?(?:_?deg)?$/i, /^lon_?gal(?:actic)?$/i, /^gal_?l$/i, /^l$/i];
const GALACTIC_LATITUDE_PATTERNS = [/^glat$/i, /^glat_?deg$/i, /^gal(?:actic)?_?lat(?:itude)?(?:_?deg)?$/i, /^lat_?gal(?:actic)?$/i, /^gal_?b$/i, /^b$/i];
const ECLIPTIC_LONGITUDE_PATTERNS = [/^elon$/i, /^elon_?deg$/i, /^ecl(?:iptic)?_?lon(?:gitude)?(?:_?deg)?$/i, /^lon_?ecl(?:iptic)?$/i, /^lambda(?:_?(?:deg|j2000))?$/i];
const ECLIPTIC_LATITUDE_PATTERNS = [/^elat$/i, /^elat_?deg$/i, /^ecl(?:iptic)?_?lat(?:itude)?(?:_?deg)?$/i, /^lat_?ecl(?:iptic)?$/i, /^beta(?:_?(?:deg|j2000))?$/i];
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
const EXPLICIT_ICRS_PATTERN = /(?:^|[_.])icrs(?:$|[_.])/i;
const EXPLICIT_FK5_PATTERN = /20\d{2}/;
const EXPLICIT_FK5_J2000_PATTERN = /(?:^|\D)2000(?!\d)/;
const EXPLICIT_FK4_PATTERN = /19\d{2}/;

export function isCatalogAxisDataType(dataType: CARTA.ColumnType | null | undefined): boolean {
    return dataType != null && CATALOG_AXIS_DATA_TYPES.includes(dataType);
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
    const usesEquatorialPriority = axisLabel === CatalogOverlay.RA || axisLabel === CatalogOverlay.DEC;

    axisOptions.forEach((option, optionIndex) => {
        const patternIndex = patterns.findIndex(pattern => pattern.test(option));
        if (patternIndex === -1) {
            return;
        }

        const matchPriority = usesEquatorialPriority ? getEquatorialColumnPriority(option, system) : 0;
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

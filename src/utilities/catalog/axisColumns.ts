import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType} from "enums";

import {type CoordinateDescriptor, getCoordinateDescriptorFromUnits, hasCoordinateValuesToInspect, isStringColumnType, sniffCoordinateDescriptor} from "./coordinateFormat";

/**
 * Whether a column can be turned into a numeric coordinate for a given axis.
 *
 * Deliberately name-blind: a column called "dec_deg" is a perfectly valid thing to drop into the
 * RA slot when a catalog is mislabelled, so names only influence {@link rankCatalogAxisColumns}.
 *
 * `Unknown` covers string columns that declare no units and have nothing local to read yet: only
 * displayed columns are sent by the backend, and the rows that have arrived may all be blank. It
 * is not a verdict, so it must not be confused with `Ineligible` — values that were read and are
 * not coordinates.
 */
export enum CatalogAxisEligibility {
    Eligible = "eligible",
    Unknown = "unknown",
    Ineligible = "ineligible"
}

export interface CatalogAxisEligibilityResult {
    status: CatalogAxisEligibility;
    /** Present when the status is Eligible and the column needs parsing (string columns only). */
    descriptor?: CoordinateDescriptor;
    /** Human-readable explanation for a non-eligible status, shown in the axis menu. */
    reason?: string;
}

const NUMERIC_COLUMN_TYPES: CARTA.ColumnType[] = [
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

const AXIS_NAME_PATTERNS = new Map<CatalogOverlay, RegExp[]>([
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

enum AxisRankTier {
    ExactSystem = 0,
    CompatibleSystem = 1,
    GenericName = 2,
    /** Name matches but the system is wrong, or the name looks like an error/proper-motion column. */
    Demoted = 3,
    /** No name evidence at all. Still selectable, just never auto-selected. */
    Unmatched = 4
}

interface AxisRankCandidate {
    columnName: string;
    tier: AxisRankTier;
    patternIndex: number;
    optionIndex: number;
}

const NO_PATTERN_MATCH = Number.MAX_SAFE_INTEGER;

export function isCatalogNumericDataType(dataType: CARTA.ColumnType | null | undefined): boolean {
    return dataType != null && NUMERIC_COLUMN_TYPES.includes(dataType);
}

/**
 * @param sampleData - values from the column, when its data has already been fetched. Passing
 * nothing — or only blanks — is what makes a unitless string column `Unknown` rather than
 * `Ineligible`.
 */
export function getCatalogAxisEligibility(dataType: CARTA.ColumnType | null | undefined, units: string | null | undefined, sampleData?: ReadonlyArray<string | number | null | undefined>): CatalogAxisEligibilityResult {
    if (isCatalogNumericDataType(dataType)) {
        return {status: CatalogAxisEligibility.Eligible};
    }

    if (!isStringColumnType(dataType)) {
        return {status: CatalogAxisEligibility.Ineligible, reason: "Column is not numeric and cannot be read as a coordinate."};
    }

    const unitDescriptor = getCoordinateDescriptorFromUnits(units);
    if (unitDescriptor) {
        return {status: CatalogAxisEligibility.Eligible, descriptor: unitDescriptor};
    }

    // A column whose loaded rows are all blank has not been read, only skimmed: an early page of
    // empty cells says nothing about the format, and calling it ineligible would drop the column
    // from the axis menu for good, with no way for the user to say otherwise.
    if (!hasCoordinateValuesToInspect(sampleData)) {
        return {status: CatalogAxisEligibility.Unknown, reason: "Column declares no coordinate units. Select it to load its values and check the format."};
    }

    const sniffedDescriptor = sniffCoordinateDescriptor(sampleData);
    if (sniffedDescriptor) {
        return {status: CatalogAxisEligibility.Eligible, descriptor: sniffedDescriptor};
    }

    return {status: CatalogAxisEligibility.Ineligible, reason: "Column values are not a recognized coordinate format."};
}

/**
 * Orders columns by how likely the user meant each one for this axis. Names live here and only
 * here: this is the layer that guesses intent, and it never decides whether a column is usable.
 *
 * Columns with no name evidence keep their original order at the end of the list, so the axis menu
 * can render the whole array while auto-select takes the head.
 */
export function rankCatalogAxisColumns(axis: CatalogOverlay, columnNames: ReadonlyArray<string>, system: CatalogSystemType | undefined): string[] {
    return rankAxisCandidates(axis, columnNames, system).map(candidate => candidate.columnName);
}

/**
 * The column the axis should default to, or undefined when no name matched well enough to guess.
 * Demoted and unmatched columns stay selectable in the menu but are never chosen automatically.
 */
export function getAutoSelectedCatalogAxisColumn(axis: CatalogOverlay, columnNames: ReadonlyArray<string>, system: CatalogSystemType | undefined): string | undefined {
    const [best] = rankAxisCandidates(axis, columnNames, system);
    return best && best.tier < AxisRankTier.Demoted ? best.columnName : undefined;
}

function rankAxisCandidates(axis: CatalogOverlay, columnNames: ReadonlyArray<string>, system: CatalogSystemType | undefined): AxisRankCandidate[] {
    const patterns = AXIS_NAME_PATTERNS.get(axis);
    const candidates: AxisRankCandidate[] = columnNames.map((columnName, optionIndex) => {
        const patternIndex = patterns?.findIndex(pattern => pattern.test(columnName)) ?? -1;
        if (patternIndex === -1) {
            return {columnName, tier: AxisRankTier.Unmatched, patternIndex: NO_PATTERN_MATCH, optionIndex};
        }
        return {columnName, tier: getNameMatchTier(axis, columnName, system), patternIndex, optionIndex};
    });

    return candidates.sort((a, b) => a.tier - b.tier || a.patternIndex - b.patternIndex || a.optionIndex - b.optionIndex);
}

export function isExcludedCoordinateName(name: string): boolean {
    const normalizedName = name
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .toLowerCase();
    return COORDINATE_COLUMN_EXCLUSION_PATTERNS.some(pattern => pattern.test(normalizedName));
}

function getNameMatchTier(axis: CatalogOverlay, columnName: string, system: CatalogSystemType | undefined): AxisRankTier {
    if (isExcludedCoordinateName(columnName)) {
        return AxisRankTier.Demoted;
    }
    if (axis !== CatalogOverlay.RA && axis !== CatalogOverlay.DEC) {
        return AxisRankTier.ExactSystem;
    }
    return getEquatorialTier(columnName.toLowerCase(), system);
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

function getEquatorialTier(columnName: string, system: CatalogSystemType | undefined): AxisRankTier {
    const explicitSystem = getExplicitEquatorialSystem(columnName);

    switch (system) {
        case CatalogSystemType.FK4:
        case CatalogSystemType.FK5:
            if (explicitSystem === system) {
                return AxisRankTier.ExactSystem;
            }
            return explicitSystem === undefined ? AxisRankTier.CompatibleSystem : AxisRankTier.Demoted;
        case CatalogSystemType.ICRS:
            if (explicitSystem === CatalogSystemType.ICRS) {
                return AxisRankTier.ExactSystem;
            }
            if (explicitSystem === CatalogSystemType.FK4) {
                return AxisRankTier.Demoted;
            }
            if (explicitSystem === CatalogSystemType.FK5) {
                return EXPLICIT_FK5_J2000_PATTERN.test(columnName) ? AxisRankTier.CompatibleSystem : AxisRankTier.Demoted;
            }
            return AxisRankTier.GenericName;
        default:
            return AxisRankTier.ExactSystem;
    }
}

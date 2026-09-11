import {CARTA} from "carta-protobuf";

import {CatalogOverlay} from "enums";

import {CATALOG_ARCMIN_UNITS, CATALOG_ARCSEC_UNITS, CATALOG_DEGREE_UNITS, CATALOG_HOUR_UNITS, CATALOG_RADIAN_UNITS} from "./constants";

/**
 * How the first sexagesimal field is scaled. `Ambiguous` means the evidence available at
 * recognition time cannot decide it: a bare "12:30:00" is 12 hours or 12 degrees depending on
 * which axis the column ends up feeding, and nothing in the value itself says which.
 * It is narrowed by {@link resolveDescriptorForAxis} once an axis is known.
 */
export type CoordinateFieldUnit = "hour" | "degree" | "radian" | "ambiguous";

export type CoordinateFormatKind =
    | "decimal"
    // "12h30m00s", "12:30:00", "-21 57 15.4625", "275°11′15.6954″"
    | "sexagesimal"
    // CASA writes some values with periods between the fields, e.g. "-021.57.15.4625".
    | "dot-sexagesimal"
    // Separator-free "HHMMSS.s" / "±DDMMSS.s", as written by ESO target lists. Indistinguishable
    // from a decimal value on its own, so it is only read this way when the units say so.
    | "compact-sexagesimal";

export interface CoordinateDescriptor {
    kind: CoordinateFormatKind;
    fieldUnit: CoordinateFieldUnit;
    source: "units" | "sniffed";
}

/** A descriptor whose scaling is fully decided, so parsing needs no further context. */
export interface ResolvedCoordinateDescriptor extends CoordinateDescriptor {
    fieldUnit: "hour" | "degree" | "radian";
}

interface RecognizedCoordinate {
    kind: CoordinateFormatKind;
    /** Set only when the value carries an explicit marker, which always wins over the axis. */
    explicitUnit?: "hour" | "degree";
    fields: number[];
    isNegative: boolean;
}

const DOT_SEXAGESIMAL_PATTERN = /^([+-]?)(\d+)\.(\d{1,2})\.(\d{1,2}(?:\.\d+)?)$/;
// Six digits are HHMMSS or DDMMSS; seven allow a three-digit longitude, e.g. "2751115.6954".
const COMPACT_SEXAGESIMAL_PATTERN = /^([+-]?)(\d{6,7})(\.\d+)?$/;
// Each colon is its own boundary so that an omitted field leaves an empty part behind ("6::2.5"),
// while a run of whitespace is a single boundary. A `[:\s]+` class would swallow "::" as one
// separator and silently turn AST's omitted-field spelling into a different coordinate.
const SEXAGESIMAL_SEPARATOR_PATTERN = /\s*:\s*|\s+/;
const HOUR_MARKER_PATTERN = /h/i;
const DEGREE_MARKER_PATTERN = /d/i;
const SIGN_PATTERN = /^[+-]/;

const HOUR_AXES = new Set<CatalogOverlay>([CatalogOverlay.RA]);
const LATITUDE_AXES = new Set<CatalogOverlay>([CatalogOverlay.DEC, CatalogOverlay.GLAT, CatalogOverlay.ELAT]);

const DEGREES_PER_FIELD_UNIT: Record<"hour" | "degree" | "radian", number> = {
    hour: 15,
    degree: 1,
    radian: 180 / Math.PI
};

/**
 * Rewrites the notations that mean the same thing as the ASCII ones the grammar below expects:
 * the Unicode minus, and the degree/prime/double-prime marks (plus their typewriter stand-ins).
 * Doing it here keeps the rest of the grammar to a single spelling of each separator.
 */
function normalizeCoordinateNotation(text: string): string {
    return text.replace(/−/g, "-").replace(/°/g, "d").replace(/[′']/g, "m").replace(/[″"]/g, "s");
}

/**
 * Recognizes the shape of a single coordinate string. This is the only place that knows the
 * accepted grammar; both {@link sniffCoordinateDescriptor} and {@link parseCoordinateValue} go
 * through it so that a format we can parse is never a format we fail to recognize, and vice versa.
 *
 * @param expectedKind - what the column's units say the values are. Supplying `sexagesimal` is what
 * unlocks the separator-free compact form, which is otherwise indistinguishable from a decimal
 * value: "205405.689" is 20h54m05.689s or 205405.689 degrees, and only the metadata can say which.
 */
export function recognizeCoordinateString(value: string | number | null | undefined, expectedKind?: CoordinateFormatKind): RecognizedCoordinate | undefined {
    const text = normalizeCoordinateNotation(trimCoordinateValue(value));
    if (!text) {
        return undefined;
    }

    const isNegative = text.startsWith("-");

    const dotMatch = DOT_SEXAGESIMAL_PATTERN.exec(text);
    if (dotMatch) {
        const fields = [Number(dotMatch[2]), Number(dotMatch[3]), Number(dotMatch[4])];
        return isValidSexagesimalFields(fields) ? {kind: "dot-sexagesimal", fields, isNegative} : undefined;
    }

    if (expectedKind === "sexagesimal" || expectedKind === "compact-sexagesimal") {
        const compact = recognizeCompactSexagesimal(text, isNegative);
        if (compact) {
            return compact;
        }
    }

    const hasHourMarker = HOUR_MARKER_PATTERN.test(text);
    const hasDegreeMarker = DEGREE_MARKER_PATTERN.test(text);
    const parts = text.replace(/[hmsd]/gi, ":").split(SEXAGESIMAL_SEPARATOR_PATTERN);

    // A trailing separator is just the unit letter that closes the last field ("20h54m05.689s").
    if (parts.length > 1 && parts[parts.length - 1] === "") {
        parts.pop();
    }
    // A leading or interior gap is one of AST's omitted-field spellings (":45:33", "6::2.5").
    // AST reads those positionally; we would read them as a different coordinate entirely, so
    // they are rejected rather than quietly given a second meaning.
    if (parts.some(part => part === "")) {
        return undefined;
    }
    // The sign belongs to the coordinate as a whole, so only the leading field may carry one.
    // "12:-30:00" is malformed, not 12.5: the fields are summed by magnitude, so a sign further
    // along would otherwise be discarded and the value plotted half a degree from where it reads.
    if (parts.slice(1).some(part => SIGN_PATTERN.test(part))) {
        return undefined;
    }

    const fields = parts.map(Number);
    if (!fields.length || fields.length > 3 || fields.some(field => !isFinite(field))) {
        return undefined;
    }
    if (!isValidSexagesimalFields(fields)) {
        return undefined;
    }

    const explicitUnit = hasHourMarker ? "hour" : hasDegreeMarker ? "degree" : undefined;

    // A single field with no marker carries no sexagesimal notation at all, so it is a plain
    // decimal value. Treating it as sexagesimal is what would let a bare "187.5" be scaled by 15.
    if (fields.length === 1 && !hasHourMarker && !hasDegreeMarker) {
        return {kind: "decimal", fields, isNegative};
    }

    return {kind: "sexagesimal", explicitUnit, fields, isNegative};
}

function recognizeCompactSexagesimal(text: string, isNegative: boolean): RecognizedCoordinate | undefined {
    const match = COMPACT_SEXAGESIMAL_PATTERN.exec(text);
    if (!match) {
        return undefined;
    }

    const digits = match[2];
    const fields = [Number(digits.slice(0, digits.length - 4)), Number(digits.slice(-4, -2)), Number(`${digits.slice(-2)}${match[3] ?? ""}`)];
    return isValidSexagesimalFields(fields) ? {kind: "compact-sexagesimal", fields, isNegative} : undefined;
}

/**
 * Derives a descriptor from the column's declared units. Units are authoritative: when a column
 * says "hms" there is nothing left to guess.
 */
export function getCoordinateDescriptorFromUnits(units: string | null | undefined): CoordinateDescriptor | undefined {
    const normalizedUnits = normalizeCatalogUnits(units);
    if (!normalizedUnits) {
        return undefined;
    }

    if (CATALOG_DEGREE_UNITS.includes(normalizedUnits)) {
        return {kind: "decimal", fieldUnit: "degree", source: "units"};
    }

    if (CATALOG_RADIAN_UNITS.includes(normalizedUnits)) {
        return {kind: "decimal", fieldUnit: "radian", source: "units"};
    }

    if (CATALOG_HOUR_UNITS.includes(normalizedUnits)) {
        return {kind: "decimal", fieldUnit: "hour", source: "units"};
    }

    // Sexagesimal units are spelled many ways, and dropping the separators leaves repeated letters
    // behind: "h:m:s" gives "hms", "hh:mm:ss" gives "hhmmss", "dd:mm:ss.ss" gives "ddmmssss".
    // Collapsing runs of the same letter reduces all of those to "hms" or "dms".
    const collapsedUnits = normalizedUnits.replace(/(.)\1*/g, "$1");
    if (collapsedUnits === "hms") {
        return {kind: "sexagesimal", fieldUnit: "hour", source: "units"};
    }
    if (collapsedUnits === "dms") {
        return {kind: "sexagesimal", fieldUnit: "degree", source: "units"};
    }
    return undefined;
}

export const COORDINATE_SNIFF_SAMPLE_SIZE = 100;
/** How many rows may be scanned per sample wanted, before giving up on a mostly-empty column. */
const EMPTY_VALUE_SCAN_FACTOR = 10;

/**
 * Bounds the scan itself, not just the number of values inspected: a column that is empty for its
 * first million rows would otherwise be walked in full on every call.
 */
function getSniffScanLimit(valueCount: number, sampleSize: number): number {
    return Math.min(valueCount, sampleSize * EMPTY_VALUE_SCAN_FACTOR);
}

/**
 * Whether a sample holds anything a descriptor could be derived from.
 *
 * A column whose loaded rows are all blank has not been ruled out as a coordinate -- it has not
 * been read yet, which is a different answer for the caller than "these values were read and are
 * not coordinates". Only the rows the sniffer would actually reach are considered, so this agrees
 * with {@link sniffCoordinateDescriptor} about what counts as having been looked at.
 */
export function hasCoordinateValuesToInspect(values: ReadonlyArray<string | number | null | undefined> | undefined, sampleSize: number = COORDINATE_SNIFF_SAMPLE_SIZE): boolean {
    if (!values?.length) {
        return false;
    }

    const scanLimit = getSniffScanLimit(values.length, sampleSize);
    for (let index = 0; index < scanLimit; index++) {
        if (!isBlankCoordinateValue(values[index])) {
            return true;
        }
    }
    return false;
}

/**
 * Derives a descriptor from the data itself, for columns that declare no units. Only the values
 * are consulted; the column name is deliberately not an input here, because a name states intent
 * and intent is the ranking layer's business, not the parser's.
 *
 * A format is a property of the column, not of every row in it, so a minority of unreadable
 * values does not overturn what the rest plainly are: catalogs write a missing coordinate as a
 * placeholder ("--", "N/A"), and parseCoordinateValue already drops such a row as NaN once the
 * format is settled. Letting one of them veto the column instead removed it from the axis menu
 * altogether, where the user had no way to say otherwise. Recognized values must still be a
 * strict majority, and must still all agree -- two formats in one column is a genuine ambiguity
 * that guessing cannot resolve.
 *
 * Returns undefined when the recognized values disagree or fail to carry the majority, and when
 * there was nothing to inspect. The caller separates that last case from the others with
 * {@link hasCoordinateValuesToInspect}: only values that were read and rejected are evidence that
 * a column is not a coordinate.
 */
export function sniffCoordinateDescriptor(values: ReadonlyArray<string | number | null | undefined> | undefined, sampleSize: number = COORDINATE_SNIFF_SAMPLE_SIZE): CoordinateDescriptor | undefined {
    if (!values?.length) {
        return undefined;
    }

    let descriptor: CoordinateDescriptor | undefined;
    let inspectedCount = 0;
    let recognizedCount = 0;
    const scanLimit = getSniffScanLimit(values.length, sampleSize);

    for (let index = 0; index < scanLimit; index++) {
        const value = values[index];
        if (isBlankCoordinateValue(value)) {
            continue;
        }
        if (inspectedCount >= sampleSize) {
            break;
        }
        inspectedCount++;

        const recognized = recognizeCoordinateString(value);
        if (!recognized) {
            continue;
        }

        const candidate: CoordinateDescriptor = {
            kind: recognized.kind,
            fieldUnit: recognized.explicitUnit ?? (recognized.kind === "decimal" ? "degree" : "ambiguous"),
            source: "sniffed"
        };

        if (descriptor && (descriptor.kind !== candidate.kind || descriptor.fieldUnit !== candidate.fieldUnit)) {
            return undefined;
        }
        descriptor = candidate;
        recognizedCount++;
    }

    // A strict majority, so a column of names with a few numeric entries in it cannot pass as a
    // coordinate: more than half its values would have to read as one coordinate format first.
    return recognizedCount * 2 > inspectedCount ? descriptor : undefined;
}

/**
 * Narrows an ambiguous descriptor using the axis the column has been bound to. This is the single
 * point where intent is allowed to influence interpretation, and it happens after the user (or
 * auto-select) has chosen where the column goes.
 */
export function resolveDescriptorForAxis(descriptor: CoordinateDescriptor, axis: CatalogOverlay): ResolvedCoordinateDescriptor {
    if (descriptor.fieldUnit !== "ambiguous") {
        return descriptor as ResolvedCoordinateDescriptor;
    }
    return {...descriptor, fieldUnit: HOUR_AXES.has(axis) ? "hour" : "degree"};
}

/**
 * Reads one value in the units its column declares, which is what the sky transform expects: it
 * applies {@link getDegreesPerCatalogUnit} on the way into AST, so scaling here as well would
 * apply that scale twice.
 *
 * Sexagesimal columns are the exception, and have to be. `hms` and `dms` name a notation, not a
 * scale that could be multiplied, so those values are converted to degrees here instead --
 * getDegreesPerCatalogUnit reports 1 degree per unit for them, so exactly one conversion happens
 * on either path. A value carrying its own h/d marker is converted here for the same reason.
 *
 * Pure: everything needed to read the value is in the descriptor, so this never re-reads units or
 * inspects the column name.
 */
export function parseCoordinateValue(value: string | number | null | undefined, descriptor: ResolvedCoordinateDescriptor): number {
    const recognized = recognizeCoordinateString(value, descriptor.kind);
    if (!recognized) {
        return NaN;
    }

    const [firstField, minutes = 0, seconds = 0] = recognized.fields;
    const magnitude = Math.abs(firstField) + Math.abs(minutes) / 60 + Math.abs(seconds) / 3600;
    const sign = recognized.isNegative ? -1 : 1;

    // The descriptor's kind, not the value's: "12:30:00" in a column of decimal hours is 12.5 of
    // that column's units, and the sexagesimal notation only says how the value was subdivided.
    if (descriptor.kind === "decimal" && !recognized.explicitUnit) {
        return sign * magnitude;
    }

    // Radians only ever describe a whole decimal value, so a sexagesimal value in a radian column
    // is read as degrees rather than scaled by something its own notation contradicts.
    const fieldUnit = recognized.explicitUnit ?? (descriptor.fieldUnit === "radian" ? "degree" : descriptor.fieldUnit);
    return sign * magnitude * DEGREES_PER_FIELD_UNIT[fieldUnit];
}

/** Pixel axes are unbounded, and longitudes need no help: see {@link rejectOutOfRangeLatitude}. */
export function isCatalogLatitudeAxis(axis: CatalogOverlay): boolean {
    return LATITUDE_AXES.has(axis);
}

/**
 * Drops a latitude that lies beyond a pole.
 *
 * Longitude needs no equivalent: AST's sky-to-pixel transform is trigonometric and so already
 * periodic in 360 degrees, and 375 lands on exactly the same pixel as 15. Latitude gets no such
 * treatment. Past the near pole the projection keeps evaluating and returns a finite but wrong
 * pixel, and on the far hemisphere it returns AST__BAD, which reaches the render path as
 * -Infinity and drags the whole catalog's bounding box with it -- `minMaxArray` skips NaN but not
 * infinities. NaN is the state that pipeline already handles, so a row beyond the pole is dropped
 * exactly as an unparseable one is.
 *
 * The bound is exclusive: a source at either pole is a real position AST transforms correctly.
 */
export function rejectOutOfRangeLatitude(degrees: number): number {
    return Math.abs(degrees) > 90 ? NaN : degrees;
}

export function normalizeCatalogUnits(units: string | null | undefined): string | undefined {
    return units?.toLowerCase().replace(/[^a-z]/g, "");
}

/**
 * How many degrees one unit of a column's declared units is worth. This is the scale the sky
 * transform applies on its way into AST, shared with it so the two cannot drift: a range check
 * that disagreed with the transform would drop valid sources.
 *
 * Every unit that is a plain multiple of a degree is scaled here, whichever way the column
 * arrived. Doing it here rather than in {@link parseCoordinateValue} is what gets a numeric
 * column right: a Double column in `h` or `rad` never passes through the parser at all, and was
 * otherwise plotted as though its values were degrees.
 *
 * Sexagesimal units (`hms`, `dms`) name a notation rather than a scale, so they are worth one
 * degree per unit here and the parser converts those values instead. Unknown units fall back to
 * degrees, as the transform does.
 */
export function getDegreesPerCatalogUnit(units: string | null | undefined): number {
    const normalizedUnits = normalizeCatalogUnits(units);
    if (!normalizedUnits) {
        return 1;
    }
    if (CATALOG_ARCMIN_UNITS.includes(normalizedUnits)) {
        return 1 / 60;
    }
    if (CATALOG_ARCSEC_UNITS.includes(normalizedUnits)) {
        return 1 / 3600;
    }
    if (CATALOG_RADIAN_UNITS.includes(normalizedUnits)) {
        return DEGREES_PER_FIELD_UNIT.radian;
    }
    if (CATALOG_HOUR_UNITS.includes(normalizedUnits)) {
        return DEGREES_PER_FIELD_UNIT.hour;
    }
    return 1;
}

export function isStringColumnType(dataType: CARTA.ColumnType | null | undefined): boolean {
    return dataType === CARTA.ColumnType.String;
}

/** The value with the padding and NUL bytes that carry no meaning stripped. An absent value is "". */
function trimCoordinateValue(value: string | number | null | undefined): string {
    return value === null || value === undefined ? "" : String(value).replace(/\0/g, "").trim();
}

/**
 * Whether a value is one of the spellings of "no value here". A padded empty cell ("  ") means
 * exactly what an empty one does, and fixed-width tables write missing coordinates that way, so
 * it must not be mistaken for a value that was read and found not to be a coordinate.
 */
function isBlankCoordinateValue(value: string | number | null | undefined): boolean {
    return trimCoordinateValue(value) === "";
}

function isValidSexagesimalFields(fields: number[]): boolean {
    if (fields.some(field => !isFinite(field))) {
        return false;
    }
    // Only the trailing fields are bounded; the leading one is an hour or degree count. They are
    // unsigned by the time they get here -- the compact and dot forms match digits only, and a
    // sign on a trailing field is rejected where the value is split -- and the bound is applied
    // to the value itself so that no later caller can reintroduce one.
    return fields.slice(1).every(field => field >= 0 && field < 60);
}

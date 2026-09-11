import {CatalogOverlay} from "enums";

import {
    type CoordinateDescriptor,
    getCoordinateDescriptorFromUnits,
    getDegreesPerCatalogUnit,
    isCatalogLatitudeAxis,
    parseCoordinateValue,
    rejectOutOfRangeLatitude,
    type ResolvedCoordinateDescriptor,
    resolveDescriptorForAxis,
    sniffCoordinateDescriptor
} from "./coordinateFormat";

/**
 * The format matrix: one row per (longitude string, latitude string) pair a real catalog might
 * carry, tied to the units its column would declare. Longitude and latitude are separate columns
 * throughout, which is the only shape CARTA supports.
 *
 * Every row fixes the same sky position where the format can express it, so a wrong scaling shows
 * up as an obviously wrong number rather than a subtly shifted one.
 */

/** A column as the overlay sees it: the units it declares, and the descriptor they imply. */
type ColumnFormat = {descriptor: ResolvedCoordinateDescriptor; units: string | null};

const HOUR: ColumnFormat = {descriptor: {kind: "sexagesimal", fieldUnit: "hour", source: "units"}, units: "hms"};
const DEGREE: ColumnFormat = {descriptor: {kind: "sexagesimal", fieldUnit: "degree", source: "units"}, units: "dms"};
const DECIMAL_DEGREE: ColumnFormat = {descriptor: {kind: "decimal", fieldUnit: "degree", source: "units"}, units: "deg"};
const DECIMAL_HOUR: ColumnFormat = {descriptor: {kind: "decimal", fieldUnit: "hour", source: "units"}, units: "h"};
const DECIMAL_RADIAN: ColumnFormat = {descriptor: {kind: "decimal", fieldUnit: "radian", source: "units"}, units: "rad"};

/**
 * The degrees a column of this format actually contributes to the overlay: the parser's reading
 * scaled by the units, which is the pair the sky transform applies on its way into AST.
 *
 * The rows below assert on that product rather than on the parser alone, because the two halves
 * divide the work differently depending on the units -- `hms` names a notation the parser has to
 * resolve, `h` names a scale the transform applies -- and either half can look right on its own
 * while the product is out by a factor of fifteen.
 */
function readDegrees(value: string, format: ColumnFormat): number {
    return parseCoordinateValue(value, format.descriptor) * getDegreesPerCatalogUnit(format.units);
}

type Row = [label: string, value: string, format: ColumnFormat, expectedDegrees: number];

// 20h54m05.689s = 313.523704...  |  +37d01m17.38s = 37.021494...
const RA_DEGREES = 313.52370416666665;
const DEC_DEGREES = 37.02149444444444;

const SUPPORTED_ROWS: Row[] = [
    // --- decimal degrees, the modern default ---
    ["decimal degrees lon", "350.123456", DECIMAL_DEGREE, 350.123456],
    ["decimal degrees lat", "-17.33333", DECIMAL_DEGREE, -17.33333],
    ["decimal degrees signed", "+350.123456", DECIMAL_DEGREE, 350.123456],
    ["decimal degrees zero", "0", DECIMAL_DEGREE, 0],
    ["decimal degrees scientific", "3.50123456e2", DECIMAL_DEGREE, 350.123456],
    ["explicit degree marker", "350.123456d", DECIMAL_DEGREE, 350.123456],

    // --- decimal hours, as HEASARC and SIMBAD write RA ---
    ["decimal hours by unit", "12.34567", DECIMAL_HOUR, 185.18505],
    ["decimal hours by marker", "12.34567h", DECIMAL_DEGREE, 185.18505],

    // --- whitespace separated, the VizieR "h:m:s" / "d:m:s" columns ---
    ["space hms", "20 54 05.689", HOUR, RA_DEGREES],
    ["space dms", "+37 01 17.38", DEGREE, DEC_DEGREES],
    ["space dms unsigned", "37 01 17.38", DEGREE, DEC_DEGREES],
    ["space runs collapse", "20  54  05.689", HOUR, RA_DEGREES],
    ["tab separated", "20\t54\t05.689", HOUR, RA_DEGREES],
    ["surrounding whitespace", "  20 54 05.689  ", HOUR, RA_DEGREES],

    // --- colon separated ---
    ["colon hms", "20:54:05.689", HOUR, RA_DEGREES],
    ["colon dms", "+37:01:17.38", DEGREE, DEC_DEGREES],
    ["colon spaced", "20 : 54 : 05.689", HOUR, RA_DEGREES],
    ["colon spaced ragged", "20: 54 :05.689", HOUR, RA_DEGREES],

    // --- explicit h/m/s and d/m/s letters ---
    ["hms letters", "20h54m05.689s", HOUR, RA_DEGREES],
    ["dms letters", "+37d01m17.38s", DEGREE, DEC_DEGREES],
    ["uppercase letters", "20H54M05.689S", HOUR, RA_DEGREES],
    ["marker beats hour unit", "12d30m00s", HOUR, 12.5],
    ["marker beats degree unit", "12h30m00s", DEGREE, 187.5],

    // --- partial sexagesimal: seconds omitted ---
    ["partial hm letters", "15h17m", HOUR, 229.25],
    ["partial dm letters", "-11d10m", DEGREE, -11.166666666666666],
    ["partial colon", "20:54", HOUR, 313.5],
    ["partial space", "15 17", HOUR, 229.25],

    // --- degree-based DMS longitude (galactic, ecliptic) ---
    ["degree DMS lon letters", "275d11m15.6954s", DEGREE, 275.18769316666664],
    ["degree DMS lon colon", "275:11:15.6954", DEGREE, 275.18769316666664],
    ["degree DMS lon space", "275 11 15.6954", DEGREE, 275.18769316666664],

    // --- compact, separator-free; only readable because the units say sexagesimal ---
    ["compact HHMMSS.s", "205405.689", HOUR, RA_DEGREES],
    ["compact +DDMMSS.s", "+370117.38", DEGREE, DEC_DEGREES],
    ["compact DDMMSS unsigned", "370117.38", DEGREE, DEC_DEGREES],
    ["compact -DDMMSS", "-451750", DEGREE, -45.29722222222222],
    ["compact DDDMMSS.s", "2751115.6954", DEGREE, 275.18769316666664],

    // --- CASA dot-separated ---
    ["CASA dot form", "-021.57.15.4625", DEGREE, -21.954295138888888],

    // --- Unicode angle notation ---
    ["unicode degree prime", "275°11′15.6954″", DEGREE, 275.18769316666664],
    ["typewriter prime", "275d11'15.6954\"", DEGREE, 275.18769316666664],
    ["unicode minus decimal", "−17.33333", DECIMAL_DEGREE, -17.33333],
    ["unicode minus sexagesimal", "−45:17:50", DEGREE, -45.29722222222222],

    // --- leading zeros present or absent ---
    ["leading zeros", "01:02:03.4", HOUR, 15.514166666666666],
    ["no leading zeros", "1:2:3.4", HOUR, 15.514166666666666],

    // --- negative zero: the sign must survive a zero leading field ---
    ["negative zero colon", "-00:12:34.5", DEGREE, -0.20958333333333334],
    ["negative zero letters", "-00d12m34.5s", DEGREE, -0.20958333333333334],
    ["negative zero space", "-00 12 34.5", DEGREE, -0.20958333333333334],
    ["negative zero one arcsec", "-00:00:01", DEGREE, -0.0002777777777777778],
    ["negative zero compact", "-000001", DEGREE, -0.0002777777777777778],

    // --- boundaries ---
    ["RA lower bound", "00:00:00", HOUR, 0],
    ["RA upper bound", "23:59:59.999", HOUR, 359.9999958333333],
    ["Dec pole positive", "+90:00:00", DEGREE, 90],
    ["Dec pole negative", "-90:00:00", DEGREE, -90],
    ["Dec near pole", "+89:59:59.999", DEGREE, 89.99999972222222],
    ["longitude upper bound", "359.999999", DECIMAL_DEGREE, 359.999999]
];

const REJECTED_ROWS: Array<[label: string, value: string, format: ColumnFormat]> = [
    ["object name", "NGC 1333", DEGREE],
    ["free text", "banana", DEGREE],
    ["empty", "", DEGREE],
    ["minutes out of range", "12:70:00", DEGREE],
    ["seconds out of range", "12:30:61", DEGREE],
    ["too many fields", "1:2:3:4", DEGREE],
    ["trailing garbage", "12:30:00 extra", DEGREE],
    // AST reads these positionally as omitted fields. We would read them as a different
    // coordinate, so they are rejected instead of silently given a second meaning.
    ["AST leading omitted field", ":45:33", DEGREE],
    ["AST interior omitted field", "6::2.5", DEGREE],
    ["AST fully omitted fields", "::13", DEGREE],
    ["AST leading unit letter", "h3:14", DEGREE]
];

describe("coordinate format matrix", () => {
    test.each(SUPPORTED_ROWS)("parses %s: %s", (_label, value, format, expected) => {
        expect(readDegrees(value, format)).toBeCloseTo(expected, 9);
    });

    test.each(REJECTED_ROWS)("rejects %s: %s", (_label, value, format) => {
        expect(readDegrees(value, format)).toBeNaN();
    });

    describe("the compact form needs metadata, never a guess", () => {
        test("a bare six-digit value is a decimal number unless the units say otherwise", () => {
            // "205405.689" is 20h54m05.689s or 205405.689 degrees. Nothing in the value decides it.
            expect(readDegrees("205405.689", DECIMAL_DEGREE)).toBe(205405.689);
            expect(readDegrees("205405.689", HOUR)).toBeCloseTo(RA_DEGREES, 9);
        });

        test("sniffing never produces the compact reading", () => {
            expect(sniffCoordinateDescriptor(["205405.689", "101245.3"])).toEqual({kind: "decimal", fieldUnit: "degree", source: "sniffed"});
        });

        test("a short bare number in a sexagesimal column stays decimal", () => {
            // Only a 6- or 7-digit run can be HHMMSS; "12.5" in an hms column is 12.5 hours.
            expect(readDegrees("12.5", HOUR)).toBe(187.5);
        });
    });

    describe("radians come from the units alone", () => {
        test("converts radian columns to degrees", () => {
            expect(readDegrees(String(Math.PI), DECIMAL_RADIAN)).toBeCloseTo(180, 9);
            expect(readDegrees(String(Math.PI / 2), DECIMAL_RADIAN)).toBeCloseTo(90, 9);
            expect(readDegrees(String(-Math.PI / 4), DECIMAL_RADIAN)).toBeCloseTo(-45, 9);
            expect(readDegrees("0", DECIMAL_RADIAN)).toBe(0);
        });

        test("is reachable only through the units", () => {
            expect(getCoordinateDescriptorFromUnits("rad")).toEqual({kind: "decimal", fieldUnit: "radian", source: "units"});
            expect(getCoordinateDescriptorFromUnits("radians")).toEqual({kind: "decimal", fieldUnit: "radian", source: "units"});
            // A bare "1.234" is degrees or radians with equal plausibility, so sniffing says degrees.
            expect(sniffCoordinateDescriptor(["1.234", "0.5"])?.fieldUnit).toBe("degree");
        });
    });

    describe("units the parser never sees", () => {
        // A numeric column goes straight to the transform, so its declared units are the only
        // conversion it ever gets. Reading them as degrees put a Double column of hours 175
        // degrees from where it belonged, and a radian one 54 degrees out.
        test("scales a numeric column by whatever its units are worth", () => {
            expect(getDegreesPerCatalogUnit("h")).toBe(15);
            expect(getDegreesPerCatalogUnit("hours")).toBe(15);
            expect(getDegreesPerCatalogUnit("rad")).toBeCloseTo(180 / Math.PI, 12);
            expect(getDegreesPerCatalogUnit("arcmin")).toBeCloseTo(1 / 60, 12);
            expect(getDegreesPerCatalogUnit("arcsec")).toBeCloseTo(1 / 3600, 12);
            expect(getDegreesPerCatalogUnit("deg")).toBe(1);
            expect(getDegreesPerCatalogUnit(null)).toBe(1);
        });

        test("leaves sexagesimal units at one degree per unit, because the parser converts those", () => {
            // "hms" names a notation, not a scale. Scaling here too would apply fifteen twice.
            expect(getDegreesPerCatalogUnit("hms")).toBe(1);
            expect(getDegreesPerCatalogUnit("h:m:s")).toBe(1);
            expect(getDegreesPerCatalogUnit("hh:mm:ss")).toBe(1);
            expect(getDegreesPerCatalogUnit("dms")).toBe(1);
        });

        test("applies exactly one conversion, whichever half does the work", () => {
            // The same position in the two spellings of an hour column: the parser resolves the
            // sexagesimal one and the units scale the decimal one, and they have to agree.
            expect(readDegrees("12:30:00", HOUR)).toBe(187.5);
            expect(readDegrees("12.5", DECIMAL_HOUR)).toBe(187.5);
            // A sexagesimal value in a column whose units name a scale is still one conversion.
            expect(readDegrees("12:30:00", DECIMAL_HOUR)).toBe(187.5);
        });
    });

    describe("hours versus degrees is settled by units or axis, never by the separator", () => {
        test("the same string reads differently on an RA axis and a longitude axis", () => {
            const sniffed = sniffCoordinateDescriptor(["12:30:00"]) as CoordinateDescriptor;
            expect(sniffed.fieldUnit).toBe("ambiguous");

            expect(parseCoordinateValue("12:30:00", resolveDescriptorForAxis(sniffed, CatalogOverlay.RA))).toBe(187.5);
            expect(parseCoordinateValue("12:30:00", resolveDescriptorForAxis(sniffed, CatalogOverlay.GLON))).toBe(12.5);
            expect(parseCoordinateValue("12:30:00", resolveDescriptorForAxis(sniffed, CatalogOverlay.ELON))).toBe(12.5);
            expect(parseCoordinateValue("12:30:00", resolveDescriptorForAxis(sniffed, CatalogOverlay.DEC))).toBe(12.5);
        });

        test("declared units outrank the axis", () => {
            const declared = getCoordinateDescriptorFromUnits("dms") as CoordinateDescriptor;
            expect(parseCoordinateValue("12:30:00", resolveDescriptorForAxis(declared, CatalogOverlay.RA))).toBe(12.5);
        });
    });

    describe("the parser itself reports what the string says, without a range policy", () => {
        // Range is not a property of the notation, and longitude genuinely needs no bound: AST's
        // sky-to-pixel transform is periodic in 360 degrees. Latitude is handled at the axis
        // binding, where it is known which of the two a column feeds.
        test.each([
            ["24:00:00", HOUR, 360],
            ["25:00:00", HOUR, 375],
            ["-91:00:00", DEGREE, -91],
            ["+95:00:00", DEGREE, 95],
            ["400", DECIMAL_DEGREE, 400]
        ])("passes %s through as %f", (value, format, expected) => {
            expect(readDegrees(value as string, format as ColumnFormat)).toBeCloseTo(expected as number, 9);
        });
    });

    describe("latitude range", () => {
        test("only latitude axes are bounded", () => {
            expect(isCatalogLatitudeAxis(CatalogOverlay.DEC)).toBe(true);
            expect(isCatalogLatitudeAxis(CatalogOverlay.GLAT)).toBe(true);
            expect(isCatalogLatitudeAxis(CatalogOverlay.ELAT)).toBe(true);

            // Longitudes wrap on their own inside AST, and pixel axes have no bound at all.
            expect(isCatalogLatitudeAxis(CatalogOverlay.RA)).toBe(false);
            expect(isCatalogLatitudeAxis(CatalogOverlay.GLON)).toBe(false);
            expect(isCatalogLatitudeAxis(CatalogOverlay.ELON)).toBe(false);
            expect(isCatalogLatitudeAxis(CatalogOverlay.X0)).toBe(false);
            expect(isCatalogLatitudeAxis(CatalogOverlay.Y0)).toBe(false);
            expect(isCatalogLatitudeAxis(CatalogOverlay.X1)).toBe(false);
            expect(isCatalogLatitudeAxis(CatalogOverlay.Y1)).toBe(false);
        });

        test("keeps the poles, which are real positions", () => {
            expect(rejectOutOfRangeLatitude(90)).toBe(90);
            expect(rejectOutOfRangeLatitude(-90)).toBe(-90);
            expect(rejectOutOfRangeLatitude(0)).toBe(0);
            expect(rejectOutOfRangeLatitude(-0.0002777777777777778)).toBe(-0.0002777777777777778);
        });

        test("drops anything beyond a pole", () => {
            expect(rejectOutOfRangeLatitude(90.000001)).toBeNaN();
            expect(rejectOutOfRangeLatitude(-90.000001)).toBeNaN();
            expect(rejectOutOfRangeLatitude(91)).toBeNaN();
            expect(rejectOutOfRangeLatitude(-91)).toBeNaN();
            expect(rejectOutOfRangeLatitude(270)).toBeNaN();
        });

        test("leaves an already-unparseable value as NaN", () => {
            expect(rejectOutOfRangeLatitude(NaN)).toBeNaN();
        });
    });
});

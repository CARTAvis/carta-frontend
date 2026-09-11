/**
 * Checks the hand-written catalog coordinate parser against AST, which is the reference
 * implementation for sexagesimal astronomy strings.
 *
 * It also records why the parser is hand-written rather than delegated to AST:
 * - AST does not read the CASA dot-separated form, and does not fail on it either. It reads the
 *   leading decimal and stops, so "-021.57.15.4625" comes back as -21.57 -- about two arcminutes
 *   from the truth, with a success status.
 * - The wrapper's `unformat` discards astUnformat's character count, which is the only signal that
 *   separates a full read from a partial one, so trailing garbage is accepted silently too.
 *
 * If either of those is ever fixed, the "documents why AST is not the parser" block below starts
 * failing, which is the intended prompt to revisit the decision.
 */
const AST = require("./build/index.js");
const {parseCoordinateValue} = require("../../src/utilities/catalog/coordinateFormat");

const DEGREES_PER_RADIAN = 180 / Math.PI;
const SENTINEL = 12345.0;
const RA_AXIS = 1;
const DEC_AXIS = 2;
const AST_BAD = -1.7976931348623157e308;

let frameSet;
let valuePointer;

function astUnformat(axis, text) {
    AST.HEAPF64[valuePointer / 8] = SENTINEL;
    const status = AST.unformat(frameSet, axis, text, valuePointer);
    const radians = AST.HEAPF64[valuePointer / 8];
    if (status !== 0 || radians === SENTINEL) {
        return NaN;
    }
    return radians * DEGREES_PER_RADIAN;
}

/** A gnomonic (TAN) frame set whose tangent point is the given sky position. */
function createSkyFrameSet(referenceRa, referenceDec) {
    const quote = String.fromCharCode(39);
    const fitsChan = AST.emptyFitsChan();
    [
        "NAXIS   = 2",
        "NAXIS1  = 100",
        "NAXIS2  = 100",
        `CTYPE1  = ${quote}RA---TAN${quote}`,
        `CTYPE2  = ${quote}DEC--TAN${quote}`,
        `CUNIT1  = ${quote}deg${quote}`,
        `CUNIT2  = ${quote}deg${quote}`,
        "CRPIX1  = 50",
        "CRPIX2  = 50",
        `CRVAL1  = ${referenceRa}`,
        `CRVAL2  = ${referenceDec}`,
        "CDELT1  = -0.001",
        "CDELT2  = 0.001",
        `RADESYS = ${quote}ICRS${quote}`,
        "EQUINOX = 2000.0"
    ].forEach(card => AST.putFits(fitsChan, card));
    return AST.getFrameFromFitsChan(fitsChan, false);
}

beforeAll(async () => {
    await AST.onReady;
    frameSet = createSkyFrameSet(187.5, -21.9);
    valuePointer = AST._malloc(8);
});

describe("catalog coordinate parser against the AST oracle", () => {
    // AST decides hours vs degrees from the axis (AsTime), which is the same decision our
    // descriptor's fieldUnit carries. Pairing each case with an axis makes them comparable.
    const hourCases = ["12h30m00s", "12:30:00", "12 30 00", "10h00m00s", "01:02:03", "23:59:59.99", "12:30", "0:00:01", "20 54 05.689", "20  54  05.689", "20 : 54 : 05.689", "20H54M05.689S", "15h17m", "1:2:3.4"];
    const degreeCases = [
        "-21:57:15.4625",
        "+02d28m35.6412s",
        "-00:30:00",
        "45:00:00",
        "-89:59:59.9",
        "12d30m00s",
        "0:00:01",
        "+37 01 17.38",
        "275:11:15.6954",
        "275d11m15.6954s",
        "-11d10m",
        "-00:12:34.5",
        "-00:00:01",
        "+90:00:00",
        "-90:00:00"
    ];

    test.each(hourCases)("reads %s the same way AST reads it on an hour axis", text => {
        const expected = astUnformat(RA_AXIS, text);
        expect(Number.isFinite(expected)).toBe(true);
        expect(parseCoordinateValue(text, {kind: "sexagesimal", fieldUnit: "hour", source: "units"})).toBeCloseTo(expected, 9);
    });

    test.each(degreeCases)("reads %s the same way AST reads it on a degree axis", text => {
        const expected = astUnformat(DEC_AXIS, text);
        expect(Number.isFinite(expected)).toBe(true);
        expect(parseCoordinateValue(text, {kind: "sexagesimal", fieldUnit: "degree", source: "units"})).toBeCloseTo(expected, 9);
    });

    test("agrees with AST that an explicit marker beats the axis convention", () => {
        // "12d30m00s" on the RA axis is degrees despite AsTime(1)=1.
        expect(parseCoordinateValue("12d30m00s", {kind: "sexagesimal", fieldUnit: "hour", source: "units"})).toBeCloseTo(astUnformat(RA_AXIS, "12d30m00s"), 9);
        // "12h30m00s" on the Dec axis is hours despite AsTime(2)=0.
        expect(parseCoordinateValue("12h30m00s", {kind: "sexagesimal", fieldUnit: "degree", source: "units"})).toBeCloseTo(astUnformat(DEC_AXIS, "12h30m00s"), 9);
    });

    test("agrees with AST that an out-of-range field is not a coordinate", () => {
        expect(astUnformat(DEC_AXIS, "12:70:00")).toBeNaN();
        expect(parseCoordinateValue("12:70:00", {kind: "sexagesimal", fieldUnit: "degree", source: "units"})).toBeNaN();
    });
});

describe("what the sky-to-pixel transform does with out-of-range coordinates", () => {
    const DEGREES_TO_RADIANS = Math.PI / 180;

    function toPixel(lonDegrees, latDegrees) {
        const result = AST.transformPointArrays(frameSet, new Float64Array([lonDegrees * DEGREES_TO_RADIANS]), new Float64Array([latDegrees * DEGREES_TO_RADIANS]), false);
        return {x: result.x[0], y: result.y[0]};
    }

    test("longitude wraps on its own, so it needs no range handling", () => {
        // Not astNorm -- the projection is trigonometric and so already periodic in 360 degrees.
        const inRange = toPixel(187.6, -21.8);
        [187.6 + 360, 187.6 - 360, 187.6 + 720].forEach(wrapped => {
            const point = toPixel(wrapped, -21.8);
            expect(point.x).toBeCloseTo(inRange.x, 6);
            expect(point.y).toBeCloseTo(inRange.y, 6);
        });
    });

    test("latitude past a pole is not normalized", () => {
        // astNorm would fold 91 to (lon + 180, 89). The transform never consults it.
        const normalized = AST.normalizeCoordinates(frameSet, 187.6 * DEGREES_TO_RADIANS, 91 * DEGREES_TO_RADIANS);
        expect(normalized.y / DEGREES_TO_RADIANS).toBeCloseTo(89, 6);

        // On this frame the same value instead produces a finite pixel a long way off the image.
        expect(Number.isFinite(toPixel(187.6, -91).y)).toBe(true);
        expect(toPixel(187.6, -91).y).toBeLessThan(-1000);
    });

    test("whether a bad latitude is silently misplaced or flagged depends on the image", () => {
        // TAN is undefined more than 90 degrees from its tangent point, so the same corrupt row
        // gives a finite wrong pixel on one image and AST__BAD on another. AST reporting an error
        // is therefore not something a range check can rely on: hence the guard in
        // getCatalogCoordinateData, which drops these before they ever reach the transform.
        const northernFrame = createSkyFrameSet(15, 10);
        const northernPoint = AST.transformPointArrays(northernFrame, new Float64Array([187.6 * DEGREES_TO_RADIANS]), new Float64Array([-91 * DEGREES_TO_RADIANS]), false);

        expect(Number.isFinite(toPixel(187.6, -91).y)).toBe(true);
        expect(northernPoint.y[0]).toBe(AST_BAD);
    });

    test("AST__BAD is not a corruption signal: valid far-hemisphere positions produce it too", () => {
        // The north celestial pole is 111.9 degrees from this frame's tangent point at Dec -21.9,
        // so it is genuinely unprojectable here. A range check cannot remove these, and they reach
        // the render path as -Infinity, which minMaxArray does not skip -- a separate problem from
        // the one the latitude guard addresses.
        expect(toPixel(187.6, 90).y).toBe(AST_BAD);
        expect(Number.isFinite(toPixel(187.6, -90).y)).toBe(true);
        expect(Math.fround(AST_BAD)).toBe(-Infinity);
    });
});

describe("documents why AST is not the parser", () => {
    test("AST silently truncates the CASA dot-separated form", () => {
        // Not a failure in AST: it reads a valid decimal prefix and stops. But the wrapper reports
        // success, so a caller that trusted it would place the source two arcminutes off.
        expect(astUnformat(DEC_AXIS, "-021.57.15.4625")).toBeCloseTo(-21.57, 6);
        expect(parseCoordinateValue("-021.57.15.4625", {kind: "dot-sexagesimal", fieldUnit: "degree", source: "sniffed"})).toBeCloseTo(-21.9542951389, 9);
    });

    test("AST accepts trailing garbage, our parser does not", () => {
        expect(astUnformat(RA_AXIS, "12:30:00 extra")).toBeCloseTo(187.5, 9);
        expect(parseCoordinateValue("12:30:00 extra", {kind: "sexagesimal", fieldUnit: "hour", source: "units"})).toBeNaN();
    });

    test("AST silently truncates the compact separator-free form", () => {
        // "205405.689" is 20h54m05.689s in an ESO-style target list. AST reads the whole run as a
        // decimal value, so it lands 3 million degrees away, again reporting success.
        expect(astUnformat(RA_AXIS, "205405.689")).toBeCloseTo(205405.689 * 15, 4);
        expect(parseCoordinateValue("205405.689", {kind: "sexagesimal", fieldUnit: "hour", source: "units"})).toBeCloseTo(313.52370416666665, 9);
    });

    test("AST truncates at the Unicode angle marks", () => {
        // It stops at the degree sign and keeps the leading field, losing the arcminutes and
        // arcseconds -- 275 instead of 275.1877, about 11 arcminutes off, reported as success.
        expect(astUnformat(DEC_AXIS, "275°11′15.6954″")).toBeCloseTo(275, 9);
        expect(parseCoordinateValue("275°11′15.6954″", {kind: "sexagesimal", fieldUnit: "degree", source: "units"})).toBeCloseTo(275.18769316666664, 9);
    });

    test("AST accepts omitted-field spellings that we reject", () => {
        // AST reads these positionally. Rather than adopt a second, subtly different reading of a
        // colon-separated value, we reject them; catalogs do not write coordinates this way.
        expect(Number.isFinite(astUnformat(DEC_AXIS, ":45:33"))).toBe(true);
        expect(parseCoordinateValue(":45:33", {kind: "sexagesimal", fieldUnit: "degree", source: "units"})).toBeNaN();
        expect(parseCoordinateValue("6::2.5", {kind: "sexagesimal", fieldUnit: "degree", source: "units"})).toBeNaN();
    });

    test("AST reports success for a string it did not read at all", () => {
        // astUnformat leaves the output untouched and sets no error status; only the character
        // count it returns -- which the wrapper drops -- would reveal that nothing was read.
        AST.HEAPF64[valuePointer / 8] = SENTINEL;
        expect(AST.unformat(frameSet, RA_AXIS, "banana", valuePointer)).toBe(0);
        expect(AST.HEAPF64[valuePointer / 8]).toBe(SENTINEL);

        expect(parseCoordinateValue("banana", {kind: "sexagesimal", fieldUnit: "hour", source: "units"})).toBeNaN();
    });
});

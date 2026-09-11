import {CatalogOverlay} from "enums";

import {
    type CoordinateDescriptor,
    getCoordinateDescriptorFromUnits,
    hasCoordinateValuesToInspect,
    normalizeCatalogUnits,
    parseCoordinateValue,
    recognizeCoordinateString,
    type ResolvedCoordinateDescriptor,
    resolveDescriptorForAxis,
    sniffCoordinateDescriptor
} from "./coordinateFormat";

const HOUR_DESCRIPTOR: ResolvedCoordinateDescriptor = {kind: "sexagesimal", fieldUnit: "hour", source: "units"};
const DEGREE_DESCRIPTOR: ResolvedCoordinateDescriptor = {kind: "sexagesimal", fieldUnit: "degree", source: "units"};
const AMBIGUOUS_DESCRIPTOR: CoordinateDescriptor = {kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"};

describe("coordinate format", () => {
    describe("getCoordinateDescriptorFromUnits", () => {
        test("reads sexagesimal units, including repeated-letter spellings", () => {
            expect(getCoordinateDescriptorFromUnits("H:M:S")).toEqual(HOUR_DESCRIPTOR);
            expect(getCoordinateDescriptorFromUnits("hh:mm:ss")).toEqual(HOUR_DESCRIPTOR);
            expect(getCoordinateDescriptorFromUnits("HH:MM:SS.SS")).toEqual(HOUR_DESCRIPTOR);
            expect(getCoordinateDescriptorFromUnits("dms")).toEqual(DEGREE_DESCRIPTOR);
            expect(getCoordinateDescriptorFromUnits("dd:mm:ss.ss")).toEqual(DEGREE_DESCRIPTOR);
        });

        test("reads degree units as a decimal format", () => {
            expect(getCoordinateDescriptorFromUnits("deg")).toEqual({kind: "decimal", fieldUnit: "degree", source: "units"});
            expect(getCoordinateDescriptorFromUnits("degrees")).toEqual({kind: "decimal", fieldUnit: "degree", source: "units"});
        });

        test("rejects units that are not coordinate units", () => {
            expect(getCoordinateDescriptorFromUnits("hmsdms")).toBeUndefined();
            expect(getCoordinateDescriptorFromUnits("pix")).toBeUndefined();
            expect(getCoordinateDescriptorFromUnits("")).toBeUndefined();
            expect(getCoordinateDescriptorFromUnits(null)).toBeUndefined();
        });

        test("never consults a column name", () => {
            // The signature has no room for one. This test documents the intent behind that:
            // names state what a column is meant to be, which is the ranking layer's concern.
            expect(getCoordinateDescriptorFromUnits.length).toBe(1);
        });
    });

    describe("recognizeCoordinateString", () => {
        test("separates true sexagesimal notation from a bare decimal", () => {
            expect(recognizeCoordinateString("12:30:00")?.kind).toBe("sexagesimal");
            expect(recognizeCoordinateString("12 30 00")?.kind).toBe("sexagesimal");
            expect(recognizeCoordinateString("187.5")?.kind).toBe("decimal");
            expect(recognizeCoordinateString("1e2")?.kind).toBe("decimal");
        });

        test("reads an explicit hour or degree marker off the value", () => {
            expect(recognizeCoordinateString("12h30m00s")?.explicitUnit).toBe("hour");
            expect(recognizeCoordinateString("12d30m00s")?.explicitUnit).toBe("degree");
            expect(recognizeCoordinateString("12:30:00")?.explicitUnit).toBeUndefined();
        });

        test("recognizes the CASA dot-separated form as its own kind", () => {
            // Read as a decimal this is -21.57, two arcminutes from the truth. Giving it a
            // distinct kind is what stops it from being silently mistaken for one.
            expect(recognizeCoordinateString("-021.57.15.4625")).toMatchObject({kind: "dot-sexagesimal", isNegative: true});
            expect(recognizeCoordinateString("021.57.15")?.kind).toBe("dot-sexagesimal");
        });

        test("rejects values it cannot read in full", () => {
            expect(recognizeCoordinateString("banana")).toBeUndefined();
            expect(recognizeCoordinateString("12:70:00")).toBeUndefined();
            expect(recognizeCoordinateString("1:2:3:4")).toBeUndefined();
            expect(recognizeCoordinateString("")).toBeUndefined();
            expect(recognizeCoordinateString(null)).toBeUndefined();
        });

        test("lets only the leading field carry a sign", () => {
            // The fields are summed by magnitude, so a sign further along would be dropped and
            // "12:-30:00" would read as 12.5 -- a plausible-looking half degree from nowhere.
            expect(recognizeCoordinateString("12:-30:00")).toBeUndefined();
            expect(recognizeCoordinateString("12:30:-00.5")).toBeUndefined();
            expect(recognizeCoordinateString("12 -30 00")).toBeUndefined();
            expect(recognizeCoordinateString("12:+30:00")).toBeUndefined();
            expect(recognizeCoordinateString("12:-0:30")).toBeUndefined();
            expect(recognizeCoordinateString("12h-30m00s")).toBeUndefined();
        });

        test("still accepts a sign on the leading field", () => {
            expect(recognizeCoordinateString("-12:30:00")).toMatchObject({isNegative: true});
            expect(recognizeCoordinateString("+12:30:00")).toMatchObject({isNegative: false});
        });
    });

    describe("sniffCoordinateDescriptor", () => {
        test("derives a descriptor from the values alone", () => {
            expect(sniffCoordinateDescriptor(["12:30:00", "10:15:30"])).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
            expect(sniffCoordinateDescriptor(["12h30m00s", "10h15m30s"])).toEqual({kind: "sexagesimal", fieldUnit: "hour", source: "sniffed"});
            expect(sniffCoordinateDescriptor(["187.5", "12.25"])).toEqual({kind: "decimal", fieldUnit: "degree", source: "sniffed"});
        });

        test("keeps the CASA dot form out of the decimal bucket", () => {
            expect(sniffCoordinateDescriptor(["-021.57.15.4625", "+003.12.44.1"])).toEqual({kind: "dot-sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
        });

        test("skips empty values rather than failing on them", () => {
            expect(sniffCoordinateDescriptor([null, "", "12:30:00", undefined])).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
        });

        test("reads a padded empty cell as empty, not as an unrecognized value", () => {
            // Fixed-width tables write a missing coordinate as spaces. Failing on one would throw
            // away every other row's evidence and declare the column unreadable.
            expect(sniffCoordinateDescriptor(["12:30:00", "   ", "10:15:30"])).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
            expect(sniffCoordinateDescriptor(["\t", "12:30:00"])).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
            expect(sniffCoordinateDescriptor(["\u0000", "12:30:00"])).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
        });

        test("gives up rather than guessing", () => {
            expect(sniffCoordinateDescriptor(["banana"])).toBeUndefined();
            expect(sniffCoordinateDescriptor(["12:30:00", "banana"])).toBeUndefined();
            expect(sniffCoordinateDescriptor(["12:30:00", "187.5"])).toBeUndefined();
            expect(sniffCoordinateDescriptor([])).toBeUndefined();
            expect(sniffCoordinateDescriptor([null, ""])).toBeUndefined();
            expect(sniffCoordinateDescriptor(undefined)).toBeUndefined();
        });

        test("only inspects up to the sample size", () => {
            const values = ["12:30:00", ...new Array(500).fill("banana")];
            expect(sniffCoordinateDescriptor(values, 1)).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
        });
    });

    describe("hasCoordinateValuesToInspect", () => {
        test("separates a sample with nothing in it from one that was read and rejected", () => {
            expect(hasCoordinateValuesToInspect(["banana"])).toBe(true);
            expect(hasCoordinateValuesToInspect([null, "", "12:30:00"])).toBe(true);
            expect(hasCoordinateValuesToInspect([0])).toBe(true);

            expect(hasCoordinateValuesToInspect([])).toBe(false);
            expect(hasCoordinateValuesToInspect(undefined)).toBe(false);
            expect(hasCoordinateValuesToInspect([null, undefined, ""])).toBe(false);
            expect(hasCoordinateValuesToInspect(["  ", "\t", "\u0000"])).toBe(false);
        });

        test("looks no further than the sniffer would", () => {
            const values = [...new Array(500).fill(""), "12:30:00"];
            expect(hasCoordinateValuesToInspect(values, 1)).toBe(false);
            expect(hasCoordinateValuesToInspect(values, 100)).toBe(true);
        });
    });

    describe("resolveDescriptorForAxis", () => {
        test("scales an ambiguous value by the axis it was bound to", () => {
            expect(resolveDescriptorForAxis(AMBIGUOUS_DESCRIPTOR, CatalogOverlay.RA).fieldUnit).toBe("hour");
            expect(resolveDescriptorForAxis(AMBIGUOUS_DESCRIPTOR, CatalogOverlay.DEC).fieldUnit).toBe("degree");
            expect(resolveDescriptorForAxis(AMBIGUOUS_DESCRIPTOR, CatalogOverlay.GLON).fieldUnit).toBe("degree");
            expect(resolveDescriptorForAxis(AMBIGUOUS_DESCRIPTOR, CatalogOverlay.X0).fieldUnit).toBe("degree");
        });

        test("leaves a descriptor that already knows its scaling alone", () => {
            expect(resolveDescriptorForAxis(HOUR_DESCRIPTOR, CatalogOverlay.DEC)).toEqual(HOUR_DESCRIPTOR);
            expect(resolveDescriptorForAxis(DEGREE_DESCRIPTOR, CatalogOverlay.RA)).toEqual(DEGREE_DESCRIPTOR);
        });
    });

    describe("parseCoordinateValue", () => {
        test("converts sexagesimal values to degrees", () => {
            expect(parseCoordinateValue("12:30:00", HOUR_DESCRIPTOR)).toBe(187.5);
            expect(parseCoordinateValue("12:30", HOUR_DESCRIPTOR)).toBe(187.5);
            expect(parseCoordinateValue("-12:30:00", DEGREE_DESCRIPTOR)).toBe(-12.5);
            expect(parseCoordinateValue("-00:30:00", DEGREE_DESCRIPTOR)).toBe(-0.5);
            expect(parseCoordinateValue("+02d28m35.6412s", DEGREE_DESCRIPTOR)).toBeCloseTo(2.476567, 6);
        });

        test("converts the CASA dot form", () => {
            expect(parseCoordinateValue("-021.57.15.4625", {kind: "dot-sexagesimal", fieldUnit: "degree", source: "sniffed"})).toBeCloseTo(-21.9542951389, 10);
        });

        test("lets an explicit marker in the value override the descriptor", () => {
            expect(parseCoordinateValue("12h30m00s", DEGREE_DESCRIPTOR)).toBe(187.5);
            expect(parseCoordinateValue("12d30m00s", HOUR_DESCRIPTOR)).toBe(12.5);
            expect(parseCoordinateValue("-00D30M00S", HOUR_DESCRIPTOR)).toBe(-0.5);
            expect(parseCoordinateValue("12d", HOUR_DESCRIPTOR)).toBe(12);
            expect(parseCoordinateValue("12h", DEGREE_DESCRIPTOR)).toBe(180);
        });

        test("scales a bare decimal by the descriptor, never by a guess", () => {
            expect(parseCoordinateValue("12.5", HOUR_DESCRIPTOR)).toBe(187.5);
            expect(parseCoordinateValue("12.5", DEGREE_DESCRIPTOR)).toBe(12.5);
            expect(parseCoordinateValue("150.123456", DEGREE_DESCRIPTOR)).toBe(150.123456);
            expect(parseCoordinateValue("-12.5", DEGREE_DESCRIPTOR)).toBe(-12.5);
        });

        test("tolerates the null padding found in some catalog files", () => {
            expect(parseCoordinateValue("12h30m00s\0", DEGREE_DESCRIPTOR)).toBe(187.5);
            expect(parseCoordinateValue("123.45\0", {kind: "decimal", fieldUnit: "degree", source: "units"})).toBe(123.45);
        });

        test("returns NaN for anything it cannot read", () => {
            expect(parseCoordinateValue("invalid", DEGREE_DESCRIPTOR)).toBeNaN();
            expect(parseCoordinateValue("12:70:00", DEGREE_DESCRIPTOR)).toBeNaN();
            expect(parseCoordinateValue("12:-30:00", DEGREE_DESCRIPTOR)).toBeNaN();
            expect(parseCoordinateValue(null, DEGREE_DESCRIPTOR)).toBeNaN();
            expect(parseCoordinateValue("", DEGREE_DESCRIPTOR)).toBeNaN();
        });
    });

    describe("normalizeCatalogUnits", () => {
        test("strips separators and case", () => {
            expect(normalizeCatalogUnits("H:M:S")).toBe("hms");
            expect(normalizeCatalogUnits(" Deg ")).toBe("deg");
            expect(normalizeCatalogUnits(null)).toBeUndefined();
        });
    });
});

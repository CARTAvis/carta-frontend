import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType, NumberFormatType} from "enums";

import {
    CATALOG_NUMERIC_FORMAT,
    findAutoSelectedCatalogAxisColumn,
    getCatalogCoordinateFormat,
    getCatalogDataTypeDisplayName,
    isCatalogAxisDataType,
    isCatalogCoordinateDataType,
    isExcludedCoordinateName,
    parseCatalogCoordinateValue
} from "./catalog";

describe("catalog utilities", () => {
    describe("isCatalogAxisDataType", () => {
        test("accepts numeric catalog column types", () => {
            expect(isCatalogAxisDataType(CARTA.ColumnType.Double)).toBe(true);
            expect(isCatalogAxisDataType(CARTA.ColumnType.Float)).toBe(true);
            expect(isCatalogAxisDataType(CARTA.ColumnType.Int32)).toBe(true);
            expect(isCatalogAxisDataType(CARTA.ColumnType.String)).toBe(false);
            expect(isCatalogAxisDataType(CARTA.ColumnType.Bool)).toBe(false);
            expect(isCatalogAxisDataType(undefined)).toBe(false);
        });
    });

    describe("coordinate catalog columns", () => {
        test("recognizes sexagesimal units and equatorial names", () => {
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "H:M:S")).toBe("hms");
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "dms")).toBe("dms");
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "RA1")).toBe("hms");
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "DEC1")).toBe("dms");
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "H:M:S", "GLON1")).toBeUndefined();
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "D:M:S", "GLAT1")).toBe("dms");
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.Double, "H:M:S")).toBeUndefined();
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "deg")).toBe(NumberFormatType.Degrees);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "RA_error")).toBeUndefined();
        });

        test("recognizes sexagesimal units written with repeated letters", () => {
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "hh:mm:ss", "RA1")).toBe(NumberFormatType.HMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "HH:MM:SS.SS", "RA1")).toBe(NumberFormatType.HMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "dd:mm:ss", "DEC1")).toBe(NumberFormatType.DMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "dd:mm:ss.ss", "DEC1")).toBe(NumberFormatType.DMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "hours", "RA1")).toBeUndefined();
            expect(parseCatalogCoordinateValue("12.5", NumberFormatType.HMS, "hh:mm:ss")).toBe(187.5);
        });

        test("recognizes galactic, ecliptic, and pixel coordinate column names", () => {
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "GLON1")).toBe(NumberFormatType.DMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "GLAT1")).toBe(NumberFormatType.DMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "ELON1")).toBe(NumberFormatType.DMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "ELAT1")).toBe(NumberFormatType.DMS);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "xcentroid")).toBe(CATALOG_NUMERIC_FORMAT);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "X_IMAGE")).toBe(CATALOG_NUMERIC_FORMAT);
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, "deg", "GLON1")).toBe(NumberFormatType.Degrees);
        });

        test("matches string columns to their corresponding coordinate axis", () => {
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "hms", CatalogOverlay.RA)).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "dms", CatalogOverlay.DEC)).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "hms", CatalogOverlay.GLON)).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "dms", CatalogOverlay.GLAT)).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "dms", CatalogOverlay.RA)).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "hms", CatalogOverlay.DEC)).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.GLON, "GLON1")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.GLAT, "GLAT1")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.ELON, "ELON1")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.ELAT, "ELAT1")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "dms", CatalogOverlay.ELON, "ELAT2")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "dms", CatalogOverlay.ELAT, "ELON2")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "deg", CatalogOverlay.ELON, "ELAT2")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.X0, "xcentroid")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.X1, "X_IMAGE")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "deg", CatalogOverlay.X0, "xcentroid")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "deg", CatalogOverlay.X1, "x_image")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "", CatalogOverlay.X0, "GLON1")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, "", CatalogOverlay.X0, "GLON1")).toBe(false);
        });

        test.each([
            ["RADEC", "hmsdms", CatalogOverlay.RA],
            ["GAL", "dmsdms", CatalogOverlay.GLON],
            ["ECL", "dmsdms", CatalogOverlay.ELON]
        ])("does not treat combined %s strings as a single coordinate axis", (columnName, units, axis) => {
            expect(getCatalogCoordinateFormat(CARTA.ColumnType.String, units, columnName)).toBeUndefined();
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.String, units, axis, columnName)).toBe(false);
        });

        test("keeps every angular unit out of the pixel coordinate axes", () => {
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "arcsec", CatalogOverlay.X0, "flux")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "arcsecond", CatalogOverlay.Y0, "flux")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "arcmin", CatalogOverlay.X1, "flux")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "hh:mm:ss", CatalogOverlay.X0, "flux")).toBe(false);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "pix", CatalogOverlay.X0, "flux")).toBe(true);
            expect(isCatalogCoordinateDataType(CARTA.ColumnType.Double, "arcsec", CatalogOverlay.RA, "flux")).toBe(true);
        });

        test("converts coordinate values to degrees", () => {
            expect(parseCatalogCoordinateValue("12:30:00", NumberFormatType.HMS)).toBe(187.5);
            expect(parseCatalogCoordinateValue("-12:30:00", NumberFormatType.DMS)).toBe(-12.5);
            expect(parseCatalogCoordinateValue("12h30m00s", NumberFormatType.HMS)).toBe(187.5);
            expect(parseCatalogCoordinateValue("10h00m00s", NumberFormatType.HMS)).toBe(150);
            expect(parseCatalogCoordinateValue("+02d28m35.6412s", NumberFormatType.DMS)).toBeCloseTo(2.476567, 6);
            expect(parseCatalogCoordinateValue("12h30m00s\0", NumberFormatType.HMS)).toBe(187.5);
            expect(parseCatalogCoordinateValue("12.5", NumberFormatType.Degrees)).toBe(12.5);
            expect(parseCatalogCoordinateValue("123.45\0", CATALOG_NUMERIC_FORMAT)).toBe(123.45);
            expect(parseCatalogCoordinateValue("invalid", NumberFormatType.DMS)).toBeNaN();
        });

        test("reads bare decimals in name-inferred hms columns as degrees", () => {
            expect(parseCatalogCoordinateValue("150.123456", NumberFormatType.HMS)).toBe(150.123456);
            expect(parseCatalogCoordinateValue("1e2", NumberFormatType.HMS)).toBe(100);
            expect(parseCatalogCoordinateValue("-12.5", NumberFormatType.HMS)).toBe(-12.5);
            expect(parseCatalogCoordinateValue("12h", NumberFormatType.HMS)).toBe(180);
            expect(parseCatalogCoordinateValue("12:30", NumberFormatType.HMS)).toBe(187.5);
        });

        test("preserves explicit degree notation in name-inferred RA columns", () => {
            const format = getCatalogCoordinateFormat(CARTA.ColumnType.String, "", "RA1")!;

            expect(parseCatalogCoordinateValue("12d30m00s", format)).toBe(12.5);
            expect(parseCatalogCoordinateValue("-00D30M00S", format)).toBe(-0.5);
            expect(parseCatalogCoordinateValue("12d", format)).toBe(12);
            expect(parseCatalogCoordinateValue("12h30m00s", format)).toBe(187.5);
            expect(parseCatalogCoordinateValue("12:30:00", format)).toBe(187.5);
        });

        test("reads bare decimals in declared hms columns as hours", () => {
            expect(parseCatalogCoordinateValue("12.5", NumberFormatType.HMS, "h:m:s")).toBe(187.5);
            expect(parseCatalogCoordinateValue("12.5", NumberFormatType.HMS)).toBe(12.5);
            expect(parseCatalogCoordinateValue("12:30:00", NumberFormatType.HMS, "h:m:s")).toBe(187.5);
            expect(parseCatalogCoordinateValue("-00:30:00", NumberFormatType.DMS)).toBe(-0.5);
            expect(parseCatalogCoordinateValue("45.5", NumberFormatType.DMS)).toBe(45.5);
        });
    });

    describe("isExcludedCoordinateName", () => {
        test("excludes coordinate-error tokens but not similar words", () => {
            expect(isExcludedCoordinateName("deterrence")).toBe(false);
            expect(isExcludedCoordinateName("design")).toBe(false);
            expect(isExcludedCoordinateName("ra_error")).toBe(true);
            expect(isExcludedCoordinateName("sigma_ra")).toBe(true);
            expect(isExcludedCoordinateName("pmdec")).toBe(true);
            expect(isExcludedCoordinateName("raOffset")).toBe(true);
        });
    });

    describe("findAutoSelectedCatalogAxisColumn", () => {
        test("respects equatorial coordinate system priority", () => {
            const axisOptions = ["RAJ2000", "RA_ICRS", "RAB1950", "ra"];

            expect(findAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, CatalogOverlay.NONE, axisOptions, CatalogSystemType.FK4)).toBe("RAB1950");
            expect(findAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, CatalogOverlay.NONE, axisOptions, CatalogSystemType.FK5)).toBe("RAJ2000");
            expect(findAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, CatalogOverlay.NONE, axisOptions, CatalogSystemType.ICRS)).toBe("RA_ICRS");
        });

        test("limits ICRS compatibility with FK5 epoch columns to J2000", () => {
            expect(findAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, CatalogOverlay.NONE, ["RAJ2021", "ra", "RAJ2000"], CatalogSystemType.ICRS)).toBe("RAJ2000");
            expect(findAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, CatalogOverlay.NONE, ["RAJ2021"], CatalogSystemType.ICRS)).toBeUndefined();
        });

        test("does not replace an existing axis selection", () => {
            expect(findAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, "ra", ["RAJ2000"], CatalogSystemType.FK5)).toBeUndefined();
        });
    });

    describe("getCatalogDataTypeDisplayName", () => {
        test("keeps catalog overlay header labels stable", () => {
            expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.Uint8)).toBe("unsigned byte");
            expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.Int16)).toBe("short");
            expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.Double)).toBe("double");
            expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.UnsupportedType)).toBe("unsupported");
        });
    });
});

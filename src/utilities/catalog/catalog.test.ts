import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType} from "enums";

import {findAutoSelectedCatalogAxisColumn, getCatalogDataTypeDisplayName, isCatalogAxisDataType, isExcludedCoordinateName} from "./catalog";

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

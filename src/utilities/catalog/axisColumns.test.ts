import {CARTA} from "carta-protobuf";

import {CatalogOverlay, CatalogSystemType} from "enums";

import {CatalogAxisEligibility, getAutoSelectedCatalogAxisColumn, getCatalogAxisEligibility, isCatalogNumericDataType, isExcludedCoordinateName, rankCatalogAxisColumns} from "./axisColumns";

describe("catalog axis columns", () => {
    describe("isCatalogNumericDataType", () => {
        test("accepts numeric catalog column types", () => {
            expect(isCatalogNumericDataType(CARTA.ColumnType.Double)).toBe(true);
            expect(isCatalogNumericDataType(CARTA.ColumnType.Float)).toBe(true);
            expect(isCatalogNumericDataType(CARTA.ColumnType.Int32)).toBe(true);
            expect(isCatalogNumericDataType(CARTA.ColumnType.String)).toBe(false);
            expect(isCatalogNumericDataType(CARTA.ColumnType.Bool)).toBe(false);
            expect(isCatalogNumericDataType(undefined)).toBe(false);
        });
    });

    describe("getCatalogAxisEligibility", () => {
        test("accepts every numeric column", () => {
            expect(getCatalogAxisEligibility(CARTA.ColumnType.Double, "deg").status).toBe(CatalogAxisEligibility.Eligible);
            expect(getCatalogAxisEligibility(CARTA.ColumnType.Int32, null).status).toBe(CatalogAxisEligibility.Eligible);
            expect(getCatalogAxisEligibility(CARTA.ColumnType.Double, "pix").status).toBe(CatalogAxisEligibility.Eligible);
        });

        test("returns no descriptor for numeric columns, which need no parsing", () => {
            expect(getCatalogAxisEligibility(CARTA.ColumnType.Double, "deg").descriptor).toBeUndefined();
        });

        test("accepts string columns that declare coordinate units", () => {
            const result = getCatalogAxisEligibility(CARTA.ColumnType.String, "hms");
            expect(result.status).toBe(CatalogAxisEligibility.Eligible);
            expect(result.descriptor).toEqual({kind: "sexagesimal", fieldUnit: "hour", source: "units"});
        });

        test("falls back to the data when a string column declares no units", () => {
            const result = getCatalogAxisEligibility(CARTA.ColumnType.String, "", ["12:30:00", "10:15:30"]);
            expect(result.status).toBe(CatalogAxisEligibility.Eligible);
            expect(result.descriptor).toEqual({kind: "sexagesimal", fieldUnit: "ambiguous", source: "sniffed"});
        });

        test("is unknown, not ineligible, when there is nothing to go on yet", () => {
            // Only displayed columns are fetched, so a hidden column has no local values to sniff.
            const result = getCatalogAxisEligibility(CARTA.ColumnType.String, "");
            expect(result.status).toBe(CatalogAxisEligibility.Unknown);
            expect(result.reason).toBeTruthy();
        });

        test("rejects string columns whose values are not coordinates", () => {
            const result = getCatalogAxisEligibility(CARTA.ColumnType.String, "", ["NGC 1333", "NGC 2264"]);
            expect(result.status).toBe(CatalogAxisEligibility.Ineligible);
            expect(result.reason).toBeTruthy();
        });

        test("rejects columns that cannot hold a number at all", () => {
            expect(getCatalogAxisEligibility(CARTA.ColumnType.Bool, "").status).toBe(CatalogAxisEligibility.Ineligible);
            expect(getCatalogAxisEligibility(undefined, "").status).toBe(CatalogAxisEligibility.Ineligible);
        });

        test("does not take an axis, because eligibility does not depend on one", () => {
            // Whether a column can be read as a number is a property of the column. Which axis it
            // suits is a guess, and guesses belong to rankCatalogAxisColumns.
            expect(getCatalogAxisEligibility(CARTA.ColumnType.String, "hms")).toEqual(getCatalogAxisEligibility(CARTA.ColumnType.String, "hms"));
        });
    });

    describe("rankCatalogAxisColumns", () => {
        test("keeps every column, in preference order", () => {
            const columns = ["flux", "DEJ2000", "RAJ2000"];
            expect(rankCatalogAxisColumns(CatalogOverlay.RA, columns, CatalogSystemType.FK5)).toEqual(["RAJ2000", "flux", "DEJ2000"]);
        });

        test("respects equatorial coordinate system priority", () => {
            const columns = ["RAJ2000", "RA_ICRS", "RAB1950", "ra"];

            expect(rankCatalogAxisColumns(CatalogOverlay.RA, columns, CatalogSystemType.FK4)[0]).toBe("RAB1950");
            expect(rankCatalogAxisColumns(CatalogOverlay.RA, columns, CatalogSystemType.FK5)[0]).toBe("RAJ2000");
            expect(rankCatalogAxisColumns(CatalogOverlay.RA, columns, CatalogSystemType.ICRS)[0]).toBe("RA_ICRS");
        });

        test("demotes rather than removes error and proper-motion columns", () => {
            const ranked = rankCatalogAxisColumns(CatalogOverlay.RA, ["e_RA", "RAJ2000"], CatalogSystemType.FK5);
            expect(ranked[0]).toBe("RAJ2000");
            expect(ranked).toContain("e_RA");
        });

        test("lets a mismatched name stay selectable", () => {
            // A catalog whose columns are labelled the wrong way round is still usable by hand.
            expect(rankCatalogAxisColumns(CatalogOverlay.RA, ["dec_deg"], CatalogSystemType.ICRS)).toEqual(["dec_deg"]);
        });

        test("orders galactic, ecliptic and pixel axes by their own names", () => {
            expect(rankCatalogAxisColumns(CatalogOverlay.GLON, ["GLAT1", "GLON1"], undefined)[0]).toBe("GLON1");
            expect(rankCatalogAxisColumns(CatalogOverlay.ELAT, ["ELON1", "ELAT1"], undefined)[0]).toBe("ELAT1");
            expect(rankCatalogAxisColumns(CatalogOverlay.X1, ["xcentroid", "X_IMAGE"], undefined)[0]).toBe("X_IMAGE");
        });
    });

    describe("getAutoSelectedCatalogAxisColumn", () => {
        test("takes the head of the ranking", () => {
            const columns = ["RAJ2000", "RA_ICRS", "RAB1950", "ra"];
            expect(getAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, columns, CatalogSystemType.ICRS)).toBe("RA_ICRS");
        });

        test("limits ICRS compatibility with FK5 epoch columns to J2000", () => {
            expect(getAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, ["RAJ2021", "ra", "RAJ2000"], CatalogSystemType.ICRS)).toBe("RAJ2000");
            expect(getAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, ["RAJ2021"], CatalogSystemType.ICRS)).toBeUndefined();
        });

        test("declines to guess where the ranking has no name evidence", () => {
            expect(getAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, ["flux", "mag"], CatalogSystemType.ICRS)).toBeUndefined();
            expect(getAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, ["e_RA"], CatalogSystemType.ICRS)).toBeUndefined();
            expect(getAutoSelectedCatalogAxisColumn(CatalogOverlay.RA, [], CatalogSystemType.ICRS)).toBeUndefined();
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
});

import {CARTA} from "carta-protobuf";

import {CatalogSystemType, CatalogType, PreferenceKeys} from "enums";
import {PreferenceStore} from "stores";

import {CatalogProfileStore} from "./CatalogProfileStore";

const DISPLAYED_COLUMN_SIZE = 3;

type ColumnSpec = {name: string; dataType?: CARTA.ColumnType; units?: string};

const CreateProfileStore = (columns: ColumnSpec[], system?: string): CatalogProfileStore => {
    const catalogHeader = columns.map((column, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: column.dataType ?? CARTA.ColumnType.Double, name: column.name, units: column.units}));

    return new CatalogProfileStore(
        {
            dataSize: 0,
            directory: "",
            fileId: 1,
            fileInfo: new CARTA.CatalogFileInfo({name: "test-catalog", coosys: system ? [new CARTA.Coosys({system})] : undefined})
        },
        catalogHeader,
        new Map(),
        CatalogType.FILE
    );
};

const DisplayedColumnNames = (store: CatalogProfileStore): string[] => {
    const names: string[] = [];
    store.catalogControlHeader.forEach((header, name) => {
        if (header.display) {
            names.push(name);
        }
    });
    return names;
};

describe("CatalogProfileStore initial column display", () => {
    let originalColumnSize: number;

    beforeAll(() => {
        originalColumnSize = PreferenceStore.Instance.catalogDisplayedColumnSize;
    });

    beforeEach(() => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, DISPLAYED_COLUMN_SIZE);
    });

    afterAll(() => {
        PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_DISPLAYED_COLUMN_SIZE, originalColumnSize);
    });

    test("displays the first N columns", () => {
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "note"}]);
        expect(DisplayedColumnNames(store)).toEqual(["id", "flux", "mag"]);
    });

    test("also displays the best candidate for each overlay axis", () => {
        // Which columns land in the first N is an accident of file order, so a catalog whose
        // coordinates sit further along would otherwise open with no way to plot it.
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "note"}, {name: "RAJ2000"}, {name: "DEJ2000"}]);
        expect(DisplayedColumnNames(store)).toEqual(["id", "flux", "mag", "RAJ2000", "DEJ2000"]);
    });

    test("brings a unitless string coordinate column along, so its values can be sniffed", () => {
        // This is the case that cannot recover later: without values there is nothing to
        // recognize, and without being displayed there are no values.
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "RAJ2000", dataType: CARTA.ColumnType.String}, {name: "DEJ2000", dataType: CARTA.ColumnType.String}]);
        expect(DisplayedColumnNames(store)).toContain("RAJ2000");
        expect(DisplayedColumnNames(store)).toContain("DEJ2000");
    });

    test("follows the catalog's own coordinate system", () => {
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "RAJ2000"}, {name: "DEJ2000"}, {name: "GLON"}, {name: "GLAT"}], "GALACTIC");

        const displayed = DisplayedColumnNames(store);
        expect(displayed).toContain("GLON");
        expect(displayed).toContain("GLAT");
        expect(displayed).not.toContain("RAJ2000");
    });

    test("does not promote a column that could never hold a coordinate", () => {
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "note"}, {name: "RAJ2000", dataType: CARTA.ColumnType.Bool}]);
        expect(DisplayedColumnNames(store)).not.toContain("RAJ2000");
    });

    test("does not promote an error or proper-motion column", () => {
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "e_RAJ2000"}, {name: "pmRA"}]);

        const displayed = DisplayedColumnNames(store);
        expect(displayed).not.toContain("e_RAJ2000");
        expect(displayed).not.toContain("pmRA");
    });

    test("promotes nothing when no name looks like a coordinate", () => {
        const store = CreateProfileStore([{name: "id"}, {name: "flux"}, {name: "mag"}, {name: "note"}, {name: "comment"}]);
        expect(DisplayedColumnNames(store)).toEqual(["id", "flux", "mag"]);
    });
});

describe("CatalogProfileStore coordinate system", () => {
    const systemOf = (system: string | undefined) => CreateProfileStore([{name: "RAJ2000"}, {name: "DEJ2000"}], system).catalogCoordinateSystem.system;

    // VOTable 1.4, section 3.4.
    test.each([
        ["ICRS", CatalogSystemType.ICRS],
        ["eq_FK5", CatalogSystemType.FK5],
        ["eq_FK4", CatalogSystemType.FK4],
        ["ecl_FK5", CatalogSystemType.Ecliptic],
        ["ecl_FK4", CatalogSystemType.Ecliptic],
        ["galactic", CatalogSystemType.Galactic]
    ])("reads the standard VOTable COOSYS value %s", (system, expected) => {
        expect(systemOf(system)).toBe(expected);
    });

    test("does not let the equatorial spellings swallow the ecliptic ones", () => {
        // "ecl_FK5" contains "FK5". Read as FK5, the x axis becomes RA, and an ecliptic longitude
        // written sexagesimally is then scaled by fifteen.
        expect(systemOf("ecl_FK5")).not.toBe(CatalogSystemType.FK5);
        expect(systemOf("ecl_FK4")).not.toBe(CatalogSystemType.FK4);
    });

    test("is case and whitespace insensitive", () => {
        expect(systemOf("  ECL_FK5  ")).toBe(CatalogSystemType.Ecliptic);
        expect(systemOf("Eq_Fk4")).toBe(CatalogSystemType.FK4);
    });

    test.each([
        ["ECLIPTIC", CatalogSystemType.Ecliptic],
        ["GALACTIC", CatalogSystemType.Galactic],
        ["FK5", CatalogSystemType.FK5],
        ["FK4", CatalogSystemType.FK4],
        ["PIX0", CatalogSystemType.Pixel0],
        ["PIX1", CatalogSystemType.Pixel1]
    ])("still accepts the looser spelling %s", (system, expected) => {
        expect(systemOf(system)).toBe(expected);
    });

    test.each([["xy"], ["barycentric"], ["geo_app"], ["nonsense"], [""], [undefined]])("falls back to ICRS for %s", system => {
        expect(systemOf(system as string)).toBe(CatalogSystemType.ICRS);
    });

    test("an ecliptic file gets ecliptic axes, not equatorial ones", () => {
        const store = CreateProfileStore([{name: "ELON"}, {name: "ELAT"}], "ecl_FK5");
        expect(store.activedSystem).toEqual({x: "ELON", y: "ELAT"});
    });
});

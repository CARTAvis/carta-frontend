import {CARTA} from "carta-protobuf";

import {CatalogType, PreferenceKeys} from "enums";
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

import {CARTA} from "carta-protobuf";

import {getCatalogDataTypeDisplayName} from "./columnTypeLabel";

describe("getCatalogDataTypeDisplayName", () => {
    test("keeps catalog overlay header labels stable", () => {
        expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.Uint8)).toBe("unsigned byte");
        expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.Int16)).toBe("short");
        expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.Double)).toBe("double");
        expect(getCatalogDataTypeDisplayName(CARTA.ColumnType.UnsupportedType)).toBe("unsupported");
    });
});

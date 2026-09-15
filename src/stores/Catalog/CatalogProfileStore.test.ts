import {CARTA} from "carta-protobuf";

import {CatalogType} from "enums";
import {CatalogProfileStore} from "stores";

describe("CatalogProfileStore column update streams", () => {
    test("keeps column-update mode through intermediate chunks", () => {
        const profileStore = new CatalogProfileStore(
            {dataSize: 4, directory: "", fileId: 1, fileInfo: new CARTA.CatalogFileInfo({name: "catalog"})},
            [new CARTA.CatalogHeader({columnIndex: 0, dataType: CARTA.ColumnType.Double, name: "value"})],
            new Map([[0, {dataType: CARTA.ColumnType.Double, data: Float64Array.from([1, 2, 3, 4])}]]),
            CatalogType.FILE
        );
        profileStore.setIsUpdateColumn(true);

        profileStore.updateCatalogData(
            {
                fileId: 1,
                filterDataSize: 4,
                progress: 0,
                requestEndIndex: 4,
                subsetDataSize: 1,
                subsetEndIndex: 1
            } as CARTA.CatalogFilterResponse,
            new Map([[0, {dataType: CARTA.ColumnType.Double, data: Float64Array.from([5])}]])
        );

        expect(profileStore.isUpdateColumnMode).toBe(true);

        profileStore.updateCatalogData(
            {
                fileId: 1,
                filterDataSize: 4,
                progress: 1,
                requestEndIndex: 4,
                subsetDataSize: 3,
                subsetEndIndex: 4
            } as CARTA.CatalogFilterResponse,
            new Map([[0, {dataType: CARTA.ColumnType.Double, data: Float64Array.from([6, 7, 8])}]])
        );

        expect(profileStore.isUpdateColumnMode).toBe(false);
    });
});

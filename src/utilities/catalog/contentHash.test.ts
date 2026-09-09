import {describe, expect, test} from "@jest/globals";
import {CARTA} from "carta-protobuf";

import {type ProcessedColumnData} from "../Processed/Processed";

import {fingerprintCatalogSelection, hashCatalogContent, resolveCatalogSelection} from "./contentHash";

describe("hashCatalogContent", () => {
    const headers = ["RA", "DEC", "NAME"].map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: index < 2 ? CARTA.ColumnType.Double : CARTA.ColumnType.String, name}));

    function catalogData(ra: number[], dec: number[], name: string[]): Map<number, ProcessedColumnData> {
        return new Map<number, ProcessedColumnData>([
            [0, {dataType: CARTA.ColumnType.Double, data: ra}],
            [1, {dataType: CARTA.ColumnType.Double, data: dec}],
            [2, {dataType: CARTA.ColumnType.String, data: name}]
        ]);
    }

    test("matches for the same rows", () => {
        const first = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["a", "b"]));
        const second = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["a", "b"]));

        expect(first).toBe(second);
    });

    test("differs when a query returns as many rows with different values", () => {
        const saved = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["a", "b"]));
        const requeried = hashCatalogContent(headers, catalogData([1, 2], [3, 4.5], ["a", "b"]));

        expect(requeried).not.toBe(saved);
    });

    test("differs when the rows come back in another order", () => {
        const saved = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["a", "b"]));
        const requeried = hashCatalogContent(headers, catalogData([2, 1], [4, 3], ["b", "a"]));

        expect(requeried).not.toBe(saved);
    });

    test("differs when a column is added", () => {
        const saved = hashCatalogContent(headers.slice(0, 2), catalogData([1, 2], [3, 4], ["a", "b"]));
        const requeried = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["a", "b"]));

        expect(requeried).not.toBe(saved);
    });

    test("tells a value apart from the next one being longer", () => {
        const first = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["ab", "c"]));
        const second = hashCatalogContent(headers, catalogData([1, 2], [3, 4], ["a", "bc"]));

        expect(first).not.toBe(second);
    });

    test("resolves selected rows after their indices change", () => {
        const selection = fingerprintCatalogSelection(headers, catalogData([1, 2], [3, 4], ["a", "b"]), [0]);

        expect(resolveCatalogSelection(headers, catalogData([2, 1], [4, 3], ["b", "a"]), selection!)).toEqual([1]);
    });

    test("does not reuse an index when the selected row content changes", () => {
        const selection = fingerprintCatalogSelection(headers, catalogData([1, 2], [3, 4], ["a", "b"]), [0]);

        expect(resolveCatalogSelection(headers, catalogData([9, 2], [8, 4], ["z", "b"]), selection!)).toEqual([]);
    });

    test("uses the same locale-independent column order when saving and resolving", () => {
        const mixedCaseHeaders = ["RA", "_r", "dec"].map((name, index) => new CARTA.CatalogHeader({columnIndex: index, dataType: CARTA.ColumnType.String, name}));
        const mixedCaseData = new Map<number, ProcessedColumnData>(mixedCaseHeaders.map((header, index) => [header.columnIndex, {dataType: CARTA.ColumnType.String, data: [`row-${index}`]}]));
        const selection = fingerprintCatalogSelection(mixedCaseHeaders, mixedCaseData, [0]);

        expect(selection?.columns).toEqual(["RA", "_r", "dec"]);
        expect(selection?.searchRows).toBe(1);
        expect(resolveCatalogSelection(mixedCaseHeaders, mixedCaseData, selection!)).toEqual([0]);
    });

    test("cannot resolve a selection when an identifying column is absent", () => {
        const selection = fingerprintCatalogSelection(headers, catalogData([1, 2], [3, 4], ["a", "b"]), [0]);
        const missingNameColumn = catalogData([1, 2], [3, 4], ["a", "b"]);
        missingNameColumn.delete(2);

        expect(resolveCatalogSelection(headers, missingNameColumn, selection!)).toBeUndefined();
    });
});

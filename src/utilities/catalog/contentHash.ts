import {type CARTA} from "carta-protobuf";
import type {ProcessedColumnData} from "utilities";

/**
 * A running digest, kept as two 32-bit halves so that folding a value in stays integer arithmetic.
 * Adapted from cyrb53.
 */
/** Scratch space for reading the raw bits of a number, shared because folding one in never yields. */
const NUMBER_BUFFER = new ArrayBuffer(8);
const NUMBER_AS_FLOAT = new Float64Array(NUMBER_BUFFER);
const NUMBER_AS_INTS = new Uint32Array(NUMBER_BUFFER);

class ContentHash {
    private static readonly Separator = 0x1f;

    private h1 = 0xdeadbeef;
    private h2 = 0x41c6ce57;

    /** Fold one value in, followed by a separator so that "ab" + "c" and "a" + "bc" differ. */
    add(value: string): void {
        for (let i = 0; i < value.length; i++) {
            this.fold(value.charCodeAt(i));
        }
        this.separate();
    }

    /**
     * Fold a number in by its raw bits. Most of a catalog is numeric, and converting each value to
     * a string first costs several times as much as the hashing itself.
     */
    addNumber(value: number): void {
        NUMBER_AS_FLOAT[0] = value;
        this.fold(NUMBER_AS_INTS[0]);
        this.fold(NUMBER_AS_INTS[1]);
        this.separate();
    }

    private fold(value: number): void {
        this.h1 = Math.imul(this.h1 ^ value, 2654435761);
        this.h2 = Math.imul(this.h2 ^ value, 1597334677);
    }

    private separate(): void {
        this.h1 = Math.imul(this.h1 ^ ContentHash.Separator, 2246822507);
        this.h2 = Math.imul(this.h2 ^ ContentHash.Separator, 3266489909);
    }

    get digest(): string {
        const h1 = Math.imul(this.h1 ^ (this.h1 >>> 16), 2246822507) ^ Math.imul(this.h2 ^ (this.h2 >>> 13), 3266489909);
        const h2 = Math.imul(this.h2 ^ (this.h2 >>> 16), 2246822507) ^ Math.imul(this.h1 ^ (this.h1 >>> 13), 3266489909);
        return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
    }
}

/**
 * A short digest of everything a catalog holds: the names of its columns, and every value in each
 * of them.
 *
 * An online catalog is not stored in a workspace, it is queried again, so what comes back can
 * differ from what was saved even when it has just as many rows. Comparing digests tells those
 * apart. It is a fingerprint for that comparison only: not a checksum against corruption, and not
 * meant to match anything computed outside CARTA.
 */
export function hashCatalogContent(catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>): string {
    const hash = new ContentHash();

    for (const name of catalogHeader.map(header => header.name ?? "").sort()) {
        hash.add(name);
    }

    for (const key of [...catalogData.keys()].sort((a, b) => a - b)) {
        const data = catalogData.get(key)?.data as ArrayLike<string | number | boolean | null | undefined> | null | undefined;
        const length = data?.length ?? 0;
        hash.addNumber(key);
        hash.addNumber(length);
        for (let i = 0; i < length; i++) {
            const value = data?.[i];
            if (typeof value === "number") {
                hash.addNumber(value);
            } else {
                hash.add(value === null || value === undefined ? "" : String(value));
            }
        }
    }

    return hash.digest;
}

export interface CatalogRowSelectionFingerprint {
    columns: string[];
    rowHashes: string[];
    searchRows?: number;
}

function compareColumnNames(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

function catalogColumns(catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, columnNames?: string[]) {
    const requestedColumns = columnNames ? new Set(columnNames) : undefined;
    return catalogHeader.filter(header => !!header.name && catalogData.has(header.columnIndex) && (!requestedColumns || requestedColumns.has(header.name))).sort((a, b) => compareColumnNames(a.name as string, b.name as string));
}

function hashCatalogRow(headers: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, rowIndex: number): string {
    const hash = new ContentHash();
    for (const header of headers) {
        const data = catalogData.get(header.columnIndex)?.data as ArrayLike<string | number | boolean | null | undefined> | null | undefined;
        const value = data?.[rowIndex];
        hash.add(header.name as string);
        if (typeof value === "number") {
            hash.add("number");
            hash.addNumber(value);
        } else {
            hash.add(value === null ? "null" : value === undefined ? "undefined" : `${typeof value}:${String(value)}`);
        }
    }
    return hash.digest;
}

export function fingerprintCatalogSelection(catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, rowIndices: number[]): CatalogRowSelectionFingerprint | undefined {
    const headers = catalogColumns(catalogHeader, catalogData);
    if (!headers.length) {
        return undefined;
    }
    const rowCount = Math.min(...headers.map(header => catalogData.get(header.columnIndex)?.data?.length ?? 0));
    const validIndices = rowIndices.filter(index => Number.isInteger(index) && index >= 0 && index < rowCount);
    return {columns: headers.map(header => header.name as string), rowHashes: validIndices.map(index => hashCatalogRow(headers, catalogData, index)), searchRows: rowCount};
}

export function resolveCatalogSelection(catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, selection: CatalogRowSelectionFingerprint): number[] | undefined {
    const headers = catalogColumns(catalogHeader, catalogData, selection.columns);
    const sortedColumns = [...new Set(selection.columns)].sort(compareColumnNames);
    if (headers.length !== selection.columns.length || headers.some((header, index) => header.name !== sortedColumns[index])) {
        return undefined;
    }

    const remaining = new Map<string, number>();
    for (const hash of selection.rowHashes) {
        remaining.set(hash, (remaining.get(hash) ?? 0) + 1);
    }

    const rowCount = Math.min(...headers.map(header => catalogData.get(header.columnIndex)?.data?.length ?? 0));
    const resolved: number[] = [];
    for (let index = 0; index < rowCount && resolved.length < selection.rowHashes.length; index++) {
        const hash = hashCatalogRow(headers, catalogData, index);
        const count = remaining.get(hash) ?? 0;
        if (count > 0) {
            resolved.push(index);
            remaining.set(hash, count - 1);
        }
    }
    return resolved;
}

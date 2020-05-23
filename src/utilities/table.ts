import {CARTA} from "carta-protobuf";
import {ColumnArray, ProcessedColumnData} from "models";

export function getDataTypeString(dataType: CARTA.ColumnType): string {
    switch (dataType) {
        case CARTA.ColumnType.String:
            return "string";
        case CARTA.ColumnType.Uint8:
            return "uint8";
        case CARTA.ColumnType.Int8:
            return "int8";
        case CARTA.ColumnType.Uint16:
            return "uint16";
        case CARTA.ColumnType.Int16:
            return "int16";
        case CARTA.ColumnType.Uint32:
            return "uint32";
        case CARTA.ColumnType.Int32:
            return "int32";
        case CARTA.ColumnType.Uint64:
            return "uint64";
        case CARTA.ColumnType.Int64:
            return "int64";
        case CARTA.ColumnType.Float:
            return "float";
        case CARTA.ColumnType.Double:
            return "double";
        case CARTA.ColumnType.Bool:
            return "bool";
        default:
            return "unsupported";
    }
}

export function filterProcessedColumnData(columnData: ProcessedColumnData, selectedIndices: Array<number>): ProcessedColumnData {
    const N = selectedIndices.length;
    let data: ColumnArray;

    // Special cases for bool and string arrays
    if (columnData.dataType === CARTA.ColumnType.String) {
        const srcData = columnData.data as Array<string>;
        data = new Array<string>(N);
        for (let i = 0; i < N; i++) {
            data[i] = srcData[selectedIndices[i]];
        }
    } else if (columnData.dataType === CARTA.ColumnType.Bool) {
        const srcData = columnData.data as Array<boolean>;
        data = new Array<boolean>(N);
        for (let i = 0; i < N; i++) {
            data[i] = srcData[selectedIndices[i]];
        }
    } else if (columnData.dataType === CARTA.ColumnType.UnsupportedType) {
        return {dataType: CARTA.ColumnType.UnsupportedType, data: []};
    } else {
        // All other arrays are simply typed arrays
        const srcData = columnData.data as Array<number>;
        data = new Array<number>(N);
        for (let i = 0; i < N; i++) {
            data[i] = srcData[selectedIndices[i]];
        }
    }
    return {dataType: columnData.dataType, data};
}
import {CARTA} from "carta-protobuf";
import {ProcessedColumnData, TypedArray} from "models";

export function filterProcessedColumnData(columnData: ProcessedColumnData, selectedIndices: Array<number>): ProcessedColumnData {
    const N = selectedIndices.length;
    let data;

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
    } else {
        // All other arrays are simply typed arrays
        const srcData = columnData.data as TypedArray;
        switch (columnData.dataType) {
            case CARTA.ColumnType.Uint8:
                data = new Uint8Array(N);
                break;
            case CARTA.ColumnType.Int8:
                data = new Int8Array(N);
                break;
            case CARTA.ColumnType.Uint16:
                data = new Uint16Array(N);
                break;
            case CARTA.ColumnType.Int16:
                data = new Int16Array(N);
                break;
            case CARTA.ColumnType.Uint32:
                data = new Uint32Array(N);
                break;
            case CARTA.ColumnType.Int32:
                data = new Int32Array(N);
                break;
            case CARTA.ColumnType.Uint64:
                data = new BigUint64Array(N);
                break;
            case CARTA.ColumnType.Int64:
                data = new BigInt64Array(N);
                break;
            case CARTA.ColumnType.Float:
                data = new Float32Array(N);
                break;
            case CARTA.ColumnType.Double:
                data = new Float64Array(N);
                break;
            default:
                return {dataType: CARTA.ColumnType.UnsupportedType, data: []};
        }

        for (let i = 0; i < N; i++) {
            data[i] = srcData[selectedIndices[i]];
        }
    }
    return {dataType: columnData.dataType, data};
}
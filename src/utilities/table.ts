import {CARTA} from "carta-protobuf";
import {ColumnArray, ProcessedColumnData} from "models";
import {getComparisonOperatorAndValue} from ".";

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

export function numericFiltering(columnData: Array<number>, dataIndexes: number[], filterString: string): number[] {
    if (columnData?.length <= 0 || dataIndexes?.length <= 0 || !filterString) {
        return [];
    }

    const filter = getComparisonOperatorAndValue(filterString);
    if (filter?.operator === -1 || filter?.values.length <= 0) {
        return [];
    }

    let compareFunction = undefined;
    if (filter.operator === CARTA.ComparisonOperator.Equal && filter.values.length === 1) {
        compareFunction = (data: number): boolean => {
            return data - filter.values[0] === 0;
        };
    } else if (filter.operator === CARTA.ComparisonOperator.NotEqual && filter.values.length === 1) {
        compareFunction = (data: number): boolean => {
            return data - filter.values[0] !== 0;
        };
    } else if (filter.operator === CARTA.ComparisonOperator.Lesser && filter.values.length === 1) {
        compareFunction = (data: number): boolean => {
            return data < filter.values[0];
        };
    } else if (filter.operator === CARTA.ComparisonOperator.LessorOrEqual && filter.values.length === 1) {
        compareFunction = (data: number): boolean => {
            return data <= filter.values[0];
        };
    } else if (filter.operator === CARTA.ComparisonOperator.Greater && filter.values.length === 1) {
        compareFunction = (data: number): boolean => {
            return data > filter.values[0];
        };
    } else if (filter.operator === CARTA.ComparisonOperator.GreaterOrEqual && filter.values.length === 1) {
        compareFunction = (data: number): boolean => {
            return data >= filter.values[0];
        };
    } else if (filter.operator === CARTA.ComparisonOperator.RangeOpen && filter.values.length === 2) {
        const min = Math.min(filter.values[0], filter.values[1]);
        const max = Math.max(filter.values[0], filter.values[1]);
        compareFunction = (data: number): boolean => {
            return data >= min && data <= max;
        };
    } else if (filter.operator === CARTA.ComparisonOperator.RangeClosed && filter.values.length === 2) {
        const min = Math.min(filter.values[0], filter.values[1]);
        const max = Math.max(filter.values[0], filter.values[1]);
        compareFunction = (data: number): boolean => {
            return data > min && data < max;
        };
    } else {
        return [];
    }

    let filteredDataIndexes = [];
    dataIndexes.forEach(dataIndex => {
        if (dataIndex >= 0 && dataIndex < columnData.length && compareFunction(columnData[dataIndex])) {
            filteredDataIndexes.push(dataIndex);
        }
    });
    return filteredDataIndexes;
}

export function booleanFiltering(columnData: Array<boolean>, dataIndexes: number[], filterString: string): number[] {
    if (columnData?.length <= 0 || dataIndexes?.length <= 0 || !filterString) {
        return [];
    }

    let filteredDataIndexes = [];
    const trimmedLowercase = filterString?.trim()?.toLowerCase();
    if (trimmedLowercase === "t" || trimmedLowercase === "true") {
        dataIndexes.forEach(dataIndex => {
            if (dataIndex >= 0 && dataIndex < columnData.length && columnData[dataIndex]) {
                filteredDataIndexes.push(dataIndex);
            }
        });
    } else if (trimmedLowercase === "f" || trimmedLowercase === "false") {
        dataIndexes.forEach(dataIndex => {
            if (dataIndex >= 0 && dataIndex < columnData.length && !columnData[dataIndex]) {
                filteredDataIndexes.push(dataIndex);
            }
        });
    }
    return filteredDataIndexes;
}

export function stringFiltering(columnData: Array<string>, dataIndexes: number[], filterString: string): number[] {
    if (columnData?.length <= 0 || dataIndexes?.length <= 0 || !filterString) {
        return [];
    }

    let filteredDataIndexes = [];
    dataIndexes.forEach(dataIndex => {
        if (dataIndex >= 0 && dataIndex < columnData.length && columnData[dataIndex]?.includes(filterString)) {
            filteredDataIndexes.push(dataIndex);
        }
    });
    return filteredDataIndexes;
}

import {CARTA} from "carta-protobuf";

import {ControlHeader} from "stores";
import {ProcessedColumnData} from "utilities";

export function getSortedIndexMap(
    controlHeader: Map<string, ControlHeader>,
    sortingInfo: {columnName: string; sortingType: CARTA.SortingType},
    sortedIndexMap: Array<number>,
    hasFilter: boolean,
    numVisibleRows: number,
    sortData: Map<number, ProcessedColumnData>
) {
    const dataIndex = controlHeader.get(sortingInfo.columnName)?.dataIndex;

    if (dataIndex >= 0) {
        let direction = 0;

        if (sortingInfo.sortingType != null) {
            direction = sortingInfo.sortingType === CARTA.SortingType.Descending ? -1 : 1;
        } else {
            return getInitIndexMap(numVisibleRows);
        }

        if (hasFilter) {
            sortedIndexMap = getInitIndexMap(numVisibleRows);
        }
        let queryColumn = sortData.get(dataIndex);

        switch (queryColumn?.dataType) {
            case CARTA.ColumnType.String:
                sortedIndexMap.sort((a: number, b: number) => {
                    const aString = String(queryColumn.data[a]);
                    const bString = String(queryColumn.data[b]);
                    if (!aString) {
                        return direction * -1;
                    }

                    if (!bString) {
                        return direction * 1;
                    }
                    return direction * aString.localeCompare(bString);
                });
                break;
            case CARTA.ColumnType.UnsupportedType:
                console.log("Data type is not supported");
                break;
            default:
                sortedIndexMap.sort((a: number, b: number) => {
                    const aNumber = Number(queryColumn.data[a]);
                    const bNumber = Number(queryColumn.data[b]);
                    return direction * (aNumber < bNumber ? -1 : 1);
                });
                break;
        }
    }
    return sortedIndexMap;
}

export function getInitIndexMap(numVisibleRows: number) {
    let sortedIndexMap = [];
    for (let index = 0; index < numVisibleRows; index++) {
        sortedIndexMap.push(index);
    }
    return sortedIndexMap;
}

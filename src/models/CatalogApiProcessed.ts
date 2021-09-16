import {CARTA} from "carta-protobuf";
import {ProcessedColumnData} from "models";

enum SimbadType {
    CHAR = "CHAR",
    SHORT = "SHORT",
    FLOAT = "FLOAT",
    LONG = "LONG",
    INT = "INT",
    DOUBLE = "DOUBLE"
}

export class APIProcessing {
    static ProcessSimbadMetaData(metaData: []): CARTA.ICatalogHeader[] {
        let headers: CARTA.CatalogHeader[] = new Array(metaData.length);
        for (let index = 0; index < metaData.length; index++) {
            const header = metaData[index];
            headers[index] = new CARTA.CatalogHeader({
                name: header["name"],
                description: header["description"],
                dataType: APIProcessing.matchDataType(header["datatype"]),
                columnIndex: index,
                units: header["unit"]
            });
        }
        return headers;
    }

    static ProcessSimbadData(data: [], headers: CARTA.ICatalogHeader[]): Map<number, ProcessedColumnData> {
        const dataMap = new Map<number, ProcessedColumnData>();
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            let column: ProcessedColumnData = {dataType: header.dataType, data: new Array(data.length)};
            for (let j = 0; j < data.length; j++) {
                column.data[j] = data[j][i];
            }
            dataMap.set(i, column);
        }
        return dataMap;
    }

    static matchDataType(dataType: string): CARTA.ColumnType {
        switch (dataType) {
            case SimbadType.CHAR:
                return CARTA.ColumnType.String;
            case SimbadType.INT:
            case SimbadType.SHORT:
                return CARTA.ColumnType.Int16;
            case SimbadType.LONG:
                return CARTA.ColumnType.Int32;
            case SimbadType.FLOAT:
                return CARTA.ColumnType.Float;
            case SimbadType.DOUBLE:
                return CARTA.ColumnType.Double;
            default:
                return CARTA.ColumnType.UnsupportedType;
        }
    }
}
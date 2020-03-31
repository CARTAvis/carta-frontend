import {CARTA} from "carta-protobuf";

export function getTableDataByType (columnsData: CARTA.ICatalogColumnsData, dataType: CARTA.EntryType, index: number) {
    switch (dataType) {
        case CARTA.EntryType.INT:
            return columnsData.intColumn[index].intColumn;
        case CARTA.EntryType.STRING:
            return columnsData.stringColumn[index].stringColumn;
        case CARTA.EntryType.BOOL:
            return columnsData.boolColumn[index].boolColumn;
        case CARTA.EntryType.DOUBLE:
            return columnsData.doubleColumn[index].doubleColumn;
        case CARTA.EntryType.FLOAT:
            return columnsData.floatColumn[index].floatColumn;   
        case CARTA.EntryType.LONGLONG:
            return columnsData.llColumn[index].llColumn;      
        default:
            return [];
    }
}
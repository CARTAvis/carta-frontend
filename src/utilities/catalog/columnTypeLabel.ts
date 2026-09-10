import {CARTA} from "carta-protobuf";

export function getCatalogDataTypeDisplayName(type: CARTA.ColumnType | null | undefined): string {
    switch (type) {
        case CARTA.ColumnType.Bool:
            return "bool";
        case CARTA.ColumnType.Int8:
            return "byte";
        case CARTA.ColumnType.Int16:
            return "short";
        case CARTA.ColumnType.Int32:
            return "int";
        case CARTA.ColumnType.Int64:
            return "long";
        case CARTA.ColumnType.Uint8:
            return "unsigned byte";
        case CARTA.ColumnType.Uint16:
            return "unsigned short";
        case CARTA.ColumnType.Uint32:
            return "unsigned int";
        case CARTA.ColumnType.Uint64:
            return "unsigned long";
        case CARTA.ColumnType.Double:
            return "double";
        case CARTA.ColumnType.Float:
            return "float";
        case CARTA.ColumnType.String:
            return "string";
        default:
            return "unsupported";
    }
}

import {CARTA} from "carta-protobuf";
 
export class TableHeader {
    name: string;
    dataType: CARTA.EntryType;
    columnIndex: number;
    dataTypeIndex: number;
    description: string;
    units: string;
}
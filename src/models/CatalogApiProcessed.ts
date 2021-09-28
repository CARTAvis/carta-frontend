import {CARTA} from "carta-protobuf";
import {CatalogSystemType, ProcessedColumnData} from "models";

enum DataType {
    CHAR = "CHAR",
    SHORT = "SHORT",
    FLOAT = "FLOAT",
    LONG = "LONG",
    INT = "INT",
    DOUBLE = "DOUBLE",
    UNSIGNEDBYTE = "UNSIGNEDBYTE"
}

export type VizieResource = {
    id: string;
    name: string;
    description: string;
    coosys: VizieRCoosys;
    table: VizieRTable;
};

type VizieRCoosys = {
    system: string;
    equinox: string;
};

type VizieRTable = {
    name: string;
    description: string;
    size: number;
    tableElement: Element;
};

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
        const dataTypeUpperCase = dataType.toUpperCase();
        switch (dataTypeUpperCase) {
            case DataType.CHAR:
                return CARTA.ColumnType.String;
            case DataType.INT:
            case DataType.SHORT:
                return CARTA.ColumnType.Int16;
            case DataType.LONG:
                return CARTA.ColumnType.Int32;
            case DataType.FLOAT:
                return CARTA.ColumnType.Float;
            case DataType.DOUBLE:
                return CARTA.ColumnType.Double;
            case DataType.UNSIGNEDBYTE:
                return CARTA.ColumnType.Uint16;
            default:
                return CARTA.ColumnType.UnsupportedType;
        }
    }

    static ProcessVizieRData(data: string): {tableNames: string[]; resources: Map<string, VizieResource>} {
        const tableNames = [];
        const resources: Map<string, VizieResource> = new Map();
        let dom: Document;
        const parser = new DOMParser();
        dom = parser.parseFromString(data, "application/xml");
        const resourceElements = dom.documentElement.getElementsByTagName("RESOURCE");
        for (let index = 0; index < resourceElements.length; index++) {
            const resourceElement = resourceElements[index];
            const tableElements = resourceElement.getElementsByTagName("TABLE");

            for (let j = 0; j < tableElements.length; j++) {
                const tableElement = tableElements[j];
                const name = tableElement.getAttribute("name");
                const data = tableElement.getElementsByTagName("DATA")[0]?.getElementsByTagName("TABLEDATA")[0]?.getElementsByTagName("TR");
                if (data?.length && tableElement.getElementsByTagName("FIELD")?.length) {
                    const res: VizieResource = {
                        id: resourceElement.getAttribute("ID"),
                        name: resourceElement.getAttribute("name"),
                        description: resourceElement.getElementsByTagName("DESCRIPTION")[0]?.textContent,
                        coosys: {
                            system: CatalogSystemType.FK5,
                            equinox: "J2000"
                        },
                        table: {
                            name: name,
                            description: tableElement.getElementsByTagName("DESCRIPTION")[0]?.textContent,
                            size: data.length,
                            tableElement: tableElement
                        }
                    };
                    tableNames.push(name);
                    resources.set(name, res);
                }
            }
        }
        return {tableNames, resources};
    }

    static ProcessVizieRTableData(table: Element): {headers: CARTA.ICatalogHeader[]; dataMap: Map<number, ProcessedColumnData>; size: number} {
        const fields = table.getElementsByTagName("FIELD");
        let headers: CARTA.CatalogHeader[] = new Array(fields.length);
        for (let index = 0; index < fields.length; index++) {
            const field = fields[index];
            headers[index] = new CARTA.CatalogHeader({
                name: field.getAttribute("name"),
                description: field.getElementsByTagName("DESCRIPTION")[0]?.textContent,
                dataType: APIProcessing.matchDataType(field.getAttribute("datatype")),
                columnIndex: index,
                units: field.getAttribute("unit")
            });
        }
        const data = table.getElementsByTagName("DATA")[0]?.getElementsByTagName("TABLEDATA")[0]?.getElementsByTagName("TR");
        const size = data.length;
        // init data map
        const dataMap = new Map<number, ProcessedColumnData>();
        for (let index = 0; index < headers.length; index++) {
            const header = headers[index];
            let column: ProcessedColumnData = {dataType: header.dataType, data: new Array(size)};
            dataMap.set(index, column);
        }

        for (let index = 0; index < size; index++) {
            const columns = data[index].getElementsByTagName("TD");
            for (let j = 0; j < columns.length; j++) {
                //textContent is faster than innerHTML
                dataMap.get(j).data[index] = columns[j].textContent;
            }
        }
        return {headers, dataMap, size};
    }
}

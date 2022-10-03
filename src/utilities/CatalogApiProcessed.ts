import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {ProcessedColumnData} from "utilities";
import {AppStore, NumberFormatType, SystemType} from "stores";
import {CatalogSystemType} from "models";

enum DataType {
    CHAR = "CHAR",
    SHORT = "SHORT",
    FLOAT = "FLOAT",
    LONG = "LONG",
    INT = "INT",
    DOUBLE = "DOUBLE",
    UNSIGNEDBYTE = "UNSIGNEDBYTE"
}

export type VizierResource = {
    id: string;
    name: string;
    description: string;
    coosys: VizierCoosys;
    table: VizierTable;
};

type VizierCoosys = {
    system: string;
    equinox: string;
};

type VizierTable = {
    name: string;
    description: string;
    tableElement: Element;
};

export class CatalogApiProcessing {
    static ProcessSimbadMetaData(metaData: []): CARTA.ICatalogHeader[] {
        let headers: CARTA.CatalogHeader[] = new Array(metaData.length + 2);
        for (let index = 0; index < metaData.length; index++) {
            const header = metaData[index];
            headers[index] = new CARTA.CatalogHeader({
                name: header["name"],
                description: header["description"],
                dataType: CatalogApiProcessing.matchDataType(header["datatype"]),
                columnIndex: index,
                units: header["unit"]
            });
            if (header["name"] === "dist") {
                headers[index].units = "arcsec";
                headers[index].description = "Distance to the center coordiante (computed by CARTA)";
            }
        }

        headers[metaData.length] = new CARTA.CatalogHeader({
            name: "RA_HMS",
            description: "RA in sexagesimal format (H:M:S, computed by CARTA)",
            dataType: CARTA.ColumnType.String,
            columnIndex: metaData.length,
            units: "H:M:S"
        });

        headers[metaData.length + 1] = new CARTA.CatalogHeader({
            name: "DEC_DMS",
            description: "DEC in sexagesimal format (D:M:S, computed by CARTA)",
            dataType: CARTA.ColumnType.String,
            columnIndex: metaData.length + 1,
            units: "D:M:S"
        });
        return headers;
    }

    static ProcessSimbadData(data: [], headers: CARTA.ICatalogHeader[]): Map<number, ProcessedColumnData> {
        const dataMap = new Map<number, ProcessedColumnData>();
        const raIndex = headers.filter(header => header.name === "ra")[0]?.columnIndex;
        const decIndex = headers.filter(header => header.name === "dec")[0]?.columnIndex;

        const frame = AppStore.Instance.activeFrame;
        const raformat = `${NumberFormatType.HMS}.${6}`;
        const deformat = `${NumberFormatType.DMS}.${6}`;
        const wcsCopy = AST.copy(frame.wcsInfo);
        const xAxis = frame.frameInfo.fileInfoExtended.axesNumbers.dirX;
        const yAxis = frame.frameInfo.fileInfoExtended.axesNumbers.dirY;
        AST.set(wcsCopy, `System=${SystemType.ICRS}`);
        AST.set(wcsCopy, `Format(${xAxis})=${raformat}`);
        AST.set(wcsCopy, `Format(${yAxis})=${deformat}`);
        const fraction = Math.PI / 180.0;

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            let column: ProcessedColumnData = {dataType: header.dataType, data: new Array(data.length)};
            for (let j = 0; j < data.length; j++) {
                if (header["name"] === "dist") {
                    // simbad returns distance in deg, convert to arcsec for usability improvement
                    column.data[j] = Number((data[j][header.columnIndex] * 3600).toFixed(6));
                } else if (header["name"] === "RA_HMS" && raIndex > -1) {
                    const x = AST.format(wcsCopy, 1, data[j][raIndex] * fraction);
                    column.data[j] = x;
                } else if (header["name"] === "DEC_DMS" && decIndex > -1) {
                    const y = AST.format(wcsCopy, 2, data[j][decIndex] * fraction);
                    column.data[j] = y;
                } else {
                    column.data[j] = data[j][header.columnIndex];
                }
            }
            dataMap.set(i, column);
        }

        AST.deleteObject(wcsCopy);
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

    static ProcessVizierData(data: string): Map<string, VizierResource> {
        const resources: Map<string, VizierResource> = new Map();
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
                if (tableElement.getElementsByTagName("FIELD")?.length) {
                    const res: VizierResource = {
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
                            tableElement: tableElement
                        }
                    };
                    resources.set(name, res);
                }
            }
        }
        return resources;
    }

    static ProcessVizierTableData(table: Element): {headers: CARTA.ICatalogHeader[]; dataMap: Map<number, ProcessedColumnData>; size: number} {
        const fields = table.getElementsByTagName("FIELD");
        let headers: CARTA.CatalogHeader[] = new Array(fields.length);
        for (let index = 0; index < fields.length; index++) {
            const field = fields[index];
            headers[index] = new CARTA.CatalogHeader({
                name: field.getAttribute("name"),
                description: field.getElementsByTagName("DESCRIPTION")[0]?.textContent,
                dataType: CatalogApiProcessing.matchDataType(field.getAttribute("datatype")),
                columnIndex: index,
                units: field.getAttribute("unit")
            });
        }
        const data = table.getElementsByTagName("DATA")[0]?.getElementsByTagName("TABLEDATA")[0]?.getElementsByTagName("TR");
        const size = data?.length;
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

import * as AST from "ast_wrapper";
import {CARTA} from "carta-protobuf";
import {ProcessedColumnData} from "models";
import {AppStore, NumberFormatType, OverlayStore, SystemType} from "stores";

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
        let headers: CARTA.CatalogHeader[] = new Array(metaData.length + 2);
        for (let index = 0; index < metaData.length; index++) {
            const header = metaData[index];
            headers[index] = new CARTA.CatalogHeader({
                name: header["name"],
                description: header["description"],
                dataType: APIProcessing.matchDataType(header["datatype"]),
                columnIndex: index,
                units: header["unit"]
            });
            if (header["name"] == "dist") {
                headers[index].units = "arcsec";
                headers[index].description = "Distance to the center coordiante (computed by CARTA)";
            }
        }

        headers[metaData.length] = new CARTA.CatalogHeader({
            name: "RA ICRS(J2000)",
            description: "Ra in sexagesimal format(H:M:S, computed by CARTA)",
            dataType: CARTA.ColumnType.String,
            columnIndex: metaData.length,
            units: "H:M:S"
        });

        headers[metaData.length + 1] = new CARTA.CatalogHeader({
            name: "DEC ICRS(J2000)",
            description: "Dec in sexagesimal format(D:M:S, computed by CARTA)",
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
        const overlay = OverlayStore.Instance;
        const precision = overlay.numbers.customPrecision ? overlay.numbers.precision : "*";
        const raformat = `${NumberFormatType.HMS}.${precision}`;
        const deformat = `${NumberFormatType.DMS}.${precision}`;
        const wcsCopy = AST.copy(frame.wcsInfo);
        AST.set(wcsCopy, `System=${SystemType.ICRS}`);
        AST.set(wcsCopy, `Format(1)=${raformat}`);
        AST.set(wcsCopy, `Format(2)=${deformat}`);
        const fraction = Math.PI / 180.0;

        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            let column: ProcessedColumnData = {dataType: header.dataType, data: new Array(data.length)};
            for (let j = 0; j < data.length; j++) {
                if (header["name"] == "dist") {
                    // simbad returns distance in deg, convert to arcsec for usability improvement
                    column.data[j] = data[j][header.columnIndex] * 3600;
                } else if (header["name"] == "RA ICRS(J2000)" && raIndex > -1) {
                    const x = AST.format(wcsCopy, 1, data[j][raIndex] * fraction);
                    column.data[j] = x;
                } else if (header["name"] == "DEC ICRS(J2000)" && decIndex > -1) {
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

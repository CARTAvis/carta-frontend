import axios, {AxiosInstance} from "axios";
import {CARTA} from "carta-protobuf";

export class SplatalogueService {
    private static BaseUrl = "https://splatalogue.online";
    private readonly axiosInstance: AxiosInstance;

    private static SplatalogueHeaders: string[] = [
        "Species",
        "Chemical Name",
        "Freq-MHz(rest frame,redshifted)",
        "Freq Err(rest frame,redshifted)",
        "Meas Freq-MHz(rest frame,redshifted)",
        "Meas Freq Err(rest frame,redshifted)",
        "Resolved QNs",
        "Unresolved Quantum Numbers",
        "CDMS/JPL Intensity",
        "S<sub>ij</sub>&#956;<sup>2</sup> (D<sup>2</sup>)",
        "S<sub>ij</sub>",
        "Log<sub>10</sub> (A<sub>ij</sub>)",
        "Lovas/AST Intensity",
        "E_L (cm^-1)",
        "E_L (K)",
        "E_U (cm^-1)",
        "E_U (K)",
        "Linelist"
    ];

    private static SplatalogueHeaderTypeMap = new Map<string, CARTA.ColumnType>([
        ["Species", CARTA.ColumnType.String],
        ["Chemical Name", CARTA.ColumnType.String],
        ["Shifted Frequency", CARTA.ColumnType.Double],
        ["Freq-MHz(rest frame,redshifted)", CARTA.ColumnType.Double],
        ["Freq Err(rest frame,redshifted)", CARTA.ColumnType.Double],
        ["Meas Freq-MHz(rest frame,redshifted)", CARTA.ColumnType.Double],
        ["Meas Freq Err(rest frame,redshifted)", CARTA.ColumnType.Double],
        ["Resolved QNs", CARTA.ColumnType.String],
        ["Unresolved Quantum Numbers", CARTA.ColumnType.String],
        ["CDMS/JPL Intensity", CARTA.ColumnType.Double],
        ["S<sub>ij</sub>&#956;<sup>2</sup> (D<sup>2</sup>)", CARTA.ColumnType.Double],
        ["S<sub>ij</sub>", CARTA.ColumnType.Double],
        ["Log<sub>10</sub> (A<sub>ij</sub>)", CARTA.ColumnType.Double],
        ["Lovas/AST Intensity", CARTA.ColumnType.Double],
        ["E_L (cm^-1)", CARTA.ColumnType.Double],
        ["E_L (K)", CARTA.ColumnType.Double],
        ["E_U (cm^-1)", CARTA.ColumnType.Double],
        ["E_U (K)", CARTA.ColumnType.Double],
        ["Linelist", CARTA.ColumnType.String]
    ]);

    private static staticInstance: SplatalogueService;

    static get Instance() {
        if (!SplatalogueService.staticInstance) {
            SplatalogueService.staticInstance = new SplatalogueService();
        }
        return SplatalogueService.staticInstance;
    }

    private constructor() {
        this.axiosInstance = axios.create({baseURL: SplatalogueService.BaseUrl});
    }

    async aliveCheck(): Promise<boolean> {
        try {
            const {status} = await this.axiosInstance.head("");
            return status === 200;
        } catch (err) {
            return false;
        }
    }

    async query(freqMin: number, freqMax: number, intensityLimit?: number): Promise<CARTA.ISpectralLineResponse> {
        const url = SplatalogueService.ConstructUrl(freqMin, freqMax, intensityLimit);
        const response = await this.axiosInstance.get(url);
        return SplatalogueService.ConvertTable(response.data);
    }

    private static ConvertTable(tableString: string) {
        if (!tableString || typeof tableString !== "string") {
            throw new Error("invalid data received from Splatalogue");
        }

        const lines = tableString.split("\n");
        if (!lines.length) {
            throw new Error("invalid data received from Splatalogue");
        }

        const headerLine = lines[0];
        const headerEntries = headerLine.split("\t");
        // First row is header, last row might be empty
        let numDataRows = lines.length - 1;
        if (lines[lines.length - 1] === "") {
            numDataRows--;
        }

        const numColumns = headerEntries.length;

        if (numColumns !== SplatalogueService.SplatalogueHeaders.length) {
            throw new Error("Unexpected header data received from Splatalogue");
        }

        const responseData: CARTA.ISpectralLineResponse = {
            headers: new Array<CARTA.ICatalogHeader>(),
            spectralLineData: {},
            dataSize: numDataRows
        };

        for (let i = 0; i < numColumns; i++) {
            // ensure headers match expected headers
            if (headerEntries[i] !== SplatalogueService.SplatalogueHeaders[i]) {
                throw new Error("Unexpected header data received from Splatalogue");
            } else {
                const header: CARTA.ICatalogHeader = {
                    dataType: SplatalogueService.SplatalogueHeaderTypeMap.get(headerEntries[i]),
                    name: headerEntries[i],
                    columnIndex: i
                };
                responseData.headers.push(header);
                responseData.spectralLineData[i] = {
                    dataType: CARTA.ColumnType.String,
                    stringData: new Array<string>(numDataRows)
                };
            }
        }

        for (let i = 1; i <= numDataRows; i++) {
            const dataEntries = lines[i].split("\t");
            if (dataEntries.length !== numColumns) {
                console.warn(`Skipping line with data entries ${dataEntries}`);
                continue;
            }

            for (let j = 0; j < numColumns; j++) {
                const entry = dataEntries[j];
                const column = responseData.spectralLineData[j];
                column.stringData[i - 1] = entry;
            }
        }

        // Copy rest freq row and shift all the others
        const restFreqColumn = 2;
        const shiftedHeaders: CARTA.ICatalogHeader[] = [];
        const shiftedData = {};
        let counter = 0;
        for (let i = 0; i < responseData.headers.length; i++) {
            const header = responseData.headers[i];
            header.columnIndex = counter;
            shiftedHeaders.push(header);
            counter++;
            if (i === restFreqColumn) {
                shiftedHeaders.push({
                    dataType: CARTA.ColumnType.Double,
                    columnIndex: counter,
                    name: "Shifted Frequency"
                });
                counter++;
            }
        }
        for (let i = 0; i < responseData.headers.length; i++) {
            if (i < restFreqColumn) {
                shiftedData[i] = responseData.spectralLineData[i];
            } else if (i === restFreqColumn) {
                shiftedData[i] = responseData.spectralLineData[i];
                shiftedData[i + 1] = {
                    dataType: CARTA.ColumnType.String,
                    stringData: responseData.spectralLineData[i].stringData.slice()
                };
            } else {
                shiftedData[i + 1] = responseData.spectralLineData[i];
            }
        }

        responseData.headers = shiftedHeaders;
        responseData.spectralLineData = shiftedData;

        return responseData;
    }

    // This function is adapted quite strictly from the backend version, and should probably be
    // cleaned up at a later stage to make it flexible and more readable.
    private static ConstructUrl(freqMin: number, freqMax: number, intensityLimit?: number) {
        const base = "/c_export.php?&sid%5B%5D=&data_version=v3.0&lill=on";
        const intensityLimitString = isFinite(intensityLimit) ? `&lill_cdms_jpl=${intensityLimit === 0 ? 0.000001 : intensityLimit}` : "";
        const lineListParameters =
            "&displayJPL=displayJPL&displayCDMS=displayCDMS&displayLovas=displayLovas" +
            "&displaySLAIM=displaySLAIM&displayToyaMA=displayToyaMA&displayOSU=displayOSU" +
            "&displayRecomb=displayRecomb&displayLisa=displayLisa&displayRFI=displayRFI";
        const lineStrengthParameters = "&ls1=ls1&ls2=ls2&ls3=ls3&ls4=ls4&ls5=ls5";
        const energyLevelParameters = "&el1=el1&el2=el2&el3=el3&el4=el4";
        const miscellaneousParameters = "&show_unres_qn=show_unres_qn&submit=Export&export_type=current&export_delimiter=tab&offset=0&limit=100000&range=on";

        // workaround to fix splatalogue frequency range parameter bug
        const freqMinString = freqMin === Math.floor(freqMin) ? freqMin.toFixed(1) : freqMin.toString();
        const freqMaxString = freqMax === Math.floor(freqMax) ? freqMax.toFixed(1) : freqMax.toString();
        const frequencyRangeString = `&frequency_units=MHz&from=${freqMinString}&to=${freqMaxString}`;
        return base + intensityLimitString + lineListParameters + lineStrengthParameters + energyLevelParameters + miscellaneousParameters + frequencyRangeString;
    }
}

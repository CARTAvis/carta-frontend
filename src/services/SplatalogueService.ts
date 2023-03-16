import axios, {AxiosInstance} from "axios";
import {CARTA} from "carta-protobuf";

export interface SpectralLineResponse {
    headers: CARTA.ICatalogHeader[];
    spectralLineData: {[key: string]: CARTA.IColumnData};
    dataSize: number;
}

export class SplatalogueService {
    private static BaseUrl = "https://almahd-staging.cv.nrao.edu/splata-slap/advanceded/false/";
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

    aliveCheck = async (): Promise<boolean> => {
        // TODO: remove alive check
        return true;
        // try {
        //     const { status } = await this.axiosInstance.head("");
        //     return status === 200;
        // } catch (err) {
        //     console.log(err)
        //     return false;
        // }
    };

    query = async (freqMin: number, freqMax: number, intensityLimit?: number): Promise<SpectralLineResponse> => {
        const params = SplatalogueService.GetParamString(freqMin, freqMax, intensityLimit);
        const response = await this.axiosInstance.post("", { body: params });
        console.log(response?.data);
        // TODO: convert object to SpectralLineResponse
        return null;
        // return SplatalogueService.ConvertTable(response?.data);
    };

    private static ConvertTable = (tableString: string) => {
        if (!tableString || typeof tableString !== "string") {
            throw new Error("invalid data received from Splatalogue");
        }

        const lines = tableString.split("\n");
        if (!lines.length) {
            throw new Error("invalid data received from Splatalogue");
        }

        const headerLine = lines[0];
        const headerEntries = headerLine.split(":");
        // First row is header, last row might be empty
        let numDataRows = lines.length - 1;
        if (lines[lines.length - 1] === "") {
            numDataRows--;
        }

        const numColumns = headerEntries.length;

        if (numColumns !== SplatalogueService.SplatalogueHeaders.length) {
            throw new Error("Unexpected header data received from Splatalogue");
        }

        const responseData: SpectralLineResponse = {
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
            const dataEntries = lines[i].split(":");
            if (dataEntries.length !== numColumns) {
                console.warn(`Skipping line with ${dataEntries.length} columns`, dataEntries, lines[i]);
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
            if (i === restFreqColumn) {
                shiftedHeaders.push({
                    dataType: CARTA.ColumnType.Double,
                    columnIndex: counter,
                    name: "Shifted Frequency"
                });
                counter++;
            }
            const header = responseData.headers[i];
            header.columnIndex = counter;
            shiftedHeaders.push(header);
            counter++;
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
    };

    private static GetParamString = (freqMin: number, freqMax: number, intensityLimit?: number): string => {
        let freqFrom = new Array(20).fill("");
        freqFrom[0] = freqMin.toString();
        let freqTo = new Array(20).fill("");
        freqTo[0] = freqMax.toString();
        const unit = "MHz";

        const intensityLimitEnabled = intensityLimit !== undefined;
        // use 0.000001 instead of 0 to avoid issues from the catalog itself
        const limit = intensityLimitEnabled ? 0 : (intensityLimit === 0 ? 0.000001 : intensityLimit);
        
        const params = {
            searchSpecies: "",
            speciesSelectBox: [""],
            dataVersion: "v3.0",
            userInputFrequenciesFrom: freqFrom,
            userInputFrequenciesTo: freqTo,
            userInputFrequenciesUnit: unit,
            frequencyRedshift: 0,
            energyFrom: 0,
            energyTo: 0,
            energyRangeType: "el_cm-1",
            lineIntensity: intensityLimitEnabled ? "CDMS/JPL (log)" : "None",
            lineIntensityLowerLimit: limit,
            excludeAtmosSpecies: false,
            excludePotentialInterstellarSpecies: false,
            excludeProbableInterstellarSpecies: false,
            excludeKnownASTSpecies: false,
            showOnlyAstronomicallyObservedTransitions: false,
            showOnlyNRAORecommendedFrequencies: false,
            lineListDisplayJPL: true,
            lineListDisplayCDMS: true,
            lineListDisplayLovasNIST: !intensityLimitEnabled,
            lineListDisplaySLAIM: !intensityLimitEnabled,
            lineListDisplayToyaMA: !intensityLimitEnabled,
            lineListDisplayOSU: !intensityLimitEnabled,
            lineListDisplayRecombination: !intensityLimitEnabled,
            lineListDisplayTopModel: !intensityLimitEnabled,
            lineListDisplayRFI: !intensityLimitEnabled,
            lineStrengthDisplayCDMSJPL: true,
            lineStrengthDisplaySijMu2: true,
            lineStrengthDisplaySij: true,
            lineStrengthDisplayAij: true,
            lineStrengthDisplayLovasAST: true,
            energyLevelOne: true,
            energyLevelTwo: false,
            energyLevelThree: false,
            energyLevelFour: false,
            displayObservedTransitions: false,
            displayG358MaserTransitions: false,
            displayObservationReference: false,
            displayObservationSource: false,
            displayTelescopeLovasNIST: false,
            frequencyErrorLimit: false,
            displayHFSIntensity: false,
            displayUnresolvedQuantumNumbers: true,
            displayUpperStateDegeneracy: false,
            displayMoleculeTag: false,
            displayQuantumNumberCode: false,
            displayLabRef: false,
            displayOrderedFrequencyOnly: false,
            displayNRAORecommendedFrequencies: false,
            displayUniqueSpeciesTag: false,
            displayUniqueLineIDNumber: false,
            exportType: "current",
            exportDelimiter: "tab",
            exportLimit: "allRecords",
            exportStart: 1,
            exportStop: 250
        };
        return JSON.stringify(params);
    };
}

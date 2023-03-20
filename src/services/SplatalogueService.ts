import axios, {AxiosInstance} from "axios";
import {CARTA} from "carta-protobuf";

import {SpectralLineHeaders} from "stores/Widgets";

export interface SpectralLineResponse {
    headers: CARTA.ICatalogHeader[];
    spectralLineData: {[key: string]: CARTA.IColumnData};
    dataSize: number;
}

export class SplatalogueService {
    private static BaseUrl = "https://almahd-staging.cv.nrao.edu/splata-slap/advanceded/false/";
    private readonly axiosInstance: AxiosInstance;

    private static SplatalogueHeaderTypeMap = new Map<SpectralLineHeaders, CARTA.ColumnType>([
        [SpectralLineHeaders.Species, CARTA.ColumnType.String],
        [SpectralLineHeaders.ChemicalName, CARTA.ColumnType.String],
        [SpectralLineHeaders.ShiftedFrequency, CARTA.ColumnType.Double],
        [SpectralLineHeaders.RestFrequency, CARTA.ColumnType.Double],
        [SpectralLineHeaders.RestFrequencyErr, CARTA.ColumnType.Double],
        [SpectralLineHeaders.MeasuredFrequency, CARTA.ColumnType.Double],
        [SpectralLineHeaders.MeasuredFrequencyErr, CARTA.ColumnType.Double],
        [SpectralLineHeaders.ResolvedQN, CARTA.ColumnType.String],
        [SpectralLineHeaders.UnresolvedQN, CARTA.ColumnType.String],
        [SpectralLineHeaders.IntensityCDMS, CARTA.ColumnType.Double],
        [SpectralLineHeaders.IntensitySijm2, CARTA.ColumnType.Double],
        [SpectralLineHeaders.IntensitySij, CARTA.ColumnType.Double],
        [SpectralLineHeaders.IntensityAij, CARTA.ColumnType.Double],
        [SpectralLineHeaders.IntensityLovas, CARTA.ColumnType.Double],
        [SpectralLineHeaders.EnergyLowerCM, CARTA.ColumnType.Double],
        [SpectralLineHeaders.EnergyLowerK, CARTA.ColumnType.Double],
        [SpectralLineHeaders.EnergyUpperCM, CARTA.ColumnType.Double],
        [SpectralLineHeaders.EnergyUpperK, CARTA.ColumnType.Double],
        [SpectralLineHeaders.LineList, CARTA.ColumnType.String]
    ]);

    private static SplatalogueHeaderStringMap = new Map<SpectralLineHeaders, string>([
        [SpectralLineHeaders.Species, "name"],
        [SpectralLineHeaders.ChemicalName, "chemical_name"],
        [SpectralLineHeaders.ShiftedFrequency, "orderedFreq"],
        [SpectralLineHeaders.RestFrequency, "orderedFreq"],
        [SpectralLineHeaders.RestFrequencyErr, "orderedFreq"],
        [SpectralLineHeaders.MeasuredFrequency, "measFreq"],
        [SpectralLineHeaders.MeasuredFrequencyErr, "measFreq"],
        [SpectralLineHeaders.ResolvedQN, "resolved_QNs"],
        [SpectralLineHeaders.UnresolvedQN, "unres_quantum_numbers"],
        [SpectralLineHeaders.IntensityCDMS, "intintensity"],
        [SpectralLineHeaders.IntensitySijm2, "sijmu2"],
        [SpectralLineHeaders.IntensitySij, "sij"],
        [SpectralLineHeaders.IntensityAij, "aij"],
        [SpectralLineHeaders.IntensityLovas, "LovasASTIntensity"],
        [SpectralLineHeaders.EnergyLowerCM, "lower_state_energy"],
        [SpectralLineHeaders.EnergyLowerK, "lower_state_energy_K"],
        [SpectralLineHeaders.EnergyUpperCM, "upper_state_energy"],
        [SpectralLineHeaders.EnergyUpperK, "upper_state_energy_K"],
        [SpectralLineHeaders.LineList, "linelist"]
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
        return SplatalogueService.ConvertTable(response?.data);
    };

    private static ConvertTable = (data: object[]) => {
        if (!data) {
            throw new Error("invalid data received from Splatalogue");
        }

        const numDataRows = data.length;
        const responseData: SpectralLineResponse = {
            headers: new Array<CARTA.ICatalogHeader>(),
            spectralLineData: {},
            dataSize: numDataRows
        };

        let columnIndex = 0;
        SplatalogueService.SplatalogueHeaderTypeMap.forEach((value, key) => {
            const header: CARTA.ICatalogHeader = {
                dataType: value,
                name: key,
                columnIndex: columnIndex,
            };
            responseData.headers.push(header);
            responseData.spectralLineData[columnIndex] = {
                dataType: CARTA.ColumnType.String,
                stringData: new Array<string>(numDataRows)
            };
            columnIndex++;
        });

        for (let i = 0; i < numDataRows; i++) {
            const line = data[i];

            let j = 0;
            SplatalogueService.SplatalogueHeaderStringMap.forEach((value, key) => {
                let entry = line[value]?.toString() ?? "";
                const column = responseData.spectralLineData[j];

                if (key === "Species") {
                    entry = entry?.replace(/<[^>]+>/g, ""); // remove html tags
                }  else if (key === SpectralLineHeaders.RestFrequencyErr || key === SpectralLineHeaders.MeasuredFrequencyErr) {
                    entry = entry?.match(/\((.*?)\)/)?.[1] ?? ""; // match the string between the first "(" and ")"
                } else if (key === SpectralLineHeaders.ShiftedFrequency || key === SpectralLineHeaders.RestFrequency || key === SpectralLineHeaders.MeasuredFrequency) {
                    entry = entry?.match(/^([\S]+)/)?.[1] ?? ""; // match the string before the first space
                }

                column.stringData[i] = entry;
                j++;
            });
        }

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
        const limit = intensityLimitEnabled ? (intensityLimit === 0 ? 0.000001 : intensityLimit) : 0;
        
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

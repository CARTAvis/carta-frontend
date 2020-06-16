import {action, autorun, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {ProcessedColumnData} from "models";
import {ControlHeader} from "stores/widgets";
import {wavelengthToFrequency, SPEED_OF_LIGHT} from "utilities";

export enum SpectralLineQueryRangeType {
    Range = "Range",
    Center = "Center"
}

export enum SpectralLineQueryUnit {
    GHz = "GHz",
    MHz = "MHz",
    CM = "cm",
    MM = "mm"
}

export enum SpectralLineHeaders {
    Species = "Species",
    ChemicalName = "Chemical Name",
    RedshiftedFrequency = "Redshifted Frequency",
    RestFrequency = "Rest Frequency",
    FreqErr = "Freq Err(rest frame,redshifted)",
    MeasFreqMHz = "Meas Freq-MHz(rest frame,redshifted)",
    MeasFreqErr = "Meas Freq Err(rest frame,redshifted)",
    QuantumNumber = "Resolved QNs",
    IntensityCDMS = "CDMS/JPL Intensity",
    IntensitySijm2 = "Sij Miu^2",
    IntensitySij = "Sij",
    IntensityAij = "Aij",
    IntensityLovas = "Lovas/AST",
    EnergyLowerCM = "E_L (cm^-1)",
    EnergyLowerK = "E_L (K)",
    EnergyUpperCM = "E_U (cm^-1)",
    EnergyUpperK = "E_U (K)",
    LineList = "Linelist"
}

const SPECTRAL_LINE_DESCRIPTION = new Map<SpectralLineHeaders, string>([
    [SpectralLineHeaders.Species, "Name of the Species"],
    [SpectralLineHeaders.QuantumNumber, "Resolved Quantum Number"],
    [SpectralLineHeaders.IntensityCDMS, "Intensity(for JPL/CDMS)"],
    [SpectralLineHeaders.IntensityLovas, "Intensity(for Lovas/AST)"]
]);

export interface SpectralLineHeader {
    name: SpectralLineHeaders;
    desc: string;
}

export enum RedshiftType {
    V = "V",
    Z = "Z"
}

const FREQUENCY_COLUMN_INDEX = 2;

export class SpectralLineOverlayWidgetStore extends RegionWidgetStore {
    private static readonly initDisplayedColumnSize = 6;

    @observable queryRangeType: SpectralLineQueryRangeType;
    @observable queryRange: NumberRange;
    @observable queryRangeByCenter: NumberRange;
    @observable queryUnit: SpectralLineQueryUnit;
    @observable isQuerying: boolean;
    @observable columnHeaders: Array<CARTA.CatalogHeader>;
    @observable headerDisplay: Map<SpectralLineHeaders, boolean>;
    @observable redshiftType: RedshiftType;
    @observable redshiftInput: number;
    @observable queryResultTableRef: Table;
    @observable controlHeaders: Map<string, ControlHeader>;
    @observable queryResult: Map<number, ProcessedColumnData>;
    @observable originalFreqColumn: ProcessedColumnData;
    @observable numDataRows: number;

    @action setQueryRangeType = (queryRangeType: SpectralLineQueryRangeType) => {
        this.queryRangeType = queryRangeType;
    };

    @action setQueryRange = (queryRange: NumberRange) => {
        this.queryRange = queryRange;
    };

    @action setQueryRangeByCenter = (queryRange: NumberRange) => {
        this.queryRangeByCenter = queryRange;
    };

    @action setQueryUnit = (queryUnit: SpectralLineQueryUnit) => {
        this.queryUnit = queryUnit;
    };

    @action setHeaderDisplay = (header: SpectralLineHeaders) => {
        this.headerDisplay.set(header, !this.headerDisplay.get(header));
    };

    @action setRedshiftType = (redshiftType: RedshiftType) => {
        this.redshiftType = redshiftType;
     };

    @action setRedshiftInput = (input: number) => {
        if (isFinite(input)) {
            this.redshiftInput = input;
        }
    };

    @action setQueryResultTableRef(ref: Table) {
        this.queryResultTableRef = ref;
    }

    @action query = () => {
        let valueMin = 0;
        let valueMax = 0;
        if (this.queryRangeType === SpectralLineQueryRangeType.Range) {
            valueMin = this.queryRange[0];
            valueMax = this.queryRange[1];
        } else {
            valueMin = this.queryRangeByCenter[0] - this.queryRangeByCenter[1];
            valueMax = this.queryRangeByCenter[0] + this.queryRangeByCenter[1];
        }

        const freqMHzFrom = this.calculateFreqMHz(valueMin, this.queryUnit);
        const freqMHzTo = this.calculateFreqMHz(valueMax, this.queryUnit);

        if (!isFinite(freqMHzFrom) || !isFinite(freqMHzTo)) {
            AppStore.Instance.alertStore.showAlert("Invalid frequency range.");
        } else if (freqMHzFrom === freqMHzTo) {
            AppStore.Instance.alertStore.showAlert("Please specify a frequency range.");
        } else if (Math.abs(freqMHzTo - freqMHzFrom) > 1e4) {
            AppStore.Instance.alertStore.showAlert("Frequency range is too wide. Please specify a frequency range within 10GHz.");
        } else {
            this.isQuerying = true;
            const data =
            `Species	Chemical Name	Freq-MHz(rest frame,redshifted)	Freq Err(rest frame,redshifted)	Meas Freq-MHz(rest frame,redshifted)	Meas Freq Err(rest frame,redshifted)	Resolved QNs	CDMS/JPL Intensity	S<sub>ij</sub>&#956;<sup>2</sup> (D<sup>2</sup>)	S<sub>ij</sub>	Log<sub>10</sub> (A<sub>ij</sub>)	Lovas/AST Intensity	E_L (cm^-1)	E_L (K)	E_U (cm^-1)	E_U (K)	Linelist
            H2CO	Formaldehyde	0.0004	0			6(5,1)-6(5,2)	-19.9244	109.59367	6.719	-29.67917		255.3456	367.38325	255.3456	367.38325	JPL
            H2CO	Formaldehyde	0.0004	0			6(5,1)-6(5,2)	-19.9242	109.64415	6.722	-29.67897		255.3456	367.38325	255.3456	367.38325	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			23(5,18)-23(5,19)A,vt=2	-23.063	6.89188	0	-30.36989		1025.747	1475.81264	1025.747	1475.81264	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			22(5,17)-22(5,18)A,vt=2	-22.97	7.20636	0	-30.33162		990.4	1424.95648	990.4	1424.95648	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			21(5,16)-21(5,17)A,vt=2	-22.88	7.53846	0	-30.29231		956.585	1376.30452	956.585	1376.30452	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			11(4,7)-11(4,8)A,vt=2	-21.91	8.96102	0	-29.9455		526.916	758.11023	526.916	758.11023	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			10(4,6)-10(4,7)A,vt=2	-21.835	9.81915	0	-29.86627		509.976	733.73749	509.976	733.73749	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			6(3,4)-6(3,3)A,vt=2	-21.829	8.99023	0	-29.6963		488.706	703.13488	488.706	703.13488	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			2(2,1)-2(2,0)A,vt=2	-22.005	10.78742	0	-29.20218		611.206	879.38404	611.206	879.38404	CDMS
            CH318OHvt=0,1&2	Methanol	0.001	0			33(7,26)-33(7,27)A,vt=1	-23.568	8.02371	0	-30.45783		1299.911	1870.27121	1299.911	1870.27121	CDMS\n`;
            this.parsingQueryResponse(data);
            this.isQuerying = false;
        }
    };

    @action.bound setColumnFilter(filter: string, columnName: string) {
        this.controlHeaders.get(columnName).filter = filter;
    }

    @action clearData() {
        this.queryResult.clear();
    }

    @computed get formalizedHeaders(): SpectralLineHeader[] {
        let formalizedHeaders: SpectralLineHeader[] = [];
        this.columnHeaders.forEach(header => {
            if ((<any> Object).values(SpectralLineHeaders).includes(header.name)) {
                formalizedHeaders.push({name: header.name as SpectralLineHeaders, desc: SPECTRAL_LINE_DESCRIPTION.get(header.name as SpectralLineHeaders)});
            }
        });
        return formalizedHeaders;
    }

    @computed get redshiftFactor() {
        return this.redshiftType === RedshiftType.V ? Math.sqrt((1 - this.redshiftInput / SPEED_OF_LIGHT) / (1 + this.redshiftInput / SPEED_OF_LIGHT)) : 1 / (this.redshiftInput + 1);
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        let displayedColumnHeaders = [];
        this.columnHeaders.forEach(columnHeader => {
            if (this.headerDisplay.get(columnHeader.name as SpectralLineHeaders)) {
                displayedColumnHeaders.push(columnHeader);
            }
        });
        return displayedColumnHeaders;
    }

    private calculateFreqMHz = (value: number, unit: SpectralLineQueryUnit): number => {
        if (!isFinite(value) || !unit) {
            return null;
        }
        if (unit === SpectralLineQueryUnit.CM) {
            return wavelengthToFrequency(value / 10) / 1e6;
        } else if (unit === SpectralLineQueryUnit.MM) {
            return wavelengthToFrequency(value / 100) / 1e6;
        } else if (unit === SpectralLineQueryUnit.GHz) {
            return value * 1000;
        } else if (unit === SpectralLineQueryUnit.MHz) {
            return value;
        } else {
            return null;
        }
    };

    private initHeaderRelated() {
        // column header
        this.columnHeaders = [];
        const headers = Object.values(SpectralLineHeaders);
        for (let columnIndex = 0; columnIndex < headers.length; columnIndex++) {
            const columnName = headers[columnIndex];
            let dataType = columnName === (SpectralLineHeaders.RedshiftedFrequency || SpectralLineHeaders.RestFrequency) ? CARTA.ColumnType.Double : CARTA.ColumnType.String;
            this.columnHeaders.push(new CARTA.CatalogHeader({name: columnName, dataType: dataType, columnIndex: columnIndex}));
        }

        // control header
        this.controlHeaders.clear();
        if (this.columnHeaders.length) {
            for (let columnIndex = 0; columnIndex < this.columnHeaders.length; columnIndex++) {
                const header = this.columnHeaders[columnIndex];
                let controlHeader: ControlHeader = {
                    columnIndex: columnIndex,
                    dataIndex: columnIndex,
                    display: columnIndex < SpectralLineOverlayWidgetStore.initDisplayedColumnSize ? true : false,
                    representAs: undefined,
                    filter: undefined,
                    columnWidth: null
                };
                this.controlHeaders.set(header.name, controlHeader);
            }
        }
    }

    private parsingQueryResponse = (response: string) => {
        if (!response) {
            return;
        }
        const lines = response.replace(/\n$/, "").split(/\r?\n/);
        if (lines && lines.length > 1) {
            const spectralLineInfo = [];
            lines.forEach(line => {
                spectralLineInfo.push(line.split(/\t/));
            });

            this.initHeaderRelated();

            // find column data: spectralLineInfo[1] ~ spectralLineInfo[lines.length - 1]
            const numDataRows = lines.length - 1;
            if (this.columnHeaders.length > 0) {
                for (let columnIndex = 0; columnIndex < this.columnHeaders.length; columnIndex++) {
                    const columnName = this.columnHeaders[columnIndex].name;
                    let dataType = CARTA.ColumnType.String;
                    let data = [];
                    if (columnName === (SpectralLineHeaders.Species || SpectralLineHeaders.ChemicalName)) {
                        for (let row = 0; row < numDataRows; row++) {
                            const valString = spectralLineInfo[row + 1][columnIndex];
                            data.push(valString);
                        }
                    } else if (columnName === SpectralLineHeaders.RedshiftedFrequency) {
                        dataType = CARTA.ColumnType.Double;
                        for (let row = 0; row < numDataRows; row++) {
                            const valString = spectralLineInfo[row + 1][columnIndex];
                            data.push(Number(valString) * this.redshiftFactor);
                        }
                    } else if (columnName === SpectralLineHeaders.RestFrequency) {
                        dataType = CARTA.ColumnType.Double;
                        for (let row = 0; row < numDataRows; row++) {
                            const valString = spectralLineInfo[row + 1][columnIndex - 1];
                            data.push(Number(valString));
                        }
                        this.originalFreqColumn = {dataType: dataType, data: data};
                    } else {
                        for (let row = 0; row < numDataRows; row++) {
                            const valString = spectralLineInfo[row + 1][columnIndex - 1];
                            data.push(valString);
                        }
                    }
                    this.queryResult.set(columnIndex, {dataType: dataType, data: data});
                }
            }

            // update numDataRows
            this.numDataRows = numDataRows;
        }
    };

    constructor() {
        super(RegionsType.CLOSED);
        this.queryRangeType = SpectralLineQueryRangeType.Range;
        this.queryRange = [0, 0];
        this.queryRangeByCenter = [0, 0];
        this.queryUnit = SpectralLineQueryUnit.MHz;
        this.isQuerying = false;
        this.columnHeaders = [];
        this.headerDisplay = new Map<SpectralLineHeaders, boolean>();
        Object.values(SpectralLineHeaders).forEach(header => this.headerDisplay.set(header, true));
        this.redshiftType = RedshiftType.V;
        this.redshiftInput = 0;
        this.queryResultTableRef = undefined;
        this.controlHeaders = new Map<string, ControlHeader>();
        this.queryResult = new Map<number, ProcessedColumnData>();
        this.originalFreqColumn = undefined;
        this.numDataRows = 1;

        // update frequency column when redshift changes
        autorun(() => {
            if (this.queryResult.size > 0 && this.originalFreqColumn && this.originalFreqColumn.data) {
                this.queryResult.set(FREQUENCY_COLUMN_INDEX, {
                    dataType: CARTA.ColumnType.Double,
                    data: (this.originalFreqColumn.data as Array<number>).map(val => val * this.redshiftFactor)
                });
            }
        });
    }
}

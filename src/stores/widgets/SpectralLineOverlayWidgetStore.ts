import {action, autorun, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {BackendService} from "services";
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
    ShiftedFrequency = "Shifted Frequency",
    RestFrequency = "Rest Frequency",
    FreqErr = "Freq Err(rest frame,redshifted)",
    MeasFreqMHz = "Meas Freq-MHz(rest frame,redshifted)",
    MeasFreqErr = "Meas Freq Err(rest frame,redshifted)",
    ResolvedQN = "Resolved QNs",
    UnresolvedQN = "Unresolved QNs",
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
    [SpectralLineHeaders.ResolvedQN, "Resolved Quantum Number"],
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

export interface SpectralLine {
    species: string;
    value: number;
    qn: string;
}

const SPECIES_COLUMN_INDEX = 0;
const SHIFTIED_FREQUENCY_COLUMN_INDEX = 2;
const RESOLVED_QN_COLUMN_INDEX = 7;

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
    @observable private isLineSelectedArray: Array<boolean>;
    @observable originalFreqColumn: ProcessedColumnData;
    @observable sortingInfo: {columnName: string, sortingType: CARTA.SortingType};
    @observable numDataRows: number;
    @observable selectedSpectralProfilerID: string;

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

    @action selectAllLines = () => {
        if (this.isLineSelectedArray && this.isLineSelectedArray.length > 0) {
            const isSelectAll = this.isSelectingAllLines;
            for (let rowIndex = 0; rowIndex < this.isLineSelectedArray.length; rowIndex++) {
                this.isLineSelectedArray[rowIndex] = isSelectAll ? false : true;
            }
        }
    };

    @action selectSingleLine = (rowIndex: number) => {
        if (this.isLineSelectedArray && isFinite(rowIndex) && rowIndex >= 0 && rowIndex < this.isLineSelectedArray.length) {
            this.isLineSelectedArray[rowIndex] = !this.isLineSelectedArray[rowIndex];
        }
    };

    @action setSelectedSpectralProfiler = (widgetID: string) => {
        this.selectedSpectralProfilerID = widgetID;
    };

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
            const backendService = BackendService.Instance;
            backendService.requestSpectralLine(new CARTA.DoubleBounds({min: freqMHzFrom, max: freqMHzTo})).subscribe(ack => {
                this.isQuerying = false;
                if (ack.success && ack.dataSize) {
                    // TODO: handle headers & data
                }
            }, error => {
                this.isQuerying = false;
                console.error(error);
                AppStore.Instance.alertStore.showAlert(error);
            });

            /*
            const data =
            `Species	Chemical Name	Freq-MHz(rest frame,redshifted)	Freq Err(rest frame,redshifted)	Meas Freq-MHz(rest frame,redshifted)	Meas Freq Err(rest frame,redshifted)	Resolved QNs	Unresolved Quantum Numbers	CDMS/JPL Intensity	S<sub>ij</sub>&#956;<sup>2</sup> (D<sup>2</sup>)	S<sub>ij</sub>	Log<sub>10</sub> (A<sub>ij</sub>)	Lovas/AST Intensity	E_L (cm^-1)	E_L (K)	E_U (cm^-1)	E_U (K)	Linelist
            H2CO	Formaldehyde	230530	0			6(5,1)-6(5,2)	 6 5 1       6 5 2    	-19.9244	109.59367	6.719	-29.67917		255.3456	367.38325	255.3456	367.38325	JPL
            H2CO	Formaldehyde	230531	0			6(5,1)-6(5,2)	 6 5 1       6 5 2    	-19.9242	109.64415	6.722	-29.67897		255.3456	367.38325	255.3456	367.38325	CDMS
            CH318OHvt=0,1&2	Methanol	230532	0			23(5,18)-23(5,19)A,vt=2	23 518 6    23 519 6  	-23.063	6.89188	0	-30.36989		1025.747	1475.81264	1025.747	1475.81264	CDMS
            CH318OHvt=0,1&2	Methanol	230533	0			22(5,17)-22(5,18)A,vt=2	22 517 6    22 518 6  	-22.97	7.20636	0	-30.33162		990.4	1424.95648	990.4	1424.95648	CDMS
            CH318OHvt=0,1&2	Methanol	230534	0			21(5,16)-21(5,17)A,vt=2	21 516 6    21 517 6  	-22.88	7.53846	0	-30.29231		956.585	1376.30452	956.585	1376.30452	CDMS\n`;
            this.parsingQueryResponse(data);
            this.isQuerying = false;
            */
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

    @computed get isSelectingAllLines(): boolean {
        let result = true;
        if (this.isLineSelectedArray && this.isLineSelectedArray.length > 0) {
            for (let rowIndex = 0; rowIndex < this.isLineSelectedArray.length; rowIndex++) {
                result = result && this.isLineSelectedArray[rowIndex];
            }
        }
        return result;
    }

    @computed get isSelectingIndeterminatedLines(): boolean {
        let result = false;
        if (this.isLineSelectedArray && this.isLineSelectedArray.length > 0) {
            for (let rowIndex = 0; rowIndex < this.isLineSelectedArray.length; rowIndex++) {
                result = result || this.isLineSelectedArray[rowIndex];
            }
        }
        return result && !this.isSelectingAllLines;
    }

    @computed get manualSelectionData(): boolean[] {
        // Create new instance for trigger re-rendering
        return [...this.isLineSelectedArray];
    }

    @computed get selectedLines(): SpectralLine[] {
        const selectedLines: SpectralLine[] = [];
        if (this.isLineSelectedArray) {
            for (let rowIndex = 0; rowIndex < this.isLineSelectedArray.length; rowIndex++) {
                if (this.isLineSelectedArray[rowIndex]) {
                    const speciesColumn = this.queryResult.get(SPECIES_COLUMN_INDEX);
                    const freqeuncyColumn = this.queryResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX);
                    const QNColumn = this.queryResult.get(RESOLVED_QN_COLUMN_INDEX);
                    selectedLines.push({
                        species: speciesColumn.data[rowIndex] as string,
                        value: freqeuncyColumn.data[rowIndex] as number,
                        qn: QNColumn.data[rowIndex] as string
                    });
                }
            }
        }
        return selectedLines;
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
            let dataType = columnName === (SpectralLineHeaders.ShiftedFrequency || SpectralLineHeaders.RestFrequency) ? CARTA.ColumnType.Double : CARTA.ColumnType.String;
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
                    if (columnName === SpectralLineHeaders.Species || columnName === SpectralLineHeaders.ChemicalName) {
                        for (let row = 0; row < numDataRows; row++) {
                            const valString = spectralLineInfo[row + 1][columnIndex];
                            data.push(valString);
                        }
                    } else if (columnName === SpectralLineHeaders.ShiftedFrequency) {
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
            this.isLineSelectedArray = new Array<boolean>(numDataRows).fill(false);
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
        this.isLineSelectedArray = [];
        this.selectedSpectralProfilerID = "";
        this.sortingInfo = {columnName: null, sortingType: null};

        // update frequency column when redshift changes
        autorun(() => {
            if (this.queryResult.size > 0 && this.originalFreqColumn && this.originalFreqColumn.data) {
                this.queryResult.set(SHIFTIED_FREQUENCY_COLUMN_INDEX, {
                    dataType: CARTA.ColumnType.Double,
                    data: (this.originalFreqColumn.data as Array<number>).map(val => val * this.redshiftFactor)
                });
            }
        });
    }
}

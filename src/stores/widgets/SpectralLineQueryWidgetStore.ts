import {action, autorun, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore, ControlHeader} from "stores";
import * as _ from "lodash";
import {BackendService} from "services";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {ProcessedColumnData, ProtobufProcessing} from "models";
import {getComparisonOperatorAndValue, wavelengthToFrequency, SPEED_OF_LIGHT} from "utilities";

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
    RestFrequencySPLA = "Freq-MHz(rest frame,redshifted)",
    RestFrequency = "Rest Frequency",
    RestFrequencyErrSPLA = "Freq Err(rest frame,redshifted)",
    RestFrequencyErr = "Rest Frequency Error",
    MeasuredFrequencySPLA = "Meas Freq-MHz(rest frame,redshifted)",
    MeasuredFrequency = "Measured Frequency",
    MeasuredFrequencyErrSPLA = "Meas Freq Err(rest frame,redshifted)",
    MeasuredFrequencyErr = "Measured Frequency Error",
    ResolvedQN = "Resolved QNs",
    UnresolvedQNSPLA = "Unresolved Quantum Numbers",
    UnresolvedQN = "Unresolved QNs",
    IntensityCDMS = "CDMS/JPL Intensity",
    IntensitySijm2SPLA = "S<sub>ij</sub>&#956;<sup>2</sup> (D<sup>2</sup>)",
    IntensitySijm2 = "Sij \u03BC^2",
    IntensitySijSPLA = "S<sub>ij</sub>",
    IntensitySij = "Sij",
    IntensityAijSPLA = "Log<sub>10</sub> (A<sub>ij</sub>)",
    IntensityAij = "Log10(Aij)",
    IntensityLovas = "Lovas/AST Intensity",
    EnergyLowerCM = "E_L (cm^-1)",
    EnergyLowerK = "E_L (K)",
    EnergyUpperCM = "E_U (cm^-1)",
    EnergyUpperK = "E_U (K)",
    LineList = "Linelist"
}

// map for replacing original Splatalogue header to comprehensive header
const SPLA_HEADER_MAP = new Map<SpectralLineHeaders, SpectralLineHeaders>([
    [SpectralLineHeaders.RestFrequencySPLA, SpectralLineHeaders.RestFrequency],
    [SpectralLineHeaders.RestFrequencyErrSPLA, SpectralLineHeaders.RestFrequencyErr],
    [SpectralLineHeaders.MeasuredFrequencySPLA, SpectralLineHeaders.MeasuredFrequency],
    [SpectralLineHeaders.MeasuredFrequencyErrSPLA, SpectralLineHeaders.MeasuredFrequencyErr],
    [SpectralLineHeaders.UnresolvedQNSPLA, SpectralLineHeaders.UnresolvedQN],
    [SpectralLineHeaders.IntensitySijm2SPLA, SpectralLineHeaders.IntensitySijm2],
    [SpectralLineHeaders.IntensitySijSPLA, SpectralLineHeaders.IntensitySij],
    [SpectralLineHeaders.IntensityAijSPLA, SpectralLineHeaders.IntensityAij]
]);

const SPECTRAL_LINE_DESCRIPTION = new Map<SpectralLineHeaders, string>([
    [SpectralLineHeaders.Species, "Descriptive formula of molecular species"],
    [SpectralLineHeaders.ChemicalName, "Common chemical name for species"],
    [SpectralLineHeaders.ShiftedFrequency, "Shifted frequency according to the input velocity or redshift"],
    [SpectralLineHeaders.RestFrequency, "Frequency at the rest frame"],
    [SpectralLineHeaders.RestFrequencyErr, "Frequency error at the rest frame"],
    [SpectralLineHeaders.MeasuredFrequency, "Frequency measured from laboratories"],
    [SpectralLineHeaders.MeasuredFrequencyErr, "Frequency error measured from laboratories"],
    [SpectralLineHeaders.ResolvedQN, "Rotational/rovibrational quantum numbers associated with the transition"],
    [SpectralLineHeaders.UnresolvedQN, "Unresolved Quantum Numbers"],
    [SpectralLineHeaders.IntensityCDMS, "Boltzmann-weighted logarithmic intensity of transition, given at 300 K"],
    [SpectralLineHeaders.IntensitySijm2, "Dipole-weighted transition dipole matrix elements (Debye^2)"],
    [SpectralLineHeaders.IntensitySij, "Line strength"],
    [SpectralLineHeaders.IntensityAij, "Base-10 logarithm of the Einstein A coefficient (s^-1)"],
    [SpectralLineHeaders.IntensityLovas, "Observed astronomical intensity for given transition"],
    [SpectralLineHeaders.EnergyLowerCM, "Lower level energy in wave number"],
    [SpectralLineHeaders.EnergyLowerK, "Lower level energy in K"],
    [SpectralLineHeaders.EnergyUpperCM, "Upper level energy in wave number"],
    [SpectralLineHeaders.EnergyUpperK, "Upper level energy in K"],
    [SpectralLineHeaders.LineList, "Originated catalogue"]
]);

export interface SpectralLineHeader {
    name: SpectralLineHeaders;
    desc: string;
}

export enum RedshiftType {
    V = "Velocity (km/s)",
    Z = "Redshift"
}

export interface SpectralLine {
    species: string;
    value: number;
    qn: string;
}

const SPECIES_COLUMN_INDEX = 0;
const SHIFTIED_FREQUENCY_COLUMN_INDEX = 2;
const MEASURED_FREQUENCY_COLUMN_INDEX = 5;
const RESOLVED_QN_COLUMN_INDEX = 7;
const FREQUENCY_RANGE_LIMIT = 2 * 1e4; // 20000 MHz

export class SpectralLineQueryWidgetStore extends RegionWidgetStore {
    @observable queryRangeType: SpectralLineQueryRangeType;
    @observable queryRange: NumberRange;
    @observable queryRangeByCenter: NumberRange;
    @observable queryUnit: SpectralLineQueryUnit;
    @observable intensityLimitEnabled: boolean;
    @observable intensityLimitValue: number;
    @observable isQuerying: boolean;
    @observable columnHeaders: Array<CARTA.ICatalogHeader>;
    @observable headerDisplay: Map<SpectralLineHeaders, boolean>;
    @observable redshiftType: RedshiftType;
    @observable redshiftInput: number;
    @observable queryResultTableRef: Table;
    @observable filterResult: Map<number, ProcessedColumnData>;
    @observable private isLineSelectedArray: Array<boolean>;
    @observable sortingInfo: {columnName: string, sortingType: CARTA.SortingType};
    @observable numDataRows: number;
    @observable selectedSpectralProfilerID: string;
    @observable controlHeader: Map<string, ControlHeader>;
    @observable isDataFiltered: boolean;

    private queryResult: Map<number, ProcessedColumnData>;
    private originalShiftedData: Array<number>;
    private filteredRowIndexes: Array<number>;

    constructor() {
        super(RegionsType.CLOSED);
        this.queryRangeType = SpectralLineQueryRangeType.Range;
        this.queryRange = [0, 0];
        this.queryRangeByCenter = [0, 0];
        this.queryUnit = SpectralLineQueryUnit.MHz;
        this.intensityLimitEnabled = true;
        this.intensityLimitValue = -5;
        this.isQuerying = false;
        this.columnHeaders = [];
        this.headerDisplay = new Map<SpectralLineHeaders, boolean>();
        Object.values(SpectralLineHeaders).forEach(header => this.headerDisplay.set(header, true));
        this.redshiftType = RedshiftType.V;
        this.redshiftInput = 0;
        this.queryResultTableRef = undefined;
        this.queryResult = new Map<number, ProcessedColumnData>();
        this.filterResult = new Map<number, ProcessedColumnData>();
        this.originalShiftedData = [];
        this.filteredRowIndexes = [];
        this.numDataRows = 0;
        this.isLineSelectedArray = [];
        this.selectedSpectralProfilerID = AppStore.Instance.widgetsStore.spectralProfilerList.length > 0 ?
            AppStore.Instance.widgetsStore.spectralProfilerList[0] : undefined;
        this.sortingInfo = {columnName: null, sortingType: null};
        this.controlHeader = new Map<string, ControlHeader>();
        this.isDataFiltered = false;

        // update selected spectral profiler when currently selected is closed
        autorun(() => {
            if (!AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(this.selectedSpectralProfilerID)) {
                this.selectedSpectralProfilerID = AppStore.Instance.widgetsStore.spectralProfilerList.length > 0 ?
                AppStore.Instance.widgetsStore.spectralProfilerList[0] : undefined;
            }
        });
    }

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

    @action toggleIntensityLimit = () => {
        this.intensityLimitEnabled = !this.intensityLimitEnabled;
    };

    @action setIntensityLimitValue = (intensityLimitValue: number) => {
        this.intensityLimitValue = intensityLimitValue;
    };

    @action setHeaderDisplay = (header: SpectralLineHeaders) => {
        this.headerDisplay.set(header, !this.headerDisplay.get(header));
    };

    @action setRedshiftType = (redshiftType: RedshiftType) => {
        this.redshiftType = redshiftType;
        if (redshiftType === RedshiftType.Z && this.redshiftInput < 0) {
            this.redshiftInput = 0;
        }
     };

    @action setRedshiftInput = (input: number) => {
        if (isFinite(input)) {
            this.redshiftInput = input;
        }
        this.updateShiftedColumn();
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
        if (this.isLineSelectedArray && this.isLineSelectedArray.length > 0 && isFinite(rowIndex) && rowIndex >= 0 && rowIndex < this.isLineSelectedArray.length) {
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

        if (!isFinite(freqMHzFrom) || !isFinite(freqMHzTo) || freqMHzFrom < 0 || freqMHzTo < 0) {
            AppStore.Instance.alertStore.showAlert("Invalid frequency range.");
        } else if (freqMHzFrom === freqMHzTo) {
            AppStore.Instance.alertStore.showAlert("Please specify a frequency range.");
        } else if (Math.abs(freqMHzTo - freqMHzFrom) > FREQUENCY_RANGE_LIMIT) {
            AppStore.Instance.alertStore.showAlert(
                `Frequency range ${freqMHzFrom <= freqMHzTo ? freqMHzFrom : freqMHzTo} MHz to ${freqMHzFrom <= freqMHzTo ? freqMHzTo : freqMHzFrom} MHz is too wide.` +
                `Please specify a frequency range within ${FREQUENCY_RANGE_LIMIT / 1e3} GHz.`
            );
        } else {
            this.isQuerying = true;
            const backendService = BackendService.Instance;
            backendService.requestSpectralLine(new CARTA.DoubleBounds({min: freqMHzFrom, max: freqMHzTo}), this.intensityLimitEnabled ? this.intensityLimitValue : NaN).subscribe(ack => {
                if (ack.success && ack.dataSize >= 0) {
                    // 1. header part
                    ack.headers.forEach((header) => { // replace to comprehensive headers
                        if (SPLA_HEADER_MAP.has(header.name as SpectralLineHeaders)) {
                            header.name = SPLA_HEADER_MAP.get(header.name as SpectralLineHeaders);
                        }
                    });
                    this.columnHeaders = ack.headers.sort((a, b) => {
                        return (a.columnIndex - b.columnIndex);
                    });
                    this.initControlHeader();

                    // 2. data part
                    if (ack.dataSize > 0) {
                        this.numDataRows = ack.dataSize;
                        this.isLineSelectedArray = new Array<boolean>(this.numDataRows).fill(false);
                        this.filteredRowIndexes = Array.from(Array(this.numDataRows).keys()); // [0...N-1]
                        this.queryResult = ProtobufProcessing.ProcessCatalogData(ack.spectralLineData);
                        this.initShiftedColumn();
                        this.columnHeaders.forEach(header => { // update column data type
                            if (header.dataType === CARTA.ColumnType.Double) {
                                const column = this.queryResult.get(header.columnIndex);
                                column.dataType = CARTA.ColumnType.Double;
                                column.data = column.data as Array<number>;
                            }
                        });
                        this.filterResult = _.cloneDeep(this.queryResult);
                        this.originalShiftedData = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX).data as Array<number>;
                        this.updateShiftedColumn();
                    } else {
                        this.numDataRows = 0;
                        this.isLineSelectedArray = [];
                        this.filteredRowIndexes = [];
                        this.queryResult = new Map<number, ProcessedColumnData>();
                        this.filterResult = new Map<number, ProcessedColumnData>();
                        this.originalShiftedData = [];
                    }
                } else {
                    AppStore.Instance.alertStore.showAlert(ack.message);
                }
                this.isQuerying = false;
            }, error => {
                this.isQuerying = false;
                console.error(error);
                AppStore.Instance.alertStore.showAlert(error);
            });
        }
    };

    @action setColumnFilter = (filterInput: string, columnName: string) => {
        if (!this.controlHeader.has(columnName)) {
            return;
        }
        const current = this.controlHeader.get(columnName);
        const newHeader: ControlHeader = {
            columnIndex: current.columnIndex,
            dataIndex: current.dataIndex,
            display: current.display,
            representAs: current.representAs,
            filter: filterInput,
            columnWidth: current.columnWidth
        };
        this.controlHeader.set(columnName, newHeader);
    };

    @action filter = () => {
        // find intersections of indexes from filter criteria
        this.controlHeader.forEach((controlHeader) => {
            const filterString = controlHeader.filter;
            if (filterString !== "") {
                const column = this.filterResult.get(controlHeader.columnIndex);
                const dataType = column.dataType;
                const data = column.data;
                let indexAfterFiltering = [];
                if (dataType === CARTA.ColumnType.Double) {
                    indexAfterFiltering = this.numericFiltering(data as Array<number>, this.filteredRowIndexes, filterString);
                } else if (dataType === CARTA.ColumnType.String) {
                    this.filteredRowIndexes.forEach(dataIndex => {
                        if ((data[dataIndex] as string).includes(filterString)) {
                            indexAfterFiltering.push(dataIndex);
                        }
                    });
                }
                this.filteredRowIndexes = indexAfterFiltering;
            }
        });

        // set up filtered columns
        this.filterResult = this.getFilteredColumns();
        this.originalShiftedData = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX).data as Array<number>;
        this.updateShiftedColumn();
        this.isDataFiltered = true;
    };

    @action resetFilter = () => {
        this.controlHeader.forEach((controlHeader) => {
            controlHeader.filter = "";
        });
        if (this.isDataFiltered) {
            this.filterResult = _.cloneDeep(this.queryResult);
            this.originalShiftedData = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX).data as Array<number>;
            this.updateShiftedColumn();
        }
        this.isDataFiltered = false;
    };

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
        return this.redshiftType === RedshiftType.V ?
            Math.sqrt((1 - (this.redshiftInput * 1e3) / SPEED_OF_LIGHT) / (1 + (this.redshiftInput * 1e3) / SPEED_OF_LIGHT)) :
            1 / (this.redshiftInput + 1);
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
        return this.isLineSelectedArray && this.isLineSelectedArray.length > 0 ? [...this.isLineSelectedArray] : [];
    }

    @computed get selectedLines(): SpectralLine[] {
        const selectedLines: SpectralLine[] = [];
        if (this.isLineSelectedArray && this.isLineSelectedArray.length > 0) {
            for (let rowIndex = 0; rowIndex < this.isLineSelectedArray.length; rowIndex++) {
                if (this.isLineSelectedArray[rowIndex]) {
                    const speciesColumn = this.filterResult.get(SPECIES_COLUMN_INDEX);
                    const freqeuncyColumn = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX);
                    const QNColumn = this.filterResult.get(RESOLVED_QN_COLUMN_INDEX);
                    if (rowIndex < speciesColumn.data.length) {
                        selectedLines.push({
                            species: speciesColumn.data[rowIndex] as string,
                            value: freqeuncyColumn.data[rowIndex] as number,
                            qn: QNColumn.data[rowIndex] as string
                        });
                    }
                }
            }
        }
        return selectedLines;
    }

    @computed get filters(): string[] {
        let filters = [];
        this.controlHeader.forEach((value, key) => {
            if (value.filter) {
                filters.push(value);
            }
        });
        return filters;
    }

    @computed get resultTableInfo(): string {
        const info = `Showing ${this.numDataRows} line(s).`;
        const filteredInfo = `Showing ${this.filteredRowIndexes.length} filtered line(s) of total ${this.numDataRows} line(s).`;
        const lineSelectionInfo = this.selectedLines.length > 0 ? ` Selected ${this.selectedLines.length} line(s).` : "";
        return (this.isDataFiltered ? filteredInfo : info) + lineSelectionInfo;
    }

    private updateShiftedColumn = () => {
        const shiftedData = this.originalShiftedData.map((value) => {
            return isFinite(value) ? value * this.redshiftFactor : undefined;
        });
        this.filterResult.set(SHIFTIED_FREQUENCY_COLUMN_INDEX, {
            dataType: CARTA.ColumnType.Double,
            data: shiftedData
        });
    };

    private initControlHeader = () => {
        if (this.columnHeaders.length > 0) {
            for (let index = 0; index < this.columnHeaders.length; index++) {
                const header = this.columnHeaders[index];
                let display = false;
                let controlHeader: ControlHeader = {
                    columnIndex: header.columnIndex,
                    dataIndex: index,
                    display: display,
                    representAs: undefined,
                    filter: "",
                    columnWidth: null
                };
                this.controlHeader.set(header.name, controlHeader);
            }
        }
    };

    private numericFiltering = (columnData: Array<number>, dataIndexes: number[], filterString: string): number[] => {
        if (columnData?.length <= 0 || dataIndexes?.length <= 0 || !filterString) {
            return [];
        }

        const filter = getComparisonOperatorAndValue(filterString);
        if (filter?.operator === -1 || filter?.values.length <= 0) {
            return [];
        }

        let compareFunction = undefined;
        if (filter.operator === CARTA.ComparisonOperator.Equal && filter.values.length === 1) {
            compareFunction = (data: number): boolean => { return data === filter.values[0]; };
        } else if (filter.operator === CARTA.ComparisonOperator.NotEqual && filter.values.length === 1) {
            compareFunction = (data: number): boolean => { return data !== filter.values[0]; };
        } else if (filter.operator === CARTA.ComparisonOperator.Lesser && filter.values.length === 1) {
            compareFunction = (data: number): boolean => { return data < filter.values[0]; };
        } else if (filter.operator === CARTA.ComparisonOperator.LessorOrEqual && filter.values.length === 1) {
            compareFunction = (data: number): boolean => { return data <= filter.values[0]; };
        } else if (filter.operator === CARTA.ComparisonOperator.Greater && filter.values.length === 1) {
            compareFunction = (data: number): boolean => { return data > filter.values[0]; };
        } else if (filter.operator === CARTA.ComparisonOperator.GreaterOrEqual && filter.values.length === 1) {
            compareFunction = (data: number): boolean => { return data >= filter.values[0]; };
        } else if (filter.operator === CARTA.ComparisonOperator.RangeOpen && filter.values.length === 2) {
            const min = Math.min(filter.values[0], filter.values[1]);
            const max = Math.max(filter.values[0], filter.values[1]);
            compareFunction = (data: number): boolean => { return data >= min && data <= max; };
        } else if (filter.operator === CARTA.ComparisonOperator.RangeClosed && filter.values.length === 2) {
            const min = Math.min(filter.values[0], filter.values[1]);
            const max = Math.max(filter.values[0], filter.values[1]);
            compareFunction = (data: number): boolean => { return data > min && data < max; };
        } else {
            return [];
        }

        let filteredDataIndexes = [];
        dataIndexes.forEach(dataIndex => {
            if (dataIndex < columnData.length && compareFunction(columnData[dataIndex] as number)) {
                filteredDataIndexes.push(dataIndex);
            }
        });
        return filteredDataIndexes;
    };

    private getFilteredColumns = (): Map<number, ProcessedColumnData> => {
        let filteredColumns = new Map<number, ProcessedColumnData>();
        this.queryResult.forEach((column, columnIndex) => {
            let filteredData = [];
            this.filteredRowIndexes.forEach(dataIndex => {
                if (dataIndex < column.data.length) {
                    filteredData.push(column.data[dataIndex]);
                }
            });
            filteredColumns.set(columnIndex, {
                dataType: column.dataType,
                data: filteredData
            });
        });
        return filteredColumns;
    };

    private calculateFreqMHz = (value: number, unit: SpectralLineQueryUnit): number => {
        if (!isFinite(value) || value === null || value < 0 || !unit) {
            return undefined;
        }
        if (unit === SpectralLineQueryUnit.CM) {
            return wavelengthToFrequency(value / 100) / 1e6;
        } else if (unit === SpectralLineQueryUnit.MM) {
            return wavelengthToFrequency(value / 1000) / 1e6;
        } else if (unit === SpectralLineQueryUnit.GHz) {
            return value * 1000;
        } else if (unit === SpectralLineQueryUnit.MHz) {
            return value;
        } else {
            return undefined;
        }
    };

    // compensate missing rest frequency value with measured frequency value in shifted column
    // TODO: move to backend
    private initShiftedColumn = () => {
        const shiftedFreqData = this.queryResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX)?.data;
        const measuredFreqData = this.queryResult.get(MEASURED_FREQUENCY_COLUMN_INDEX)?.data;
        const compensatedData = (shiftedFreqData as Array<string>)?.map((valString, index) => {
            let value = parseFloat(valString);
            if (!isFinite(value) && index < measuredFreqData?.length) {
                value = parseFloat((measuredFreqData as Array<string>)[index]);
            }
            return isFinite(value) ? value : undefined;
        });
        this.queryResult.set(SHIFTIED_FREQUENCY_COLUMN_INDEX, {
            dataType: CARTA.ColumnType.Double,
            data: compensatedData
        });
    };
}

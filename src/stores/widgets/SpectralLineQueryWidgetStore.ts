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
    LineSelection = "Line selection",
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
    [SpectralLineHeaders.LineSelection, "Column for line selection"],
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

const LINE_SELECTION_COLUMN_INDEX = -1;
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
    @observable redshiftType: RedshiftType;
    @observable redshiftInput: number;
    @observable queryResultTableRef: Table;
    @observable filterResult: Map<number, ProcessedColumnData>;
    @observable sortingInfo: {columnName: string, sortingType: CARTA.SortingType};
    @observable numDataRows: number;
    @observable selectedSpectralProfilerID: string;
    @observable controlHeader: Map<string, ControlHeader>;
    @observable isDataFiltered: boolean;
    @observable private filteredRowIndexes: Array<number>;

    private queryResult: Map<number, ProcessedColumnData>;
    private originalShiftedData: Array<number>;

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
        this.redshiftType = RedshiftType.V;
        this.redshiftInput = 0;
        this.queryResultTableRef = undefined;
        this.queryResult = new Map<number, ProcessedColumnData>();
        this.filterResult = new Map<number, ProcessedColumnData>();
        this.originalShiftedData = [];
        this.filteredRowIndexes = [];
        this.numDataRows = 0;
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

    @action setHeaderDisplay = (val: boolean, columnName: string) => {
        this.controlHeader.get(columnName).display = val;
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
            const isSelectedAll = this.isSelectingAllLines;
            const queryResultData = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX).data;
            for (let rowIndex = 0; rowIndex < this.isLineSelectedArray.length; rowIndex++) {
                // update both queryResult & filterResult
                this.isLineSelectedArray[rowIndex] = !isSelectedAll;
                const realRowIndex = this.filteredRowIndexes[rowIndex];
                queryResultData[realRowIndex] = !isSelectedAll;
            }
        }
    };

    @action selectSingleLine = (rowIndex: number) => {
        if (this.isLineSelectedArray && this.isLineSelectedArray.length > 0 && isFinite(rowIndex) && rowIndex >= 0 && rowIndex < this.isLineSelectedArray.length) {
            const isSelected = this.isLineSelectedArray[rowIndex];
            this.isLineSelectedArray[rowIndex] = !isSelected;
            // update both queryResult & filterResult
            const realRowIndex = this.filteredRowIndexes[rowIndex];
            this.queryResult.get(LINE_SELECTION_COLUMN_INDEX).data[realRowIndex] = !isSelected;
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
                    this.numDataRows = ack.dataSize;
                    this.columnHeaders = this.initHeaders(ack.headers);
                    this.queryResult = this.initColumnData(ack.spectralLineData, ack.dataSize, this.columnHeaders);
                    this.filterResult = _.cloneDeep(this.queryResult);
                    this.controlHeader = this.initControlHeader(this.columnHeaders);
                    this.originalShiftedData = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX).data as Array<number>;
                    this.filteredRowIndexes = Array.from(Array(this.numDataRows).keys());
                    this.updateShiftedColumn();
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
                const column = this.queryResult.get(controlHeader.columnIndex);
                const dataType = column.dataType;
                const data = column.data;
                let indexAfterFiltering = [];
                if (dataType === CARTA.ColumnType.Double) {
                    indexAfterFiltering = this.numericFiltering(data as Array<number>, this.filteredRowIndexes, filterString);
                } else if (dataType === CARTA.ColumnType.Bool) {
                    const trimmedLowercase = filterString?.trim()?.toLowerCase();
                    if (trimmedLowercase === "t" || trimmedLowercase === "true") {
                        this.filteredRowIndexes.forEach(dataIndex => {
                            if (data[dataIndex]) {
                                indexAfterFiltering.push(dataIndex);
                            }
                        });
                    } else if (trimmedLowercase === "f" || trimmedLowercase === "false") {
                        this.filteredRowIndexes.forEach(dataIndex => {
                            if (!data[dataIndex]) {
                                indexAfterFiltering.push(dataIndex);
                            }
                        });
                    }
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
            this.filteredRowIndexes = Array.from(Array(this.numDataRows).keys());
            this.updateShiftedColumn();
        }
        this.isDataFiltered = false;
    };

    @action.bound setResultTableColumnWidth(width: number, columnName: string) {
        this.controlHeader.get(columnName).columnWidth = width;
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
        return this.redshiftType === RedshiftType.V ?
            Math.sqrt((1 - (this.redshiftInput * 1e3) / SPEED_OF_LIGHT) / (1 + (this.redshiftInput * 1e3) / SPEED_OF_LIGHT)) :
            1 / (this.redshiftInput + 1);
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        let displayedColumnHeaders = [];
        this.controlHeader?.forEach(controlHeader => {
            if (controlHeader.display && controlHeader.dataIndex < this.columnHeaders?.length) {
                displayedColumnHeaders.push(this.columnHeaders[controlHeader.dataIndex]);
            }
        });
        return displayedColumnHeaders;
    }

    @computed get isLineSelectedArray(): boolean[] {
        return this.filterResult?.get(LINE_SELECTION_COLUMN_INDEX)?.data as Array<boolean>;
    }

    @computed get isSelectingAllLines(): boolean {
        if (this.isLineSelectedArray?.length <= 0) {
            return false;
        }
        let result = true;
        this.isLineSelectedArray?.forEach(isSelected => result = result && isSelected);
        return result;
    }

    @computed get isSelectingIndeterminatedLines(): boolean {
        let result = false;
        this.isLineSelectedArray?.forEach(isSelected => result = result || isSelected);
        return result && !this.isSelectingAllLines;
    }

    @computed get selectedLines(): SpectralLine[] {
        const selectedLines: SpectralLine[] = [];
        if (this.isLineSelectedArray?.length > 0) {
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
        this.controlHeader.forEach((value) => {
            if (value.filter) {
                filters.push(value);
            }
        });
        return filters;
    }

    @computed get filteredRowNumber(): number {
        return this.filteredRowIndexes.length;
    }

    @computed get resultTableInfo(): string {
        const info = `Showing ${this.numDataRows} line(s).`;
        const filteredInfo = `Showing ${this.filteredRowIndexes.length} filtered line(s) of total ${this.numDataRows} line(s).`;
        const lineSelectionInfo = this.selectedLines.length > 0 ? ` Selected ${this.selectedLines.length} line(s).` : "";
        return (this.isDataFiltered ? filteredInfo : info) + lineSelectionInfo;
    }

    @computed get resultTableColumnWidths(): Array<number> {
        const columnWidths = [];
        this.controlHeader.forEach((value) => {
            if (value.display) {
                columnWidths.push(value.columnWidth);
            }
        });
        return columnWidths;
    }

    // TODO: move to backend
    private initHeaders = (ackHeaders) => {
        // rename to comprehensive headers
        ackHeaders.forEach((header) => {
            if (SPLA_HEADER_MAP.has(header.name as SpectralLineHeaders)) {
                // replace to comprehensive headers
                header.name = SPLA_HEADER_MAP.get(header.name as SpectralLineHeaders);
            }
        });
        // insert line selection column header
        ackHeaders.splice(0, 0, new CARTA.CatalogHeader({
            name: SpectralLineHeaders.LineSelection,
            dataType: CARTA.ColumnType.Bool,
            columnIndex: LINE_SELECTION_COLUMN_INDEX
        }));
        return ackHeaders.sort((a, b) => {
            return (a.columnIndex - b.columnIndex);
        });
    };

    // TODO: move to backend
    private initColumnData = (ackData, size: number, headers): Map<number, ProcessedColumnData> => {
        const columns = ProtobufProcessing.ProcessCatalogData(ackData);
        // 1. insert line selection boolean column
        const lineSelectionData = new Array<boolean>(size).fill(false);
        columns.set(LINE_SELECTION_COLUMN_INDEX, {
            dataType: CARTA.ColumnType.Bool,
            data: lineSelectionData
        });
        // 2. compensate missing rest frequency value with measured frequency value in shifted column
        const shiftedFreqData = columns.get(SHIFTIED_FREQUENCY_COLUMN_INDEX)?.data;
        const measuredFreqData = columns.get(MEASURED_FREQUENCY_COLUMN_INDEX)?.data;
        const compensatedData = (shiftedFreqData as Array<string>)?.map((valString, index) => {
            let value = parseFloat(valString);
            if (!isFinite(value) && index < measuredFreqData?.length) {
                value = parseFloat((measuredFreqData as Array<string>)[index]);
            }
            return isFinite(value) ? value : undefined;
        });
        columns.set(SHIFTIED_FREQUENCY_COLUMN_INDEX, {
            dataType: CARTA.ColumnType.Double,
            data: compensatedData
        });
        // 3. update column data type
        headers.forEach(header => {
            if (header.dataType === CARTA.ColumnType.Double) {
                const column = columns.get(header.columnIndex);
                column.dataType = CARTA.ColumnType.Double;
                column.data = column.data as Array<number>;
            }
        });
        return columns;
    };

    private initControlHeader = (headers): Map<string, ControlHeader> => {
        const controlHeaders = new Map<string, ControlHeader>();
        headers?.forEach((header, index) => {
            const controlHeader: ControlHeader = {
                columnIndex: header.columnIndex,
                dataIndex: index,
                display: true,
                representAs: undefined,
                filter: "",
                columnWidth: header.name === SpectralLineHeaders.LineSelection ? 50 : 150
            };
            controlHeaders.set(header.name, controlHeader);
        });
        return controlHeaders;
    };

    private updateShiftedColumn = () => {
        const shiftedData = this.originalShiftedData.map((value) => {
            return isFinite(value) ? value * this.redshiftFactor : undefined;
        });
        this.filterResult.set(SHIFTIED_FREQUENCY_COLUMN_INDEX, {
            dataType: CARTA.ColumnType.Double,
            data: shiftedData
        });
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
}

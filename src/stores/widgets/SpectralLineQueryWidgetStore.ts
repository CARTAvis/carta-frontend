import {action, autorun, computed, observable, makeObservable, runInAction} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore, ControlHeader} from "stores";
import * as _ from "lodash";
import {BackendService} from "services";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {ProcessedColumnData, ProtobufProcessing} from "models";
import {booleanFiltering, numericFiltering, stringFiltering, wavelengthToFrequency, SPEED_OF_LIGHT} from "utilities";

export enum SplataloguePingStatus {
    Checking,
    Success,
    Failure
}

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

const SPECTRAL_LINE_HEADER_WIDTH = new Map<SpectralLineHeaders, number>([
    [SpectralLineHeaders.LineSelection, 50],
    [SpectralLineHeaders.Species, 100],
    [SpectralLineHeaders.ChemicalName, 150],
    [SpectralLineHeaders.ShiftedFrequency, 165],
    [SpectralLineHeaders.RestFrequency, 150],
    [SpectralLineHeaders.RestFrequencyErr, 180],
    [SpectralLineHeaders.MeasuredFrequency, 180],
    [SpectralLineHeaders.MeasuredFrequencyErr, 215],
    [SpectralLineHeaders.ResolvedQN, 150],
    [SpectralLineHeaders.UnresolvedQN, 150],
    [SpectralLineHeaders.IntensityCDMS, 180],
    [SpectralLineHeaders.IntensitySijm2, 100],
    [SpectralLineHeaders.IntensitySij, 100],
    [SpectralLineHeaders.IntensityAij, 120],
    [SpectralLineHeaders.IntensityLovas, 180],
    [SpectralLineHeaders.EnergyLowerCM, 120],
    [SpectralLineHeaders.EnergyLowerK, 120],
    [SpectralLineHeaders.EnergyUpperCM, 120],
    [SpectralLineHeaders.EnergyUpperK, 120],
    [SpectralLineHeaders.LineList, 100]
]);

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
const DEFAULT_HEADER_WIDTH = 150;

export class SpectralLineQueryWidgetStore extends RegionWidgetStore {
    @observable splataloguePingStatus: SplataloguePingStatus;
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
    @observable private queryResult: Map<number, ProcessedColumnData>;
    @observable filterResult: Map<number, ProcessedColumnData>;
    @observable private filteredRowIndexes: Array<number>;
    @observable private isDataFiltered: boolean;
    @observable private filterNum: number;
    @observable numDataRows: number;
    @observable selectedSpectralProfilerID: string;
    @observable controlHeader: Map<string, ControlHeader>;

    // raw copy of the shifted frequency column, does not apply shifting factor
    private shiftedFreqColumnRawData: Array<number>;

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
        this.applyShiftFactor();
    };

    @action private applyShiftFactor = () => {
        const shiftedData = this.shiftedFreqColumnRawData.map(value => {
            return isFinite(value) ? value * this.redshiftFactor : undefined;
        });
        this.filterResult.set(SHIFTIED_FREQUENCY_COLUMN_INDEX, {
            dataType: CARTA.ColumnType.Double,
            data: shiftedData
        });
    };

    @action setQueryResultTableRef(ref: Table) {
        this.queryResultTableRef = ref;
    }

    @action selectSingleLine = (rowIndex: number) => {
        const lineSelectionData = this.filterResult?.get(LINE_SELECTION_COLUMN_INDEX)?.data as Array<boolean>;
        if (lineSelectionData?.length > 0 && isFinite(rowIndex) && rowIndex >= 0 && rowIndex < lineSelectionData?.length) {
            // update both filterResult & queryResult
            const isSelected = lineSelectionData[rowIndex];
            const realRowIndex = this.filteredRowIndexes[rowIndex];
            lineSelectionData[rowIndex] = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX).data[realRowIndex] = !isSelected;
        }
    };

    @action setSelectedSpectralProfiler = (widgetID: string) => {
        this.selectedSpectralProfilerID = widgetID;
    };

    @action private updateFilterResult = (rowIndexes: Array<number>) => {
        if (rowIndexes?.length === this.numDataRows) {
            this.filterResult = _.cloneDeep(this.queryResult);
        } else {
            let filterResult = new Map<number, ProcessedColumnData>();
            this.queryResult.forEach((column, columnIndex) => {
                let filteredData = [];
                rowIndexes.forEach(dataIndex => {
                    if (dataIndex >= 0 && dataIndex < column.data.length) {
                        filteredData.push(column.data[dataIndex]);
                    }
                });
                filterResult.set(columnIndex, {
                    dataType: column.dataType,
                    data: filteredData
                });
            });
            this.filterResult = filterResult;
        }

        this.filteredRowIndexes = rowIndexes;
        this.shiftedFreqColumnRawData = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX).data as Array<number>;
        this.applyShiftFactor();
    };

    @action private resetQueryContents = () => {
        this.queryResult = new Map<number, ProcessedColumnData>();
        this.filterResult = new Map<number, ProcessedColumnData>();
        this.columnHeaders = [];
        this.filteredRowIndexes = [];
        this.shiftedFreqColumnRawData = [];
        this.numDataRows = 0;
        this.controlHeader = new Map<string, ControlHeader>();
        this.isDataFiltered = false;
        this.filterNum = 0;
    };

    @action query = async () => {
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

        const alertStore = AppStore.Instance.alertStore;

        if (!isFinite(freqMHzFrom) || !isFinite(freqMHzTo) || freqMHzFrom < 0 || freqMHzTo < 0) {
            alertStore.showAlert("Invalid frequency range.");
            return;
        } else if (freqMHzFrom === freqMHzTo) {
            alertStore.showAlert("Please specify a frequency range.");
            return;
        } else if (Math.abs(freqMHzTo - freqMHzFrom) > FREQUENCY_RANGE_LIMIT) {
            alertStore.showAlert(
                `Frequency range ${freqMHzFrom <= freqMHzTo ? freqMHzFrom : freqMHzTo} MHz to ${freqMHzFrom <= freqMHzTo ? freqMHzTo : freqMHzFrom} MHz is too wide.` +
                    `Please specify a frequency range within ${FREQUENCY_RANGE_LIMIT / 1e3} GHz.`
            );
            return;
        }

        this.isQuerying = true;
        const backendService = BackendService.Instance;
        try {
            const ack = await backendService.requestSpectralLine(new CARTA.DoubleBounds({min: freqMHzFrom, max: freqMHzTo}), this.intensityLimitEnabled ? this.intensityLimitValue : NaN);
            if (ack.dataSize >= 0) {
                runInAction(() => {
                    this.numDataRows = ack.dataSize;
                    this.columnHeaders = this.preprocessHeaders(ack.headers);
                    this.controlHeader = this.initControlHeader(this.columnHeaders);
                    this.queryResult = this.initColumnData(ack.spectralLineData, ack.dataSize, this.columnHeaders);
                    this.updateFilterResult(this.fullRowIndexes);
                    this.isDataFiltered = false;
                    this.filterNum = 0;
                });
            } else {
                this.resetQueryContents();
            }
        } catch (err) {
            this.resetQueryContents();
            alertStore.showAlert(err);
        }
        this.isQuerying = false;
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
            filter: filterInput,
            columnWidth: current.columnWidth
        };
        this.controlHeader.set(columnName, newHeader);
    };

    @action filter = () => {
        // find intersections of indexes from filter criteria
        let filteredRowIndexes = this.fullRowIndexes;
        let filterNum = 0;
        this.controlHeader.forEach(controlHeader => {
            const filterString = controlHeader.filter;
            if (filterString !== "") {
                const column = this.queryResult.get(controlHeader.columnIndex);
                const dataType = column.dataType;
                const data = column.data;
                if (dataType === CARTA.ColumnType.Double) {
                    filteredRowIndexes = numericFiltering(data as Array<number>, filteredRowIndexes, filterString);
                } else if (dataType === CARTA.ColumnType.Bool) {
                    filteredRowIndexes = booleanFiltering(data as Array<boolean>, filteredRowIndexes, filterString);
                } else if (dataType === CARTA.ColumnType.String) {
                    filteredRowIndexes = stringFiltering(data as Array<string>, filteredRowIndexes, filterString);
                }
                filterNum++;
            }
        });

        // set up filtered columns
        this.updateFilterResult(filteredRowIndexes);
        this.isDataFiltered = true;
        this.filterNum = filterNum;
    };

    @action resetFilter = () => {
        this.controlHeader.forEach(controlHeader => {
            controlHeader.filter = "";
        });
        if (this.isDataFiltered) {
            this.updateFilterResult(this.fullRowIndexes);
        }
        this.isDataFiltered = false;
        this.filterNum = 0;
    };

    @action.bound setResultTableColumnWidth(width: number, columnName: string) {
        this.controlHeader.get(columnName).columnWidth = width;
    }

    @computed get fullRowIndexes(): Array<number> {
        return Array.from(Array(this.numDataRows).keys());
    }

    @computed get numVisibleRows(): number {
        return this.filteredRowIndexes.length;
    }

    @computed get redshiftFactor() {
        return this.redshiftType === RedshiftType.V ? Math.sqrt((1 - (this.redshiftInput * 1e3) / SPEED_OF_LIGHT) / (1 + (this.redshiftInput * 1e3) / SPEED_OF_LIGHT)) : 1 / (this.redshiftInput + 1);
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

    @computed get numSelectedLines(): number {
        const lineSelectionData = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX)?.data as Array<boolean>;
        if (lineSelectionData?.length <= 0) {
            return 0;
        }
        let numSelected = 0;
        lineSelectionData?.forEach(isSelected => (numSelected += isSelected ? 1 : 0));
        return numSelected;
    }

    @computed get filters(): string[] {
        let filters = [];
        this.controlHeader.forEach(value => {
            if (value.filter) {
                filters.push(value);
            }
        });
        return filters;
    }

    @computed get resultTableInfo(): string {
        const info = `Showing ${this.numDataRows} line(s).`;
        const filteredInfo = `Showing ${this.filteredRowIndexes.length} filtered line(s) of total ${this.numDataRows} line(s). Applied ${this.filterNum} filter(s).`;
        const lineSelectionInfo = this.numSelectedLines > 0 ? ` Selected ${this.numSelectedLines} line(s).` : "";
        return (this.isDataFiltered ? filteredInfo : info) + lineSelectionInfo;
    }

    @computed get resultTableColumnWidths(): Array<number> {
        const columnWidths = [];
        this.controlHeader.forEach(value => {
            if (value.display) {
                columnWidths.push(value.columnWidth);
            }
        });
        return columnWidths;
    }

    public getSelectedLines(): SpectralLine[] {
        const selectedLines: SpectralLine[] = [];
        const speciesColumn = this.queryResult.get(SPECIES_COLUMN_INDEX);
        const frequencyColumn = this.queryResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX);
        const QNColumn = this.queryResult.get(RESOLVED_QN_COLUMN_INDEX);
        const lineSelectionData = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX)?.data;
        lineSelectionData?.forEach((isSelected, index) => {
            if (isSelected) {
                selectedLines.push({
                    species: speciesColumn.data[index] as string,
                    value: (frequencyColumn.data[index] as number) * this.redshiftFactor, // update shifted value
                    qn: QNColumn.data[index] as string
                });
            }
        });
        return selectedLines;
    }

    private preprocessHeaders = (ackHeaders: CARTA.ICatalogHeader[]): Array<CARTA.ICatalogHeader> => {
        let columnHeaders = [];

        // 1. collect headers & rename to comprehensive headers
        ackHeaders?.forEach(header => {
            const headerName = SPLA_HEADER_MAP.has(header.name as SpectralLineHeaders) ? SPLA_HEADER_MAP.get(header.name as SpectralLineHeaders) : header.name;
            columnHeaders.push(
                new CARTA.CatalogHeader({
                    name: headerName,
                    dataType: header.dataType,
                    columnIndex: header.columnIndex,
                    description: SPECTRAL_LINE_DESCRIPTION.get(headerName as SpectralLineHeaders)
                })
            );
        });

        // 2. insert line selection column header
        columnHeaders.splice(
            0,
            0,
            new CARTA.CatalogHeader({
                name: SpectralLineHeaders.LineSelection,
                dataType: CARTA.ColumnType.Bool,
                columnIndex: LINE_SELECTION_COLUMN_INDEX,
                description: SPECTRAL_LINE_DESCRIPTION.get(SpectralLineHeaders.LineSelection)
            })
        );

        return columnHeaders.sort((a, b) => {
            return a.columnIndex - b.columnIndex;
        });
    };

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

        // 3. update numeric column data type
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
                filter: "",
                columnWidth: SPECTRAL_LINE_HEADER_WIDTH.get(header.name) ?? DEFAULT_HEADER_WIDTH
            };
            controlHeaders.set(header.name, controlHeader);
        });
        return controlHeaders;
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

    public pingSplatalogue = async () => {
        try {
            this.splataloguePingStatus = SplataloguePingStatus.Checking;
            const ack = await BackendService.Instance.pingSplatalogue();
            this.splataloguePingStatus = ack?.success ? SplataloguePingStatus.Success : SplataloguePingStatus.Failure;
        } catch (err) {
            this.splataloguePingStatus = SplataloguePingStatus.Failure;
            AppStore.Instance.alertStore.showAlert(`${err}`);
            console.error(err);
        }
    };

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
        this.splataloguePingStatus = SplataloguePingStatus.Checking;
        this.queryRangeType = SpectralLineQueryRangeType.Range;
        this.queryRange = [0, 0];
        this.queryRangeByCenter = [0, 0];
        this.queryUnit = SpectralLineQueryUnit.MHz;
        this.intensityLimitEnabled = true;
        this.intensityLimitValue = -5;
        this.isQuerying = false;
        this.redshiftType = RedshiftType.V;
        this.redshiftInput = 0;
        this.queryResultTableRef = undefined;
        this.selectedSpectralProfilerID = AppStore.Instance.widgetsStore.spectralProfilerList.length > 0 ? AppStore.Instance.widgetsStore.spectralProfilerList[0] : undefined;
        this.resetQueryContents();
        this.pingSplatalogue();

        // update selected spectral profiler when currently selected is closed
        autorun(() => {
            if (!AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(this.selectedSpectralProfilerID)) {
                this.selectedSpectralProfilerID = AppStore.Instance.widgetsStore.spectralProfilerList.length > 0 ? AppStore.Instance.widgetsStore.spectralProfilerList[0] : undefined;
            }
        });
    }
}

import type {NumberRange} from "@blueprintjs/core";
import {type Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {action, autorun, computed, flow, type IReactionDisposer, makeObservable, observable, reaction, runInAction} from "mobx";

import {RedshiftType, SpectralLineHeaders, SpectralLineQueryRangeType, SpectralLineQueryUnit, VelocityConvention} from "enums";
import {type Persisted, type WorkspaceConfigurableWidget, type WorkspaceLayoutConfigurable, type WorkspaceSpectralLineQueryResult, type WorkspaceSpectralLineQueryWidgetConfig} from "models";
import {SplatalogueService} from "services";
import {AppStore, type ControlHeader} from "stores";
import {
    booleanFiltering,
    getHasFilter,
    getInitIndexMap,
    getSortedIndexMap,
    isValidRedshift,
    isValidVelocity,
    numericFiltering,
    observedFrequencyFactorFromRedshift,
    observedFrequencyFactorFromVelocity,
    type ProcessedColumnData,
    ProtobufProcessing,
    stringFiltering,
    wavelengthToFrequency
} from "utilities";

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

export interface SpectralLine {
    species: string;
    value: number;
    qn: string;
}

const LINE_SELECTION_COLUMN_INDEX = 0;
const SPECIES_COLUMN_INDEX = 1;
const SHIFTIED_FREQUENCY_COLUMN_INDEX = 3;
const MEASURED_FREQUENCY_COLUMN_INDEX = 6;
const RESOLVED_QN_COLUMN_INDEX = 8;
const FREQUENCY_RANGE_LIMIT = 2 * 1e4; // 20000 MHz
const DEFAULT_HEADER_WIDTH = 150;
/** The widths of the columns of the table that lists the columns of the result: name, display and description. */
const DEFAULT_HEADER_TABLE_COLUMN_WIDTHS = [150, 70, 300];
const LINE_QUERY_VELOCITY_CONVENTION = VelocityConvention.RADIO;

/** The settings that a spectral line query widget saves in the layout copy of a workspace. A regular layout saves no settings for it. */
export interface SpectralLineQueryWidgetConfig {
    /** The own ID of the widget. It stays the same in every session that restores the workspace. */
    widgetId: string;
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && isFinite(value);
}

function isRange(value: unknown): value is [number, number] {
    return Array.isArray(value) && value.length === 2 && value.every(isFiniteNumber);
}

function isWidthList(value: unknown, length: number): value is number[] {
    return Array.isArray(value) && value.length === length && value.every(width => isFiniteNumber(width) && width > 0);
}

/** The query that made the result that the widget shows. */
interface ShownQuery {
    /** The frequency range, in MHz. */
    frequencyRange: [number, number];
    /** The lowest intensity. NaN when the query had no intensity limit. */
    intensityLimit: number;
}

export class SpectralLineQueryWidgetStore implements WorkspaceLayoutConfigurable<SpectralLineQueryWidgetConfig>, WorkspaceConfigurableWidget<WorkspaceSpectralLineQueryWidgetConfig> {
    widgetId: string = "";
    @observable queryRangeType: SpectralLineQueryRangeType = SpectralLineQueryRangeType.Range;
    @observable queryRange: NumberRange = [0, 0];
    @observable queryRangeByCenter: NumberRange = [0, 0];
    @observable queryUnit: SpectralLineQueryUnit = SpectralLineQueryUnit.MHz;
    @observable isIntensityLimitEnabled: boolean = true;
    @observable intensityLimitValue: number = -5;
    @observable isQuerying: boolean = false;
    @observable columnHeaders: Array<CARTA.CatalogHeader.$Properties> = [];
    @observable redshiftType: RedshiftType = RedshiftType.V;
    @observable redshiftInput: number = 0;
    @observable queryResultTableRef: Table | undefined = undefined;
    @observable private queryResult: Map<number, ProcessedColumnData> = new Map<number, ProcessedColumnData>();
    @observable filterResult: Map<number, ProcessedColumnData> = new Map<number, ProcessedColumnData>();
    @observable filteredRowIndexes: Array<number> = [];
    @observable private isDataFiltered: boolean = false;
    @observable private filterNum: number = 0;
    @observable numDataRows: number = 0;
    @observable selectedSpectralProfilerID: string | undefined = AppStore.Instance.widgetsStore.spectralProfilerList.length > 0 ? AppStore.Instance.widgetsStore.spectralProfilerList[0] : undefined;
    @observable controlHeader: Map<string, ControlHeader> = new Map<string, ControlHeader>();
    @observable sortingInfo: {columnName: string | null; sortingType: CARTA.SortingType | null} = {columnName: null, sortingType: null};
    @observable sortedIndexMap: Array<number> = [];
    @observable headerTableColumnWidths: number[] = [...DEFAULT_HEADER_TABLE_COLUMN_WIDTHS];
    /** The query that made the result that the widget shows. Nothing when the widget shows no result. */
    private shownQuery: ShownQuery | undefined;
    private readonly disposers: IReactionDisposer[] = [];

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
        this.isIntensityLimitEnabled = !this.isIntensityLimitEnabled;
    };

    @action setIntensityLimitValue = (intensityLimitValue: number) => {
        this.intensityLimitValue = intensityLimitValue;
    };

    @action setHeaderDisplay = (isDisplayed: boolean, columnName: string) => {
        const header = this.controlHeader.get(columnName);
        if (header) {
            header.display = isDisplayed;
        }
    };

    @action setRedshiftType = (redshiftType: RedshiftType) => {
        this.redshiftType = redshiftType;
        if (!this.isValidRedshiftInput(this.redshiftInput)) {
            this.redshiftInput = 0;
        }
        this.applyShiftFactor();
    };

    @action setRedshiftInput = (input: number) => {
        if (this.isValidRedshiftInput(input)) {
            this.redshiftInput = input;
            this.applyShiftFactor();
        }
    };

    public isValidRedshiftInput = (input: number): boolean => {
        if (this.isRedshiftInputDisabled) {
            return false;
        }
        return this.isValidRedshiftValue(input);
    };

    /** Returns whether the value is a valid velocity or redshift for the redshift type, whether or not the input is on. */
    private isValidRedshiftValue = (input: number): boolean => {
        return this.redshiftType === RedshiftType.V ? isValidVelocity(input, LINE_QUERY_VELOCITY_CONVENTION) : isValidRedshift(input);
    };

    @action private applyShiftFactor = () => {
        const shiftedData = this.shiftedFreqColumnRawData.map(value => {
            return isFinite(value) ? value * this.observedFrequencyFactor : undefined;
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
        const lineSelectionData = this.filterResult?.get(LINE_SELECTION_COLUMN_INDEX)?.data;
        if (lineSelectionData === null || lineSelectionData === undefined) {
            return;
        }

        if (lineSelectionData.length > 0 && isFinite(rowIndex) && rowIndex >= 0 && rowIndex < lineSelectionData.length) {
            // update both filterResult & queryResult
            const isSelected = lineSelectionData[rowIndex];
            const realRowIndex = this.filteredRowIndexes[rowIndex];

            const queryResultData = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX)?.data;
            if (queryResultData) {
                lineSelectionData[rowIndex] = queryResultData[realRowIndex] = !isSelected;
            }
        }
    };

    @action setSelectedSpectralProfiler = (widgetID: string) => {
        this.selectedSpectralProfilerID = widgetID;
    };

    @action private updateFilterResult = (rowIndexes: Array<number>) => {
        const filterResult = new Map<number, ProcessedColumnData>();
        if (rowIndexes?.length === this.numDataRows) {
            this.queryResult.forEach((column, columnIndex) => {
                filterResult.set(columnIndex, column);
            });
            this.filterResult = filterResult;
        } else {
            this.queryResult.forEach((column, columnIndex) => {
                const columnData = column.data;
                const filteredData: any[] = [];
                if (columnData) {
                    rowIndexes.forEach(dataIndex => {
                        if (dataIndex >= 0 && dataIndex < columnData.length) {
                            filteredData.push(columnData[dataIndex]);
                        }
                    });
                }
                filterResult.set(columnIndex, {
                    dataType: column.dataType,
                    data: filteredData
                });
            });
            this.filterResult = filterResult;
        }

        this.filteredRowIndexes = rowIndexes;
        this.shiftedFreqColumnRawData = this.filterResult.get(SHIFTIED_FREQUENCY_COLUMN_INDEX)?.data as Array<number>;
        this.applyShiftFactor();
        this.initSortedIndexMap();
        this.updateSortedIndexMap();
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
        this.shownQuery = undefined;
    };

    query = flow(function* (this: SpectralLineQueryWidgetStore) {
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

        if (freqMHzFrom === undefined || freqMHzTo === undefined || !isFinite(freqMHzFrom) || !isFinite(freqMHzTo) || freqMHzFrom < 0 || freqMHzTo < 0) {
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

        const error: string | undefined = yield this.fetchLines(freqMHzFrom, freqMHzTo, this.isIntensityLimitEnabled ? this.intensityLimitValue : NaN);
        if (error) {
            alertStore.showAlert(error);
        }
    }).bind(this);

    /**
     * Queries the lines in a frequency range and shows them.
     *
     * @param freqMHzFrom - the start of the range, in MHz.
     * @param freqMHzTo - the end of the range, in MHz.
     * @param intensityLimit - the lowest intensity. NaN queries the lines of every intensity.
     * @returns the error, or nothing when the query worked.
     */
    private fetchLines = flow(function* (this: SpectralLineQueryWidgetStore, freqMHzFrom: number, freqMHzTo: number, intensityLimit: number) {
        this.isQuerying = true;
        let error: string | undefined;
        try {
            const ack = yield SplatalogueService.Instance.query(freqMHzFrom, freqMHzTo, intensityLimit);
            if (ack?.dataSize >= 0) {
                this.numDataRows = ack.dataSize;
                this.columnHeaders = this.preprocessHeaders(ack.headers);
                this.controlHeader = this.initControlHeader(this.columnHeaders);
                this.queryResult = this.initColumnData(ack.spectralLineData, ack.dataSize, this.columnHeaders);
                this.updateFilterResult(this.fullRowIndexes);
                this.isDataFiltered = false;
                this.filterNum = 0;
                this.shownQuery = {frequencyRange: [freqMHzFrom, freqMHzTo], intensityLimit};
            } else {
                this.resetQueryContents();
            }
        } catch (err) {
            this.resetQueryContents();
            error = err?.toString() ?? "Spectral line query failed.";
        }
        this.isQuerying = false;
        return error;
    }).bind(this);

    @action setColumnFilter = (filterInput: string, columnName: string) => {
        if (!this.controlHeader.has(columnName)) {
            return;
        }
        const current = this.controlHeader.get(columnName);
        const newHeader: ControlHeader = {
            columnIndex: current?.columnIndex,
            dataIndex: current?.dataIndex,
            display: current?.display,
            filter: filterInput,
            columnWidth: current?.columnWidth
        };
        this.controlHeader.set(columnName, newHeader);
    };

    @action filter = () => {
        // find intersections of indexes from filter criteria
        let filteredRowIndexes = this.fullRowIndexes;
        let filterNum = 0;
        this.controlHeader.forEach(controlHeader => {
            const filterString = controlHeader.filter;
            if (filterString !== "" && controlHeader.columnIndex !== undefined) {
                const column = this.queryResult.get(controlHeader.columnIndex);
                if (!column) {
                    return;
                }

                const dataType = column.dataType;
                const data =
                    controlHeader.columnIndex !== SHIFTIED_FREQUENCY_COLUMN_INDEX
                        ? column.data
                        : (column.data as (number | undefined)[] | null | undefined)?.map(value => (value !== undefined && isFinite(value) ? value * this.observedFrequencyFactor : undefined));
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
        const controlHeader = this.controlHeader.get(columnName);
        if (controlHeader) {
            controlHeader.columnWidth = width;
        }
    }

    @action setHeaderTableColumnWidth = (index: number, width: number) => {
        if (index >= 0 && index < this.headerTableColumnWidths.length) {
            this.headerTableColumnWidths[index] = width;
        }
    };

    @action setSortingInfo(columnName: string, sortingType: CARTA.SortingType | null) {
        this.sortingInfo = {columnName, sortingType};
        this.updateSortedIndexMap();
    }

    @action updateSortedIndexMap() {
        this.sortedIndexMap = getSortedIndexMap(this.controlHeader, this.sortingInfo, this.sortedIndexMap, this.hasFilter, this.numVisibleRows, this.filterResult);
    }

    @action initSortedIndexMap() {
        this.sortedIndexMap = getInitIndexMap(this.numVisibleRows);
    }

    @computed get hasFilter(): boolean {
        return getHasFilter(this.controlHeader, this.queryResult);
    }

    @computed get fullRowIndexes(): Array<number> {
        return Array.from(Array(this.numDataRows).keys());
    }

    @computed get numVisibleRows(): number {
        return this.filteredRowIndexes.length;
    }

    @computed get isXAxisRestFrameActive(): boolean {
        return Boolean(this.selectedSpectralProfilerID && AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(this.selectedSpectralProfilerID)?.isXAxisRestFrameActive);
    }

    @computed get isRedshiftInputDisabled(): boolean {
        return this.isXAxisRestFrameActive;
    }

    @computed get observedFrequencyFactor() {
        if (this.isRedshiftInputDisabled) {
            return 1;
        }
        return this.redshiftType === RedshiftType.V ? observedFrequencyFactorFromVelocity(this.redshiftInput, LINE_QUERY_VELOCITY_CONVENTION) : observedFrequencyFactorFromRedshift(this.redshiftInput);
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader.$Properties> {
        const displayedColumnHeaders: CARTA.CatalogHeader.$Properties[] = [];
        this.controlHeader?.forEach(controlHeader => {
            if (controlHeader.display && controlHeader.dataIndex !== undefined && controlHeader.dataIndex < this.columnHeaders?.length) {
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
        const filters: string[] = [];
        this.controlHeader.forEach(value => {
            if (value.filter) {
                filters.push(value.filter);
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

    @computed get resultTableColumnWidths(): (number | null | undefined)[] {
        const columnWidths: (number | null | undefined)[] = [];
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
        const qnColumn = this.queryResult.get(RESOLVED_QN_COLUMN_INDEX);
        const lineSelectionData = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX)?.data;
        lineSelectionData?.forEach((isSelected, index) => {
            if (isSelected) {
                selectedLines.push({
                    species: speciesColumn?.data?.[index] as string,
                    value: (frequencyColumn?.data?.[index] as number) * this.observedFrequencyFactor, // update shifted value
                    qn: qnColumn?.data?.[index] as string
                });
            }
        });
        return selectedLines;
    }

    private preprocessHeaders = (ackHeaders: CARTA.CatalogHeader.$Properties[]): Array<CARTA.CatalogHeader> => {
        const columnHeaders: CARTA.CatalogHeader[] = [];

        // 1. collect headers & add description
        ackHeaders?.forEach(header => {
            columnHeaders.push(
                new CARTA.CatalogHeader({
                    name: header.name,
                    dataType: header.dataType,
                    columnIndex: (header.columnIndex ?? NaN) + 1, // to save first column for inserting line selection
                    description: SPECTRAL_LINE_DESCRIPTION.get(header.name as SpectralLineHeaders)
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
        const ackColumns = ProtobufProcessing.processCatalogData(ackData);

        // Starting from i = 1 is to preserve the first column for line selection boolean
        // Since ```ackColumns``` has no line selection boolean column (but ```headers``` does), ackColumns.get(i - 1) extracts correct column data.
        const columns = new Map<number, ProcessedColumnData>();
        for (let i = 1; i < headers.length; i++) {
            const selectColumn = ackColumns.get(i - 1);
            columns.set(i, {
                dataType: selectColumn?.dataType,
                data: selectColumn?.data
            });
        }

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
            if (!isFinite(value) && measuredFreqData && index < measuredFreqData.length) {
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
                if (column) {
                    column.dataType = CARTA.ColumnType.Double;
                    column.data = column.data as Array<number>;
                }
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

    private calculateFreqMHz = (value: number, unit: SpectralLineQueryUnit): number | undefined => {
        if (!isFinite(value) || value === null || value < 0 || !unit) {
            return undefined;
        }
        if (unit === SpectralLineQueryUnit.CM) {
            return (wavelengthToFrequency(value / 100) ?? NaN) / 1e6;
        } else if (unit === SpectralLineQueryUnit.MM) {
            return (wavelengthToFrequency(value / 1000) ?? NaN) / 1e6;
        } else if (unit === SpectralLineQueryUnit.GHz) {
            return value * 1000;
        } else if (unit === SpectralLineQueryUnit.MHz) {
            return value;
        } else {
            return undefined;
        }
    };

    public applyWorkspaceLayoutConfig = (widgetSettings: Persisted<SpectralLineQueryWidgetConfig>): void => {
        if (typeof widgetSettings?.widgetId === "string" && widgetSettings.widgetId) {
            this.widgetId = widgetSettings.widgetId;
        }
    };

    public toWorkspaceLayoutConfig = (): SpectralLineQueryWidgetConfig => ({widgetId: this.widgetId});

    /** Returns the result table that a workspace saves, or nothing when the widget shows no result. */
    private get workspaceResult(): WorkspaceSpectralLineQueryResult | undefined {
        if (!this.shownQuery) {
            return undefined;
        }
        const columns: WorkspaceSpectralLineQueryResult["columns"] = {};
        this.controlHeader.forEach((header, name) => {
            columns[name] = {display: header.display !== false, filter: header.filter ?? "", width: header.columnWidth ?? DEFAULT_HEADER_WIDTH};
        });
        const selection = (this.queryResult.get(LINE_SELECTION_COLUMN_INDEX)?.data ?? []) as boolean[];
        const {columnName, sortingType} = this.sortingInfo;
        return {
            frequencyRange: [...this.shownQuery.frequencyRange],
            ...(isFinite(this.shownQuery.intensityLimit) ? {intensityLimit: this.shownQuery.intensityLimit} : {}),
            rowCount: this.numDataRows,
            columns,
            filtered: this.isDataFiltered,
            ...(columnName && sortingType !== null ? {sort: {columnName, sortingType}} : {}),
            selectedRows: selection.flatMap((isSelected, row) => (isSelected ? [row] : []))
        };
    }

    /** Returns the query settings and the result table that a workspace saves. The spectral profiler is named by its widget ID, which stays the same after a restore. */
    public toWorkspaceConfig = (): WorkspaceSpectralLineQueryWidgetConfig => {
        const profiler = this.selectedSpectralProfilerID ? AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(this.selectedSpectralProfilerID) : undefined;
        const result = this.workspaceResult;
        return {
            rangeType: this.queryRangeType,
            range: [this.queryRange[0], this.queryRange[1]],
            rangeByCenter: [this.queryRangeByCenter[0], this.queryRangeByCenter[1]],
            unit: this.queryUnit,
            intensityLimitEnabled: this.isIntensityLimitEnabled,
            intensityLimit: this.intensityLimitValue,
            redshiftType: this.redshiftType,
            redshift: this.redshiftInput,
            ...(profiler?.widgetId ? {spectralProfilerId: profiler.widgetId} : {}),
            headerTableColumnWidths: [...this.headerTableColumnWidths],
            ...(result ? {result} : {})
        };
    };

    public applyWorkspaceBinding = (): string[] => [];

    /** Applies the saved query settings. A value that is not valid keeps its default. {@link restoreWorkspaceResult} queries again. */
    @action public applyWorkspaceConfig = (config: WorkspaceSpectralLineQueryWidgetConfig): string[] => {
        if (Object.values(SpectralLineQueryRangeType).includes(config.rangeType)) {
            this.setQueryRangeType(config.rangeType);
        }
        if (Object.values(SpectralLineQueryUnit).includes(config.unit)) {
            this.queryUnit = config.unit;
        }
        if (isRange(config.range)) {
            this.setQueryRange([config.range[0], config.range[1]]);
        }
        if (isRange(config.rangeByCenter)) {
            this.setQueryRangeByCenter([config.rangeByCenter[0], config.rangeByCenter[1]]);
        }
        this.isIntensityLimitEnabled = config.intensityLimitEnabled !== false;
        if (isFiniteNumber(config.intensityLimit)) {
            this.setIntensityLimitValue(config.intensityLimit);
        }
        if (isWidthList(config.headerTableColumnWidths, DEFAULT_HEADER_TABLE_COLUMN_WIDTHS.length)) {
            this.headerTableColumnWidths = [...config.headerTableColumnWidths];
        }
        const problems: string[] = [];
        if (typeof config.spectralProfilerId === "string") {
            const widgetsStore = AppStore.Instance.widgetsStore;
            const profilerId = widgetsStore.spectralProfilerList.find(id => widgetsStore.getSpectralWidgetStoreByID(id)?.widgetId === config.spectralProfilerId);
            if (profilerId) {
                this.setSelectedSpectralProfiler(profilerId);
            } else {
                problems.push("the spectral profiler that it plotted lines on was not restored");
            }
        }
        // Apply the redshift after the spectral profiler is chosen. The redshift input is off while the
        // chosen profiler shows its X axis in the rest frame. The input keeps its value then. So put
        // the saved value back without the check of the input.
        if (Object.values(RedshiftType).includes(config.redshiftType)) {
            this.setRedshiftType(config.redshiftType);
        }
        if (isFiniteNumber(config.redshift)) {
            if (!this.isRedshiftInputDisabled) {
                this.setRedshiftInput(config.redshift);
            } else if (this.isValidRedshiftValue(config.redshift)) {
                this.redshiftInput = config.redshift;
            }
        }
        return problems;
    };

    public applyWorkspaceView = (): void => {};

    /**
     * Runs the saved query again, and applies the saved column settings, filters, sorting and
     * selected lines to the new result. The result comes from Splatalogue, so it can differ from
     * the saved one. The selected lines are applied only when the query returns as many lines as
     * before.
     *
     * @returns the problems, as sentences about the widget.
     */
    public restoreWorkspaceResult = async (config: WorkspaceSpectralLineQueryWidgetConfig, isWanted: () => boolean = () => true): Promise<string[]> => {
        const result = config.result;
        if (!result || !isRange(result.frequencyRange)) {
            return [];
        }
        const error = await this.fetchLines(result.frequencyRange[0], result.frequencyRange[1], isFiniteNumber(result.intensityLimit) ? result.intensityLimit : NaN);
        // The query answered after the restore stopped waiting. It shows the lines without the saved settings.
        if (!isWanted()) {
            return [];
        }
        if (error) {
            return [`could not query the spectral lines again: ${error}`];
        }
        if (!this.shownQuery) {
            return ["the spectral line query returned no result"];
        }
        return runInAction(() => this.applyWorkspaceResult(result));
    };

    private applyWorkspaceResult(result: WorkspaceSpectralLineQueryResult): string[] {
        const problems: string[] = [];
        Object.entries(result.columns ?? {}).forEach(([name, column]) => {
            if (!this.controlHeader.has(name)) {
                return;
            }
            if (typeof column?.display === "boolean") {
                this.setHeaderDisplay(column.display, name);
            }
            if (typeof column?.filter === "string") {
                this.setColumnFilter(column.filter, name);
            }
            if (isFiniteNumber(column?.width) && column.width > 0) {
                this.setResultTableColumnWidth(column.width, name);
            }
        });
        const selection = this.queryResult.get(LINE_SELECTION_COLUMN_INDEX)?.data as boolean[] | undefined;
        if (Array.isArray(result.selectedRows) && result.selectedRows.length > 0) {
            if (result.rowCount === this.numDataRows && selection) {
                result.selectedRows.forEach(row => {
                    if (Number.isInteger(row) && row >= 0 && row < selection.length) {
                        selection[row] = true;
                    }
                });
            } else {
                problems.push(`the spectral line query now returns ${this.numDataRows} lines instead of ${result.rowCount}, so the selected lines were not restored`);
            }
        }
        if (result.filtered === true) {
            this.filter();
        } else {
            this.updateFilterResult(this.fullRowIndexes);
        }
        if (result.sort && this.controlHeader.has(result.sort.columnName) && Object.values(CARTA.SortingType).includes(result.sort.sortingType)) {
            this.setSortingInfo(result.sort.columnName, result.sort.sortingType);
        }
        return problems;
    }

    constructor() {
        makeObservable(this);
        this.resetQueryContents();
        this.initSortedIndexMap();

        // update selected spectral profiler when currently selected is closed
        this.disposers.push(
            autorun(() => {
                if (!this.selectedSpectralProfilerID || !AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(this.selectedSpectralProfilerID)) {
                    this.selectedSpectralProfilerID = AppStore.Instance.widgetsStore.spectralProfilerList.length > 0 ? AppStore.Instance.widgetsStore.spectralProfilerList[0] : undefined;
                }
            })
        );
        this.disposers.push(
            reaction(
                () => this.isRedshiftInputDisabled,
                () => this.applyShiftFactor(),
                {fireImmediately: true}
            )
        );
    }

    public dispose = () => {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    };
}

import {action, autorun, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {BackendService} from "services";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {ProcessedColumnData, ProtobufProcessing} from "models";
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
    RestFrequency = "Freq-MHz(rest frame,redshifted)",
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
const REST_FREQUENCY_COLUMN_INDEX = 3;
const RESOLVED_QN_COLUMN_INDEX = 7;

export class SpectralLineOverlayWidgetStore extends RegionWidgetStore {
    private static readonly initDisplayedColumnSize = 6;

    @observable queryRangeType: SpectralLineQueryRangeType;
    @observable queryRange: NumberRange;
    @observable queryRangeByCenter: NumberRange;
    @observable queryUnit: SpectralLineQueryUnit;
    @observable isQuerying: boolean;
    @observable columnHeaders: Array<CARTA.ICatalogHeader>;
    @observable headerDisplay: Map<SpectralLineHeaders, boolean>;
    @observable redshiftType: RedshiftType;
    @observable redshiftInput: number;
    @observable queryResultTableRef: Table;
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
                if (ack.success && ack.dataSize > 0) {
                    this.numDataRows = ack.dataSize;
                    this.isLineSelectedArray = new Array<boolean>(this.numDataRows).fill(false);
                    this.queryResult = ProtobufProcessing.ProcessCatalogData(ack.spectralLineData);
                    this.originalFreqColumn = this.queryResult.get(REST_FREQUENCY_COLUMN_INDEX);
                    this.columnHeaders = ack.headers.sort((a, b) => {
                        return (a.columnIndex - b.columnIndex);
                    });
                }
            }, error => {
                this.isQuerying = false;
                console.error(error);
                AppStore.Instance.alertStore.showAlert(error);
            });
        }
    };

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

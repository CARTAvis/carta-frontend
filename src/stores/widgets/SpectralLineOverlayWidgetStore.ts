import {action, autorun, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
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
    RestFrequency = "Rest Frequency",
    RedshiftedFrequency = "Redshifted Frequency",
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

        if (isFinite(freqMHzFrom) && isFinite(freqMHzTo)) {
            this.isQuerying = true;
            const corsProxy = "https://cors-anywhere.herokuapp.com/";
            const queryLink = "http://www.cv.nrao.edu/php/splat/c_export.php?sid%5B%5D=&data_version=v3.0&lill=on&displayJPL=displayJPL&displayCDMS=displayCDMS&displayLovas=displayLovas&displaySLAIM=displaySLAIM&displayToyaMA=displayToyaMA&displayOSU=displayOSU&displayRecomb=displayRecomb&displayLisa=displayLisa&displayRFI=displayRFI&ls1=ls1&ls2=ls2&ls3=ls3&ls4=ls4&ls5=ls5&el1=el1&el2=el2&el3=el3&el4=el4&submit=Export&export_type=current&export_delimiter=tab&offset=0&limit=100000&range=on";
            const freqRange = `&frequency_units=MHz&from=${freqMHzFrom}&to=${freqMHzTo}`;

            fetch(`${corsProxy}${queryLink}${freqRange}`, {
            }).then(response => {
                return response.text();
            }).then(data => {
                this.parsingQueryResponse(data);
                this.isQuerying = false;
            }).catch((err) => {
                this.isQuerying = false;
                console.log(err);
            });
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
            this.columnHeaders.push(new CARTA.CatalogHeader({
                name: headers[columnIndex],
                dataType: headers[columnIndex] === (SpectralLineHeaders.RestFrequency || SpectralLineHeaders.RedshiftedFrequency) ? CARTA.ColumnType.Double : CARTA.ColumnType.String,
                columnIndex: columnIndex
            }));
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
            const numHeaders = this.columnHeaders.length;
            if (numHeaders > 0) {
                for (let columnIndex = 0; columnIndex < numHeaders; columnIndex++) {
                    const columnData = [];
                    for (let row = 0; row < numDataRows; row++) {
                        const valString = spectralLineInfo[row + 1][columnIndex];
                        columnData.push(columnIndex === FREQUENCY_COLUMN_INDEX ? Number(valString) : valString);
                    }
                    if (columnIndex === FREQUENCY_COLUMN_INDEX) {
                        this.queryResult.set(FREQUENCY_COLUMN_INDEX, {dataType: CARTA.ColumnType.Double, data: columnData.map(val => val * this.redshiftFactor)});
                        this.queryResult.set(FREQUENCY_COLUMN_INDEX + 1, {dataType: CARTA.ColumnType.Double, data: columnData});
                        this.originalFreqColumn = this.queryResult.get(FREQUENCY_COLUMN_INDEX + 1);
                    } else {
                        this.queryResult.set(columnIndex < FREQUENCY_COLUMN_INDEX ? columnIndex : columnIndex + 1, {dataType: CARTA.ColumnType.String, data: columnData});
                    }
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

import {action, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {ProcessedColumnData} from "models";
import {ControlHeader} from "stores/widgets";
import {wavelengthToFrequency} from "utilities";

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
    FreqMHz = "Freq-MHz(rest frame,redshifted)",
    FreqErr = "Freq Err(rest frame,redshifted)",
    MeasFreqMHz = "Meas Freq-MHz(rest frame,redshifted)",
    MeasFreqErr = "Meas Freq Err(rest frame,redshifted)",
    QuantumNumber = "Resolved QNs",
    IntensityCDMS = "CDMS/JPL Intensity",
    IntensityLovas = "Lovas/AST Intensity",
    E_L = "E_L (cm^-1)",
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

export class SpectralLineOverlayWidgetStore extends RegionWidgetStore {
    private static readonly initDisplayedColumnSize = 6;

    @observable queryRangeType: SpectralLineQueryRangeType;
    @observable queryRange: NumberRange;
    @observable queryRangeByCenter: NumberRange;
    @observable queryUnit: SpectralLineQueryUnit;
    @observable isQuerying: boolean;
    @observable queryHeaders: string[];
    @observable headerDisplay: Map<SpectralLineHeaders, boolean>;
    @observable redshiftType: RedshiftType;
    @observable redshiftSpeed: number;
    @observable queryResultTableRef: Table;
    @observable controlHeader: Map<string, ControlHeader>;
    @observable queryResult: Map<number, ProcessedColumnData>;
    @observable numVisibleRows: number;

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

    @action setRedshiftSpeed = (speed: number) => {
        if (isFinite(speed)) {
            this.redshiftSpeed = speed;
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
            const queryLink = "https://www.cv.nrao.edu/php/splat/c_export.php?submit=Search&chemical_name=&sid%5B%5D=1154&calcIn=&data_version=v3.0&redshift=&freqfile=&energy_range_from=&energy_range_to=&lill=on&displayJPL=displayJPL&displayCDMS=displayCDMS&displayLovas=displayLovas&displaySLAIM=displaySLAIM&displayToyaMA=displayToyaMA&displayOSU=displayOSU&displayRecomb=displayRecomb&displayLisa=displayLisa&displayRFI=displayRFI&ls1=ls1&ls5=ls5&el1=el1&export_type=current&export_delimiter=tab&offset=0&limit=501&range=on&submit=Export";
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
        this.controlHeader.get(columnName).filter = filter;
    }

    @action clearData() {
        this.queryResult.clear();
    }

    @computed get formalizedHeaders(): SpectralLineHeader[] {
        let formalizedHeaders: SpectralLineHeader[] = [];
        this.queryHeaders.forEach(headerString => {
            if ((<any> Object).values(SpectralLineHeaders).includes(headerString)) {
                formalizedHeaders.push({name: headerString as SpectralLineHeaders, desc: SPECTRAL_LINE_DESCRIPTION.get(headerString as SpectralLineHeaders)});
            }
        });
        return formalizedHeaders;
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        let displayedColumnHeaders = [];
        let columnIndex = 0;
        if (this.queryHeaders.length > 0) {
            this.headerDisplay.forEach((value, spectralLineHeader) => {
                if (value) {
                    displayedColumnHeaders.push(new CARTA.CatalogHeader({name: spectralLineHeader, dataType: CARTA.ColumnType.String, columnIndex: columnIndex}));
                }
                columnIndex++;
            });
        }
        return displayedColumnHeaders;
    }

    @computed get initControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        if (this.queryHeaders.length) {
            for (let columnIndex = 0; columnIndex < this.queryHeaders.length; columnIndex++) {
                const header = this.queryHeaders[columnIndex];
                let controlHeader: ControlHeader = {
                    columnIndex: columnIndex,
                    dataIndex: columnIndex,
                    display: columnIndex < SpectralLineOverlayWidgetStore.initDisplayedColumnSize ? true : false,
                    representAs: undefined,
                    filter: undefined,
                    columnWidth: null
                };
                controlHeaders.set(header, controlHeader);
            }
        }
        return controlHeaders;
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

    private parsingQueryResponse = (response: string) => {
        if (!response) {
            return;
        }
        const lines = response.split(/\r?\n/);
        if (lines && lines.length > 1) {
            this.queryHeaders = [];
            const spectralLineInfo = [];
            lines.forEach(line => {
                spectralLineInfo.push(line.split(/\t/));
            });

            // find headers
            this.queryHeaders = spectralLineInfo[0];

            // find column data
            const numHeaders = this.queryHeaders.length;
            if (numHeaders > 0) {
                for (let columnIndex = 0; columnIndex < numHeaders; columnIndex++) {
                    const columnData = [];
                    for (let dataLength = 1; dataLength < lines.length; dataLength++) {
                        columnData.push(spectralLineInfo[dataLength][columnIndex]);
                    }
                    this.queryResult.set(columnIndex, {dataType: CARTA.ColumnType.String, data: columnData});
                }
            }
        }
    };

    constructor() {
        super(RegionsType.CLOSED);
        this.queryRangeType = SpectralLineQueryRangeType.Range;
        this.queryRange = [0, 0];
        this.queryRangeByCenter = [0, 0];
        this.queryUnit = SpectralLineQueryUnit.GHz;
        this.isQuerying = false;
        this.queryHeaders = [];
        this.headerDisplay = new Map<SpectralLineHeaders, boolean>();
        Object.values(SpectralLineHeaders).forEach(header => this.headerDisplay.set(header, true));
        this.redshiftType = RedshiftType.V;
        this.redshiftSpeed = 0;
        this.controlHeader = this.initControlHeader;
        this.queryResult = new Map<number, ProcessedColumnData>();
        this.queryResultTableRef = undefined;
        this.numVisibleRows = 1;
    }
}

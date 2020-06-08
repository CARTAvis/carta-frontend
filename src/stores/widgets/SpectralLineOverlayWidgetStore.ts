import {action, computed, observable} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {Table} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {ProcessedColumnData} from "models";
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

export enum SpectralLineOptions {
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
    Linelist = "Linelist"
}

const SPECTRAL_LINE_DESCRIPTION = new Map<SpectralLineOptions, string>([
    [SpectralLineOptions.Species, "Name of the Species"],
    [SpectralLineOptions.QuantumNumber, "Resolved Quantum Number"],
    [SpectralLineOptions.IntensityCDMS, "Intensity(for JPL/CDMS)"],
    [SpectralLineOptions.IntensityLovas, "Intensity(for Lovas/AST)"]
]);

export interface SpectralLineHeader {
    name: SpectralLineOptions;
    desc: string;
}

export enum RedshiftType {
    V = "V",
    Z = "Z"
}

export class SpectralLineOverlayWidgetStore extends RegionWidgetStore {
    @observable queryRangeType: SpectralLineQueryRangeType;
    @observable queryRange: NumberRange;
    @observable queryRangeByCenter: NumberRange;
    @observable queryUnit: SpectralLineQueryUnit;
    @observable isQuerying: boolean;
    @observable queryHeaders: string[];
    @observable optionsDisplay: Map<SpectralLineOptions, boolean>;
    @observable redshiftType: RedshiftType;
    @observable redshiftSpeed: number;
    @observable queryResults: string[][];
    @observable queryResultTableRef: Table;
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

    @action setOptionsDisplay = (option: SpectralLineOptions) => {
        this.optionsDisplay.set(option, !this.optionsDisplay.get(option));
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

    @computed get formalizedHeaders(): SpectralLineHeader[] {
        let formalizedHeaders: SpectralLineHeader[] = [];
        this.queryHeaders.forEach(headerString => {
            if ((<any> Object).values(SpectralLineOptions).includes(headerString)) {
                formalizedHeaders.push({name: headerString as SpectralLineOptions, desc: SPECTRAL_LINE_DESCRIPTION.get(headerString as SpectralLineOptions)});
            }
        });
        return formalizedHeaders;
    }

    @computed get displayedColumnHeaders(): Array<CARTA.CatalogHeader> {
        let displayedColumnHeaders = [];
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

    private parsingQueryResponse = (response: string) => {
        if (!response) {
            return;
        }
        const lines = response.split(/\r?\n/);
        if (lines && lines.length > 0) {
            this.queryHeaders = [];
            this.queryResults = [];
            for (let i = 0; i < lines.length; i++) {
                if (i === 0) {
                    this.queryHeaders = lines[0].split(/\t/);
                } else {
                    this.queryResults.push(lines[i].split(/\t/));
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
        this.optionsDisplay = new Map<SpectralLineOptions, boolean>();
        Object.values(SpectralLineOptions).forEach(option => this.optionsDisplay.set(option, false));
        this.redshiftType = RedshiftType.V;
        this.redshiftSpeed = 0;
        this.queryResultTableRef = undefined;
        this.numVisibleRows = 1;
    }
}

import {type CARTA} from "carta-protobuf";
import {computed, makeObservable, observable} from "mobx";

import {CatalogType} from "enums";
import {AbstractCatalogProfileStore, type CatalogInfo} from "models";
import {type ControlHeader, InMemoryRowSource, PreferenceStore} from "stores";
import {type ProcessedColumnData} from "utilities";

export class CatalogOnlineQueryProfileStore extends AbstractCatalogProfileStore {
    private static readonly SimbadInitialedColumnsKeyWords = ["ra", "dec", "main_id", "coo_bibcode", "dist", "otype_txt"];
    private static readonly VizierInitialedColumnsKeyWords = ["_r", "_RAJ2000", "_DEJ2000"];

    @observable catalogInfo: CatalogInfo;
    @observable catalogHeader: Array<CARTA.CatalogHeader>;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    readonly rows: InMemoryRowSource;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, catalogType: CatalogType) {
        super(catalogType);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => a.columnIndex - b.columnIndex);
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.rows = new InMemoryRowSource(catalogInfo.dataSize, catalogData, this);

        const coordinateSystem = catalogInfo.fileInfo.coosys?.[0];
        const system = AbstractCatalogProfileStore.getCatalogSystem(coordinateSystem?.system);
        const defaults = AbstractCatalogProfileStore.getCatalogCoordinateDefaults(coordinateSystem?.system);
        this.catalogCoordinateSystem = {
            system: system,
            equinox: coordinateSystem?.equinox || defaults.equinox,
            epoch: coordinateSystem?.epoch || defaults.epoch
        };
        makeObservable(this);
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                let isDisplayed = false;
                if (this.catalogType === CatalogType.SIMBAD && CatalogOnlineQueryProfileStore.SimbadInitialedColumnsKeyWords.includes(header.name)) {
                    isDisplayed = true;
                } else if (this.catalogType === CatalogType.VIZIER && (CatalogOnlineQueryProfileStore.VizierInitialedColumnsKeyWords.includes(header.name) || index < PreferenceStore.Instance.catalogDisplayedColumnSize)) {
                    isDisplayed = true;
                }
                const controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: isDisplayed, filter: "", columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    /** Every row is held, so the table only changes how many it shows. */
    setMaxRows(maxRows: number) {
        this.rows.setRowLimit(maxRows);
    }
}

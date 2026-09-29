import {type CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import {CatalogSystemType, CatalogType} from "enums";
import {AbstractCatalogProfileStore, type CatalogInfo} from "models";
import {PreferenceStore} from "stores";
import {CatalogAxisEligibility, getAutoSelectedCatalogAxisColumn, getCatalogAxisEligibility, type ProcessedColumnData} from "utilities";

import {StreamingRowSource} from "./RowSource";

export type ControlHeader = {columnIndex: number | undefined; dataIndex: number | undefined; display: boolean | undefined; filter: string; columnWidth: number | null | undefined};

export class CatalogProfileStore extends AbstractCatalogProfileStore {
    @observable catalogInfo: CatalogInfo;
    @observable catalogControlHeader: Map<string, ControlHeader>;
    @observable catalogHeader: Array<CARTA.CatalogHeader>;
    readonly rows: StreamingRowSource;

    constructor(catalogInfo: CatalogInfo, catalogHeader: Array<CARTA.CatalogHeader>, catalogData: Map<number, ProcessedColumnData>, catalogType: CatalogType = CatalogType.FILE) {
        super(catalogType);
        this.catalogInfo = catalogInfo;
        this.catalogHeader = catalogHeader.sort((a, b) => a.columnIndex - b.columnIndex);
        this.catalogControlHeader = this.initCatalogControlHeader;
        this.selectedPointIndices = [];
        const coordinateSystem = catalogInfo.fileInfo.coosys?.[0];
        if (coordinateSystem) {
            const system = AbstractCatalogProfileStore.getCatalogSystem(coordinateSystem.system);
            const defaults = AbstractCatalogProfileStore.getCatalogCoordinateDefaults(coordinateSystem.system);
            this.catalogCoordinateSystem = {
                system: system,
                equinox: coordinateSystem.equinox || defaults.equinox,
                epoch: coordinateSystem.epoch || defaults.epoch
            };
        } else {
            this.catalogCoordinateSystem = {
                system: CatalogSystemType.ICRS,
                equinox: null,
                epoch: null
            };
        }
        this.rows = new StreamingRowSource(catalogInfo.fileId, catalogInfo.dataSize, catalogData, this.columnIndices);
        makeObservable(this);
    }

    @action setCatalogHeader(catalogHeader: Array<CARTA.CatalogHeader>) {
        this.catalogHeader = catalogHeader;
    }

    @computed get initCatalogControlHeader() {
        const controlHeaders = new Map<string, ControlHeader>();
        const catalogHeader = this.catalogHeader;

        if (catalogHeader.length) {
            // Auto-select can already reach a coordinate column past the display cut, but only by
            // enabling it and spending a round trip re-fetching. Nominating it here gets its values
            // into the first response instead, which is what a unitless string column needs before
            // its format can be judged at all.
            const coordinateColumnNames = this.initialCoordinateColumnNames;
            for (let index = 0; index < catalogHeader.length; index++) {
                const header = catalogHeader[index];
                const shouldDisplay = index < PreferenceStore.Instance.catalogDisplayedColumnSize || coordinateColumnNames.has(header.name);
                const controlHeader: ControlHeader = {columnIndex: header.columnIndex, dataIndex: index, display: shouldDisplay, filter: "", columnWidth: null};
                controlHeaders.set(header.name, controlHeader);
            }
        }
        return controlHeaders;
    }

    /**
     * The best-named candidate for each of the image overlay axes this catalog's coordinate system
     * uses. Names only nominate here: whether a column is actually usable is still decided from its
     * units or its values, once there are values to look at.
     *
     * Empty when the user has turned off automatic axis selection. Displaying these columns is only
     * useful because auto-select is going to want them, so guessing at them anyway would be doing
     * the very thing that preference asks us not to do.
     */
    @computed private get initialCoordinateColumnNames(): Set<string> {
        if (!PreferenceStore.Instance.shouldAutoSelectImageOverlayCoordinateColumns) {
            return new Set<string>();
        }

        const system = AbstractCatalogProfileStore.getCatalogSystem(this.catalogInfo.fileInfo.coosys?.[0]?.system);
        const axes = this.systemCoordinateMap.get(system);
        if (!axes) {
            return new Set<string>();
        }

        // A column that could never hold a number is not worth a slot, however it is named.
        const candidates = this.catalogHeader.filter(header => getCatalogAxisEligibility(header.dataType, header.units).status !== CatalogAxisEligibility.Ineligible).map(header => header.name);

        const nominated = [getAutoSelectedCatalogAxisColumn(axes.x, candidates, system), getAutoSelectedCatalogAxisColumn(axes.y, candidates, system)];
        return new Set<string>(nominated.filter((name): name is string => name !== undefined));
    }

    @action setMaxRows(maxRows: number) {
        this.updateTableStatus(true);
        this.rows.setRowLimit(maxRows);
    }
}

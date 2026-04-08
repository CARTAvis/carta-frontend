import * as React from "react";
import SplitPane, {Pane} from "react-split-pane";
import {AnchorButton, Button, ButtonGroup, Classes, FormGroup, HTMLTable, Intent, MenuItem, NonIdealState, PopoverPosition, Pre, Switch, Tooltip} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRendererProps, Select} from "@blueprintjs/select";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table2} from "@blueprintjs/table";
import * as ScrollUtils from "@blueprintjs/table/lib/esm/common/internal/scrollUtils";
import {CARTA} from "carta-protobuf";
import FuzzySearch from "fuzzy-search";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ClearableNumericInputComponent, FilterableTableComponent, type FilterableTableComponentProps, ResizeDetector} from "components/Shared";
import {CatalogOverlay, CatalogPlotType, CatalogSettingsTabs, CatalogSystemType, CatalogUpdateMode, HeaderTableColumnName, HelpType, ImageViewLayer, PreferenceKeys, RegionMode} from "enums";
import {AbstractCatalogProfileStore} from "models";
import {AppStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, type DefaultWidgetConfig, PreferenceStore, type WidgetProps, WidgetsStore} from "stores";
import {type CatalogPlotWidgetStoreProps, CatalogWidgetStore} from "stores/Widgets";
import {clamp, type ProcessedColumnData, toFixed} from "utilities";

import "./CatalogOverlayComponent.scss";

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {
    @observable private catalogTableRef: Table2 | undefined = undefined;
    @observable private height: number = 600;
    @observable private width: number = 720;

    @observable private isShowHeader: boolean = true;
    private prevPosition: number = 60;
    private static readonly ExpectedColumnCount: number = 5; // Name, Unit, Type, Display, Description
    private widgetId: string;
    private readonly disposers: IReactionDisposer[] = [];
    private autoSelectAttemptedCatalogIds: Set<number> = new Set();

    private catalogHeaderTableRef: Table2 | undefined = undefined;
    private catalogFileNames: Map<number, string>;
    static readonly axisDataType = [
        CARTA.ColumnType.Double,
        CARTA.ColumnType.Float,
        CARTA.ColumnType.Int8,
        CARTA.ColumnType.Uint8,
        CARTA.ColumnType.Int16,
        CARTA.ColumnType.Uint16,
        CARTA.ColumnType.Int32,
        CARTA.ColumnType.Uint32,
        CARTA.ColumnType.Int64,
        CARTA.ColumnType.Uint64
    ];
    private static readonly CoordinateColumnExclusionPattern = /^(?:e_|pm)|_pm|propermotion|err|error|sigma|sig|unc|uncertainty|offset|resid|residual/;
    private static readonly RightAscensionPatterns = [/^ra\b/i, /^_?raj2000\b/i, /^ra_?icrs\b/i, /^ra(?:mean|stack)\b/i, /^ra_?deg\b/i, /^ra_/i, /^r\.?a\.?(?:$|[_\s-])/i, /^right[ _-]?asc(?:ension)?\b/i, /^alpha\b/i, /^_?raj(?:\b|[0-9])/i];
    private static readonly DeclinationPatterns = [/^dec\b/i, /^_?dej2000\b/i, /^(?:de|dec)_?icrs\b/i, /^dec(?:mean|stack)\b/i, /^(?:de|dec)_?deg\b/i, /^dec_/i, /^decl(?:ination)?\b/i, /^delta\b/i, /^_?dej(?:\b|[0-9])/i];
    private static readonly GalacticLongitudePatterns = [/^glon$/i, /^glon_?deg$/i, /^gal(?:actic)?_?lon(?:gitude)?(?:_?deg)?$/i, /^lon_?gal(?:actic)?$/i, /^gal_?l$/i, /^l$/i];
    private static readonly GalacticLatitudePatterns = [/^glat$/i, /^glat_?deg$/i, /^gal(?:actic)?_?lat(?:itude)?(?:_?deg)?$/i, /^lat_?gal(?:actic)?$/i, /^gal_?b$/i, /^b$/i];
    private static readonly EclipticLongitudePatterns = [/^elon$/i, /^elon_?deg$/i, /^ecl(?:iptic)?_?lon(?:gitude)?(?:_?deg)?$/i, /^lon_?ecl(?:iptic)?$/i, /^lambda(?:_?(?:deg|j2000))?$/i];
    private static readonly EclipticLatitudePatterns = [/^elat$/i, /^elat_?deg$/i, /^ecl(?:iptic)?_?lat(?:itude)?(?:_?deg)?$/i, /^lat_?ecl(?:iptic)?$/i, /^beta(?:_?(?:deg|j2000))?$/i];
    private static readonly Pixel0XPatterns = [/^x$/i, /^xcentroid$/i, /^xcentroid_win$/i, /^xcpeak$/i, /^xpeak$/i];
    private static readonly Pixel0YPatterns = [/^y$/i, /^ycentroid$/i, /^ycentroid_win$/i, /^ycpeak$/i, /^ypeak$/i];
    private static readonly Pixel1XPatterns = [/^x_?image$/i, /^xwin_?image$/i];
    private static readonly Pixel1YPatterns = [/^y_?image$/i, /^ywin_?image$/i];
    private static readonly AxisAutoSelectPatterns = new Map<CatalogOverlay, RegExp[]>([
        [CatalogOverlay.RA, CatalogOverlayComponent.RightAscensionPatterns],
        [CatalogOverlay.DEC, CatalogOverlayComponent.DeclinationPatterns],
        [CatalogOverlay.GLON, CatalogOverlayComponent.GalacticLongitudePatterns],
        [CatalogOverlay.GLAT, CatalogOverlayComponent.GalacticLatitudePatterns],
        [CatalogOverlay.ELON, CatalogOverlayComponent.EclipticLongitudePatterns],
        [CatalogOverlay.ELAT, CatalogOverlayComponent.EclipticLatitudePatterns],
        [CatalogOverlay.X0, CatalogOverlayComponent.Pixel0XPatterns],
        [CatalogOverlay.Y0, CatalogOverlayComponent.Pixel0YPatterns],
        [CatalogOverlay.X1, CatalogOverlayComponent.Pixel1XPatterns],
        [CatalogOverlay.Y1, CatalogOverlayComponent.Pixel1YPatterns]
    ]);

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-overlay",
            type: "catalog-overlay",
            minWidth: 720,
            minHeight: 400,
            defaultWidth: 720,
            defaultHeight: 600,
            title: "Catalog",
            isCloseable: true,
            helpType: HelpType.CATALOG_OVERLAY,
            componentId: "catalog-overlay-component"
        };
    }

    @computed get catalogFileId() {
        return CatalogStore.Instance.catalogProfiles?.get(this.widgetId);
    }

    @computed get widgetStore(): CatalogWidgetStore | undefined {
        const catalogFileId = this.catalogFileId;
        const widgetStoreId = catalogFileId !== undefined ? CatalogStore.Instance.catalogWidgets.get(catalogFileId) : undefined;
        return widgetStoreId ? WidgetsStore.Instance.catalogWidgets.get(widgetStoreId) : undefined;
    }

    @computed get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore | undefined {
        const catalogFileId = this.catalogFileId;
        return catalogFileId !== undefined ? CatalogStore.Instance.catalogProfileStores.get(catalogFileId) : undefined;
    }

    @action handleCatalogFileChange = (fileId: number) => {
        CatalogStore.Instance.catalogProfiles.set(this.widgetId, fileId);
    };

    @action handleFileCloseClick = () => {
        const appStore = AppStore.Instance;
        const catalogWidgetStore = this.widgetStore;
        const catalogFileId = this.catalogFileId;
        if (catalogFileId !== undefined) {
            const widgetId = CatalogStore.Instance.catalogWidgets.get(catalogFileId);
            if (!widgetId) {
                return;
            }
            appStore.removeCatalog(catalogFileId, widgetId, this.widgetId);
            catalogWidgetStore?.resetMaps();
            this.autoSelectAttemptedCatalogIds.delete(catalogFileId);
        }
    };

    // overwrite scrollToRegion to avoid crush when viewportRect is undefined (unpin action with goldenLayout)
    // https://github.com/palantir/blueprint/blob/841b2e12fec1970704b754f7794c683c735d0439/packages/table/src/table.tsx#L761
    scrollToRegion = (ref, region) => {
        if (ref) {
            const state = ref.state;
            const numFrozenColumns = state?.numFrozenColumnsClamped;
            const numFrozenRows = state?.numFrozenRowsClamped;
            let viewportRect = ref.state.viewportRect;
            if (!viewportRect) {
                viewportRect = ref.locator.getViewportRect();
            }
            const currScrollLeft = viewportRect?.left;
            const currScrollTop = viewportRect?.top;
            const {scrollLeft, scrollTop} = ScrollUtils.getScrollPositionForRegion(region, currScrollLeft, currScrollTop, ref.grid.getCumulativeWidthBefore, ref.grid.getCumulativeHeightBefore, numFrozenRows, numFrozenColumns);
            const correctedScrollLeft = ref.shouldDisableHorizontalScroll() ? 0 : scrollLeft;
            const correctedScrollTop = ref.shouldDisableVerticalScroll() ? 0 : scrollTop;
            ref.quadrantStackInstance.scrollToPosition(correctedScrollLeft, correctedScrollTop);
        }
    };

    @computed get catalogDataInfo(): {dataset: Map<number, ProcessedColumnData> | undefined; numVisibleRows: number} {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        let dataset: Map<number, ProcessedColumnData> | undefined;
        let numVisibleRows = 0;
        if (profileStore && catalogWidgetStore) {
            dataset = profileStore.catalogData;
            numVisibleRows = profileStore.numVisibleRows;
            if (profileStore.regionSelected && catalogWidgetStore.showSelectedData) {
                if (profileStore.isFileBasedCatalog) {
                    dataset = profileStore.selectedData;
                }
                numVisibleRows = profileStore.regionSelected;
            }
        }
        return {dataset, numVisibleRows};
    }

    @computed get enablePlotButton(): boolean {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const enable = !profileStore?.loadingData && !profileStore?.updatingDataStream && catalogWidgetStore?.xAxis !== CatalogOverlay.NONE;
        if (catalogWidgetStore?.catalogPlotType === CatalogPlotType.Histogram) {
            return enable;
        } else {
            return catalogWidgetStore?.yAxis !== CatalogOverlay.NONE && enable;
        }
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
        this.widgetId = props.id;

        if (!CatalogStore.Instance.catalogProfiles.has(this.widgetId)) {
            CatalogStore.Instance.catalogProfiles.set(this.widgetId, 1);
        }
        this.catalogFileNames = new Map<number, string>();

        this.disposers.push(
            autorun(() => {
                const appStore = AppStore.Instance;
                const frame = appStore.activeFrame;
                const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;
                const profileStore = this.profileStore;

                if (profileStore) {
                    let progressString = "";
                    const fileName = profileStore.catalogInfo.fileInfo.name;
                    const progress = profileStore.progress;
                    if (progress && isFinite(progress) && progress < 1) {
                        progressString = `[${toFixed(progress * 100)}% complete]`;
                    }

                    if (frame && catalogFileIds?.length) {
                        WidgetsStore.Instance.setWidgetComponentTitle(this.widgetId, `Catalog : ${fileName} ${progressString}`);
                    } else {
                        WidgetsStore.Instance.setWidgetComponentTitle(this.widgetId, `Catalog`);
                    }
                } else {
                    WidgetsStore.Instance.setWidgetComponentTitle(this.widgetId, `Catalog`);
                }
            })
        );

        this.disposers.push(
            // Auto-select coordinate columns by common prefixes when axes are None (attempt at most once per catalog)
            autorun(() => {
                const profileStore = this.profileStore;
                const catalogWidgetStore = this.widgetStore;
                const catalogFileId = this.catalogFileId;
                if (!profileStore || !catalogWidgetStore || catalogFileId === undefined) {
                    return;
                }

                if (this.autoSelectAttemptedCatalogIds.has(catalogFileId)) {
                    return;
                }

                if (catalogWidgetStore.catalogPlotType !== CatalogPlotType.ImageOverlay) {
                    this.autoSelectAttemptedCatalogIds.add(catalogFileId);
                    return;
                }

                this.autoSelectAxes();

                this.autoSelectAttemptedCatalogIds.add(catalogFileId);
            })
        );
    }

    componentWillUnmount() {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    }

    @action private onCatalogDataTableRefUpdated = ref => {
        this.catalogTableRef = ref;
    };

    onControlHeaderTableRef = ref => {
        this.catalogHeaderTableRef = ref;
    };

    @action private onResize = (width: number, height: number) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        this.height = height;
        this.width = width;

        // fixed bug from blueprintjs, only display 4 rows. catalog name missing (in PR #1104) fixed after package update.
        if (profileStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, this.props.docked);
        }
        if (profileStore && this.catalogTableRef && catalogWidgetStore) {
            this.updateTableSize(this.catalogTableRef, this.props.docked);
            if (profileStore.regionSelected && catalogWidgetStore.catalogTableAutoScroll && !catalogWidgetStore.showSelectedData) {
                this.scrollToRegion(this.catalogTableRef, profileStore.autoScrollRowNumber);
            }
        }
    };

    private updateTableSize(ref: any, docked: boolean) {
        const viewportRect = ref.locator.getViewportRect();
        ref.updateViewportRect(viewportRect);
        // fixed bug for blueprint table, first column overlap with row index
        // trigger table update
        if (docked) {
            ref.scrollToRegion(Regions.column(0));
        }
    }

    private handleHeaderDisplayChange(changeEvent: any, columnName: string) {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const val = changeEvent.target.checked;
        const header = profileStore?.catalogControlHeader.get(columnName);
        profileStore?.setHeaderDisplay(val, columnName);

        const shouldUpdateFilter = (val === true || (header?.filter !== "" && val === false)) && profileStore?.isFileBasedCatalog;

        if (shouldUpdateFilter) {
            profileStore?.setIsUpdateColumn(true);
            this.handleFilterRequest();
        }

        const removedXAxis = catalogWidgetStore?.xAxis === columnName;
        const removedYAxis = catalogWidgetStore?.yAxis === columnName;

        if (removedXAxis) {
            catalogWidgetStore.setxAxis(CatalogOverlay.NONE);
        }
        if (removedYAxis) {
            catalogWidgetStore.setyAxis(CatalogOverlay.NONE);
        }

        this.reselectRemovedAxes(removedXAxis, removedYAxis);
    }

    private renderDataColumn(columnName: string, columnData: any) {
        return (
            <Column
                key={columnName}
                name={columnName}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell className="header-table-cell" key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>
                        <>
                            <div data-testid={"catalog-header-table-" + rowIndex + "-" + columnIndex}>{columnData[rowIndex]}</div>
                        </>
                    </Cell>
                )}
            />
        );
    }

    private renderSwitchButtonCell(rowIndex: number, columnName: string) {
        const profileStore = this.profileStore;
        const headerInfo = profileStore?.catalogControlHeader.get(columnName);
        const display = headerInfo?.display ?? false;
        const disable = profileStore?.loadingData;
        return (
            <Cell className="header-table-cell" key={`cell_switch_${rowIndex}`}>
                <>
                    <Switch
                        className="cell-switch-button"
                        key={`cell_switch_button_${rowIndex}`}
                        disabled={disable}
                        checked={display}
                        onChange={changeEvent => this.handleHeaderDisplayChange(changeEvent, columnName)}
                        data-testid={"catalog-header-table-switch-" + rowIndex}
                    />
                </>
            </Cell>
        );
    }

    @computed get axisOption(): string[] {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return [CatalogOverlay.NONE];
        }
        const axisOptions: string[] = [];
        axisOptions.push(CatalogOverlay.NONE);
        profileStore.catalogControlHeader.forEach((header, columnName) => {
            if (header?.dataIndex !== undefined) {
                const dataType = profileStore.catalogHeader[header.dataIndex]?.dataType;
                if (dataType && CatalogOverlayComponent.axisDataType.includes(dataType) && header.display) {
                    axisOptions.push(columnName);
                }
            }
        });
        return axisOptions;
    }

    private getAutoSelectableAxisOptions(includeHidden = false): string[] {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return [];
        }

        const axisOptions: string[] = [];
        profileStore.catalogControlHeader.forEach((header, columnName) => {
            if (header?.dataIndex === undefined) {
                return;
            }

            const dataType = profileStore.catalogHeader[header.dataIndex]?.dataType;
            if (!dataType || !CatalogOverlayComponent.axisDataType.includes(dataType) || (!includeHidden && !header.display) || this.isExcludedCoordinateName(columnName)) {
                return;
            }

            axisOptions.push(columnName);
        });
        return axisOptions;
    }

    private isExcludedCoordinateName(name: string): boolean {
        const normalizedName = name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
        return CatalogOverlayComponent.CoordinateColumnExclusionPattern.test(normalizedName);
    }

    private findPreferredAxisColumn(axisOptions: string[], patterns: RegExp[]): string | undefined {
        for (const pattern of patterns) {
            const columnName = axisOptions.find(option => pattern.test(option));
            if (columnName) {
                return columnName;
            }
        }
        return undefined;
    }

    private findAutoSelectedAxisColumn(axisLabel: CatalogOverlay, currentAxis: string, axisOptions: string[]): string | undefined {
        if (currentAxis !== CatalogOverlay.NONE) {
            return undefined;
        }

        const patterns = CatalogOverlayComponent.AxisAutoSelectPatterns.get(axisLabel);
        if (!patterns) {
            return undefined;
        }

        return this.findPreferredAxisColumn(axisOptions, patterns);
    }

    private enableAxisColumns(columnNames: Array<string | undefined>): boolean {
        const profileStore = this.profileStore;
        if (!profileStore) {
            return false;
        }

        const visibleColumns = new Set(columnNames.filter((columnName): columnName is string => Boolean(columnName)));
        let didEnableColumns = false;
        visibleColumns.forEach(columnName => {
            const header = profileStore.catalogControlHeader.get(columnName);
            if (header && !header.display) {
                profileStore.setHeaderDisplay(true, columnName);
                didEnableColumns = true;
            }
        });
        return didEnableColumns;
    }

    private setAutoSelectedAxes(axisOptions: string[], selectXAxis = true, selectYAxis = true): {didSelectX: boolean; didSelectY: boolean} {
        const catalogWidgetStore = this.widgetStore;
        if (catalogWidgetStore?.catalogPlotType !== CatalogPlotType.ImageOverlay) {
            return {didSelectX: false, didSelectY: false};
        }

        const xColumnName = selectXAxis ? this.findAutoSelectedAxisColumn(this.xAxisLabel, catalogWidgetStore.xAxis, axisOptions) : undefined;
        const yColumnName = selectYAxis ? this.findAutoSelectedAxisColumn(this.yAxisLabel, catalogWidgetStore.yAxis, axisOptions) : undefined;

        if (xColumnName) {
            catalogWidgetStore.setxAxis(xColumnName);
        }
        if (yColumnName) {
            catalogWidgetStore.setyAxis(yColumnName);
        }

        return {didSelectX: Boolean(xColumnName), didSelectY: Boolean(yColumnName)};
    }

    private autoSelectAxes(forceReset = false) {
        const catalogWidgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (catalogWidgetStore?.catalogPlotType !== CatalogPlotType.ImageOverlay) {
            return;
        }

        if (forceReset) {
            catalogWidgetStore.setxAxis(CatalogOverlay.NONE);
            catalogWidgetStore.setyAxis(CatalogOverlay.NONE);
        }

        const selected = this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions());
        if (selected.didSelectX && selected.didSelectY) {
            return;
        }

        const hiddenAxisOptions = this.getAutoSelectableAxisOptions(true);
        const fallbackXColumn = selected.didSelectX ? undefined : this.findAutoSelectedAxisColumn(this.xAxisLabel, catalogWidgetStore.xAxis, hiddenAxisOptions);
        const fallbackYColumn = selected.didSelectY ? undefined : this.findAutoSelectedAxisColumn(this.yAxisLabel, catalogWidgetStore.yAxis, hiddenAxisOptions);
        const enabledHiddenColumns = this.enableAxisColumns([fallbackXColumn, fallbackYColumn]);

        if (fallbackXColumn) {
            catalogWidgetStore.setxAxis(fallbackXColumn);
        }
        if (fallbackYColumn) {
            catalogWidgetStore.setyAxis(fallbackYColumn);
        }

        if (enabledHiddenColumns && profileStore?.isFileBasedCatalog) {
            profileStore.setIsUpdateColumn(true);
            this.handleFilterRequest();
        }
    }

    private applyImageOverlayPlot() {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetStore = this.widgetStore;
        const catalogFileId = this.catalogFileId;

        if (
            !profileStore ||
            !catalogWidgetStore ||
            catalogFileId === undefined ||
            catalogWidgetStore.catalogPlotType !== CatalogPlotType.ImageOverlay ||
            catalogWidgetStore.xAxis === CatalogOverlay.NONE ||
            catalogWidgetStore.yAxis === CatalogOverlay.NONE
        ) {
            return;
        }

        profileStore.setUpdateMode(CatalogUpdateMode.ViewUpdate);
        const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(catalogFileId));
        if (frame) {
            catalogWidgetStore.setAppliedImageOverlayState(catalogWidgetStore.xAxis, catalogWidgetStore.yAxis, profileStore.catalogCoordinateSystem.system);
            const imageCoords = profileStore.get2DPlotData(catalogWidgetStore.xAxis, catalogWidgetStore.yAxis, profileStore.catalogData);
            const wcs = frame.validWcs ? frame.wcsInfo : 0;
            catalogStore.clearImageCoordsData(catalogFileId);
            if (imageCoords.wcsX && imageCoords.wcsY) {
                catalogStore.convertToImageCoordinate(catalogFileId, imageCoords.wcsX, imageCoords.wcsY, wcs, imageCoords.xHeaderInfo?.units ?? "", imageCoords.yHeaderInfo?.units ?? "", profileStore.catalogCoordinateSystem.system, 0, 0);
            }
            profileStore.setSelectedPointIndices(profileStore.selectedPointIndices, false);
        }
        if (profileStore.shouldUpdateData) {
            profileStore.setUpdatingDataStream(true);
            const catalogFilter = profileStore.updateRequestDataSize;
            appStore.sendCatalogFilter(catalogFilter);
        }
    }

    private reselectRemovedAxes(reselectXAxis: boolean, reselectYAxis: boolean) {
        if (!reselectXAxis && !reselectYAxis) {
            return;
        }

        this.setAutoSelectedAxes(this.getAutoSelectableAxisOptions(), reselectXAxis, reselectYAxis);
    }

    @action private handleCatalogSystemChange = (system: CatalogSystemType) => {
        const profileStore = this.profileStore;
        if (!profileStore || profileStore.catalogCoordinateSystem.system === system) {
            return;
        }

        profileStore.setCatalogCoordinateSystem(system);
        this.autoSelectAxes(true);
    };

    private renderColumnNamePopOver = (catalogName: string, itemProps: ItemRendererProps) => {
        return <MenuItem key={catalogName} text={catalogName} onClick={itemProps.handleClick} />;
    };

    private filterColumn: ItemPredicate<string> = (query: string, columnName: string) => {
        const fileSearcher = new FuzzySearch([columnName]);
        return fileSearcher.search(query).length > 0;
    };

    @computed get xAxisLabel(): CatalogOverlay {
        const catalogWidgetStore = this.widgetStore;
        const plotType = catalogWidgetStore?.catalogPlotType;
        switch (plotType) {
            case CatalogPlotType.ImageOverlay:
                const profileStore = this.profileStore;
                return profileStore?.activedSystem?.x ?? CatalogOverlay.X;
            default:
                return CatalogOverlay.X;
        }
    }

    @computed get yAxisLabel(): CatalogOverlay {
        const catalogWidgetStore = this.widgetStore;
        const plotType = catalogWidgetStore?.catalogPlotType;
        switch (plotType) {
            case CatalogPlotType.ImageOverlay:
                const profileStore = this.profileStore;
                return profileStore?.activedSystem?.y ?? CatalogOverlay.Y;
            default:
                return CatalogOverlay.Y;
        }
    }

    private renderButtonColumns(columnName: HeaderTableColumnName, headerNames: Array<string>) {
        switch (columnName) {
            case HeaderTableColumnName.Display:
                return <Column key={columnName} name={columnName} cellRenderer={rowIndex => this.renderSwitchButtonCell(rowIndex, headerNames[rowIndex])} />;
            default:
                return <Column key={columnName} name={columnName} />;
        }
    }

    private static GetDataType(type: CARTA.ColumnType) {
        switch (type) {
            case CARTA.ColumnType.Bool:
                return "bool";
            case CARTA.ColumnType.Int8:
                return "byte";
            case CARTA.ColumnType.Int16:
                return "short";
            case CARTA.ColumnType.Int32:
                return "int";
            case CARTA.ColumnType.Int64:
                return "long";
            case CARTA.ColumnType.Uint8:
                return "unsigned byte";
            case CARTA.ColumnType.Uint16:
                return "unsigned short";
            case CARTA.ColumnType.Uint32:
                return "unsigned int";
            case CARTA.ColumnType.Uint64:
                return "unsigned long";
            case CARTA.ColumnType.Double:
                return "double";
            case CARTA.ColumnType.Float:
                return "float";
            case CARTA.ColumnType.String:
                return "string";
            default:
                return "unsupported";
        }
    }

    private createHeaderTable() {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (!profileStore || !widgetStore) {
            return null;
        }

        const tableColumns: React.ReactElement[] = [];
        const headerNames: string[] = [];
        const headerDescriptions: string[] = [];
        const units: string[] = [];
        const types: string[] = [];
        const headerDataset = profileStore.catalogHeader;
        const numResultsRows = headerDataset.length;
        for (let index = 0; index < headerDataset.length; index++) {
            const header = headerDataset[index];
            headerNames.push(header.name);
            headerDescriptions.push(header.description);
            units.push(header.units);
            types.push(CatalogOverlayComponent.GetDataType(header.dataType));
        }
        const columnName = this.renderDataColumn(HeaderTableColumnName.Name, headerNames);
        tableColumns.push(columnName);
        const columnUnit = this.renderDataColumn(HeaderTableColumnName.Unit, units);
        tableColumns.push(columnUnit);
        const columnType = this.renderDataColumn(HeaderTableColumnName.Type, types);
        tableColumns.push(columnType);
        const columnDisplaySwitch = this.renderButtonColumns(HeaderTableColumnName.Display, headerNames);
        tableColumns.push(columnDisplaySwitch);
        const columnDescription = this.renderDataColumn(HeaderTableColumnName.Description, headerDescriptions);
        tableColumns.push(columnDescription);

        const headerDisplays: boolean[] = [];
        profileStore.catalogControlHeader.forEach(header => headerDisplays.push(header?.display ?? false));

        // Ensure columnWidths array matches the number of expected columns
        const expectedColumnCount = CatalogOverlayComponent.ExpectedColumnCount;
        let columnWidths = widgetStore.headerTableColumnWidths;
        if (!columnWidths || columnWidths.length !== expectedColumnCount) {
            columnWidths = new Array(expectedColumnCount).fill(undefined);
        }

        return (
            <Table2
                ref={ref => this.onControlHeaderTableRef(ref)}
                numRows={numResultsRows}
                enableRowReordering={false}
                renderMode={RenderMode.BATCH}
                selectionModes={SelectionModes.NONE}
                defaultRowHeight={30}
                minRowHeight={20}
                minColumnWidth={30}
                enableGhostCells={true}
                numFrozenColumns={1}
                columnWidths={columnWidths}
                onColumnWidthChanged={this.updateHeaderTableColumnSize}
                enableRowResizing={false}
                cellRendererDependencies={[headerDisplays, profileStore.loadingData]} // trigger re-render on controlHeader change
            >
                {tableColumns}
            </Table2>
        );
    }

    private updateHeaderTableColumnSize = (index: number, size: number) => {
        const widgetsStore = this.widgetStore;
        if (!widgetsStore) {
            return;
        }

        // Ensure the array exists and has the correct length (5 columns)
        const expectedColumnCount = CatalogOverlayComponent.ExpectedColumnCount;
        if (!widgetsStore.headerTableColumnWidths) {
            widgetsStore.headerTableColumnWidths = new Array(expectedColumnCount).fill(undefined);
        } else if (widgetsStore.headerTableColumnWidths.length !== expectedColumnCount) {
            // Resize array to match expected column count
            const newArray = new Array(expectedColumnCount).fill(undefined);
            for (let i = 0; i < Math.min(widgetsStore.headerTableColumnWidths.length, expectedColumnCount); i++) {
                newArray[i] = widgetsStore.headerTableColumnWidths[i];
            }
            widgetsStore.headerTableColumnWidths = newArray;
        }

        if (index >= 0 && index < widgetsStore.headerTableColumnWidths.length) {
            widgetsStore.headerTableColumnWidths[index] = size;
        }
    };

    private resetSelectedPointIndices = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        profileStore?.setSelectedPointIndices([], false);
        catalogWidgetStore?.setShowSelectedData(false);
    };

    private shouldPreserveImageOverlayDuringColumnUpdate(): boolean {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        if (!profileStore?.isUpdateColumnMode || catalogWidgetStore?.catalogPlotType !== CatalogPlotType.ImageOverlay || catalogWidgetStore.xAxis === CatalogOverlay.NONE || catalogWidgetStore.yAxis === CatalogOverlay.NONE) {
            return false;
        }

        const coords = profileStore.get2DPlotData(catalogWidgetStore.xAxis, catalogWidgetStore.yAxis, profileStore.catalogData);
        return Boolean(coords.wcsX && coords.wcsY);
    }

    private handleFilterRequest = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const catalogFileId = this.catalogFileId;

        if (!profileStore || !catalogWidgetStore || catalogFileId === undefined) {
            return;
        }

        // Skip if normal conditions prevent filtering AND we're not in column update mode
        const shouldSkipRequest = !profileStore.isUpdateColumnMode && (profileStore.loadOntoImage || !profileStore.updateTableView || !profileStore.hasFilter);

        if (shouldSkipRequest) {
            return;
        }

        const appStore = AppStore.Instance;
        if (profileStore && appStore) {
            this.resetSelectedPointIndices();
            if (!this.shouldPreserveImageOverlayDuringColumnUpdate()) {
                appStore.catalogStore.clearImageCoordsData(catalogFileId);
            }
            if (profileStore.isFileBasedCatalog) {
                profileStore.updateTableStatus(false);
                profileStore.resetFilterRequest();
                const filter = profileStore.updateRequestDataSize;
                if (filter.imageBounds) {
                    filter.imageBounds.xColumnName = catalogWidgetStore.xAxis;
                    filter.imageBounds.yColumnName = catalogWidgetStore.yAxis;
                }
                filter.fileId = profileStore.catalogInfo.fileId;
                filter.filterConfigs = profileStore.getUserFilters();
                filter.columnIndices = profileStore.displayedColumnHeaders.map(v => v.columnIndex);
                appStore.sendCatalogFilter(filter);
            } else {
                profileStore.resetFilterRequest(profileStore.getUserFilters());
            }
        }
    };

    private updateSortRequest = (columnName: string, sortingType: CARTA.SortingType | null) => {
        const profileStore = this.profileStore;
        const catalogFileId = this.catalogFileId;
        const appStore = AppStore.Instance;

        if (profileStore && appStore && catalogFileId !== undefined) {
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(catalogFileId);
            profileStore.setSortingInfo(columnName, sortingType);
            if (profileStore.isFileBasedCatalog) {
                profileStore.resetFilterRequest();
                const filter = profileStore.updateRequestDataSize;
                filter.sortColumn = columnName;
                filter.sortingType = sortingType;
                appStore.sendCatalogFilter(filter);
            }
        }
    };

    private updateByInfiniteScroll = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const selectedOnly = catalogWidgetStore?.showSelectedData;
        if (profileStore?.loadingData === false && profileStore.updateMode === CatalogUpdateMode.TableUpdate && profileStore.shouldUpdateData && !selectedOnly) {
            profileStore.setUpdateMode(CatalogUpdateMode.TableUpdate);
            const filter = profileStore.updateRequestDataSize;
            filter.columnIndices = profileStore.displayedColumnHeaders.map(v => v.columnIndex);
            AppStore.Instance.sendCatalogFilter(filter);
            profileStore.setLoadingDataStatus(true);
        }
    };

    private handleResetClick = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const catalogFileId = this.catalogFileId;
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;

        if (!profileStore || !catalogWidgetStore || catalogFileId === undefined) {
            return;
        }

        const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(catalogFileId));

        appStore.updateActiveLayer(ImageViewLayer.RegionMoving);
        frame?.regionSet.setMode(RegionMode.MOVING);

        if (profileStore && catalogWidgetStore) {
            profileStore.resetCatalogFilterRequest();
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(catalogFileId);
            catalogWidgetStore.clearAppliedImageOverlayState();
            if (profileStore.isFileBasedCatalog) {
                appStore.sendCatalogFilter(profileStore.catalogFilterRequest);
            }
            catalogWidgetStore.resetMaps();
        }
    };

    private handlePlotClick = () => {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetStore = this.widgetStore;
        const catalogFileId = this.catalogFileId;

        if (!profileStore || !catalogWidgetStore || catalogFileId === undefined) {
            return;
        }

        // init plot data
        switch (catalogWidgetStore.catalogPlotType) {
            case CatalogPlotType.ImageOverlay:
                this.applyImageOverlayPlot();
                break;
            case CatalogPlotType.D2Scatter:
                const scatterProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: catalogWidgetStore.xAxis,
                    yColumnName: catalogWidgetStore.yAxis,
                    plotType: catalogWidgetStore.catalogPlotType
                };
                const scatterPlot = appStore.widgetsStore.createFloatingCatalogPlotWidget(scatterProps);
                if (scatterPlot.widgetComponentId) {
                    catalogStore.setCatalogPlots(scatterPlot.widgetComponentId, catalogFileId, scatterPlot.widgetStoreId ?? "");
                }
                break;
            case CatalogPlotType.Histogram:
                const historgramProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: catalogWidgetStore.xAxis,
                    plotType: catalogWidgetStore.catalogPlotType
                };
                const histogramPlot = appStore.widgetsStore.createFloatingCatalogPlotWidget(historgramProps);
                if (histogramPlot.widgetComponentId) {
                    catalogStore.setCatalogPlots(histogramPlot.widgetComponentId, catalogFileId, histogramPlot.widgetStoreId ?? "");
                }
                break;
            default:
                break;
        }
    };

    private handlePlotTypeChange = (plotType: CatalogPlotType) => {
        this.widgetStore?.setCatalogPlotType(plotType);
    };

    // source selected in table
    private onCatalogTableDataSelected = (selectedDataIndices: number[]) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        if (!catalogWidgetStore?.showSelectedData) {
            if (selectedDataIndices.length === 1) {
                const selectedPointIndexs = profileStore?.selectedPointIndices;
                let highlighted = false;
                if (selectedPointIndexs?.length === 1) {
                    highlighted = selectedPointIndexs.includes(selectedDataIndices[0]);
                }
                if (!highlighted) {
                    profileStore?.setSelectedPointIndices(selectedDataIndices, true);
                } else {
                    profileStore?.setSelectedPointIndices([], false);
                }
            } else {
                profileStore?.setSelectedPointIndices(selectedDataIndices, true);
            }
        }
    };

    private renderFileIdPopOver = (fileId: number, itemProps: ItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        const text = `${fileId}: ${fileName}`;
        return <MenuItem key={fileId} text={text} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private renderPlotTypePopOver = (plotType: CatalogPlotType, itemProps: ItemRendererProps) => {
        return <MenuItem key={plotType} text={plotType} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    @computed get isImageOverlaySelectionDirty(): boolean {
        const catalogWidgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        if (!catalogWidgetStore || !profileStore || catalogWidgetStore.catalogPlotType !== CatalogPlotType.ImageOverlay || !catalogWidgetStore.hasAppliedImageOverlay) {
            return false;
        }

        return (
            catalogWidgetStore.appliedImageOverlayXAxis !== catalogWidgetStore.xAxis ||
            catalogWidgetStore.appliedImageOverlayYAxis !== catalogWidgetStore.yAxis ||
            catalogWidgetStore.appliedImageOverlaySystem !== profileStore.catalogCoordinateSystem.system
        );
    }

    @action private handleSplitChange = (newSize: number) => {
        // 130 is from 132, the height of widget excluding the header and table, subtracting 2 for the split bar width(?)
        const position = clamp((newSize / (this.height - 130)) * 100, CatalogWidgetStore.MinTableSeparatorPosition, CatalogWidgetStore.MaxTableSeparatorPosition);
        if (position) {
            this.isShowHeader = position === 100 ? false : true;
            this.prevPosition = position < 60 ? position : 60;
            this.widgetStore?.setTableSeparatorPosition(`${position.toPrecision(4)}%`);
            PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION, `${position.toPrecision(4)}%`);
        }

        const profileStore = this.profileStore;
        if (profileStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, false);
        }
        if (profileStore && this.catalogTableRef) {
            this.updateTableSize(this.catalogTableRef, false);
        }
    };

    @action private handleHideHeader = () => {
        const widgetStore = this.widgetStore;
        const position = widgetStore?.tableSeparatorPosition !== "100%" ? 100 : this.prevPosition;
        this.isShowHeader = position === 100 ? false : true;
        widgetStore?.setTableSeparatorPosition(`${position}%`);
    };

    private renderSystemPopOver = (system: CatalogSystemType, itemProps: ItemRendererProps) => {
        const menuItem = <MenuItem key={system} text={AbstractCatalogProfileStore.CoordinateSystemName.get(system)} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
        switch (system) {
            case CatalogSystemType.Pixel0:
                return (
                    <div key={system}>
                        <Tooltip position="auto-end" content={<small>PIX0: 0-based image coordinates</small>}>
                            {menuItem}
                        </Tooltip>
                    </div>
                );
            case CatalogSystemType.Pixel1:
                return (
                    <div key={system}>
                        <Tooltip position="auto-end" content={<small>PIX1: 1-based image coordinates</small>}>
                            {menuItem}
                        </Tooltip>
                    </div>
                );
            default:
                return menuItem;
        }
    };

    private shortcutoOnClick = (type: CatalogSettingsTabs) => {
        this.widgetStore?.setSettingsTabId(type);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(CatalogOverlayComponent.WIDGET_CONFIG.title ?? "", this.widgetId, CatalogOverlayComponent.WIDGET_CONFIG.type);
    };

    private onCompleteRender = () => {
        const profileStore = this.profileStore;
        const widgetStore = this.widgetStore;
        if (profileStore?.regionSelected) {
            if (widgetStore?.showSelectedData) {
                // if the length of selected source is 4, only the 4th row displayed. Auto scroll to top fixed it (bug related to blueprintjs table).
                this.scrollToRegion(this.catalogTableRef, Regions.row(0));
            } else {
                if (widgetStore?.catalogTableAutoScroll) {
                    this.scrollToRegion(this.catalogTableRef, profileStore.autoScrollRowNumber);
                    widgetStore.setCatalogTableAutoScroll(false);
                }
            }
        }
    };

    public render() {
        const catalogWidgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;

        if (!profileStore || catalogFileIds === undefined || catalogFileIds?.length === 0 || !catalogWidgetStore) {
            return (
                <div className="catalog-overlay">
                    <NonIdealState icon={"folder-open"} title={"No catalog file loaded"} description={"Load a catalog file using the menu"} />;
                </div>
            );
        }

        const catalogTable = this.catalogDataInfo;

        // Ensure columnWidths matches the number of displayed columns
        const expectedColumnCount = profileStore.displayedColumnHeaders.length;
        let tableColumnWidths = profileStore.tableColumnWidths;
        if (!tableColumnWidths || tableColumnWidths.length !== expectedColumnCount) {
            tableColumnWidths = new Array(expectedColumnCount).fill(undefined);
        }

        // Filter out undefined values to match expected Array<number> type
        const validColumnWidths = tableColumnWidths.filter((w): w is number => w !== undefined);

        const dataTableProps: FilterableTableComponentProps = {
            dataset: catalogTable.dataset ?? new Map(),
            filter: profileStore.catalogControlHeader,
            columnHeaders: profileStore.displayedColumnHeaders,
            numVisibleRows: catalogTable.numVisibleRows,
            columnWidths: validColumnWidths.length === expectedColumnCount ? validColumnWidths : undefined,
            loadingCell: profileStore.loadingData,
            selectedDataIndex: profileStore.selectedPointIndices,
            showSelectedData: catalogWidgetStore.showSelectedData,
            updateTableRef: this.onCatalogDataTableRefUpdated,
            updateColumnFilter: profileStore.setColumnFilter,
            updateByInfiniteScroll: this.updateByInfiniteScroll,
            updateTableColumnWidth: profileStore.setTableColumnWidth,
            updateSelectedRow: this.onCatalogTableDataSelected,
            updateSortRequest: this.updateSortRequest,
            sortingInfo: {
                columnName: profileStore.sortingInfo.columnName ?? "",
                sortingType: profileStore.sortingInfo.sortingType
            },
            disableSort: profileStore.loadOntoImage,
            tableHeaders: profileStore.catalogHeader,
            onCompleteRender: this.onCompleteRender,
            catalogType: profileStore.catalogType,
            applyFilterWithEnter: this.handleFilterRequest
        };

        if (!profileStore.isFileBasedCatalog) {
            const store = profileStore as CatalogOnlineQueryProfileStore;
            dataTableProps.sortedIndexMap = store.sortedIndexMap;
            const selected = profileStore.selectedPointIndices.slice().sort((a, b) => {
                return a - b;
            });
            dataTableProps.sortedIndices = profileStore.getSortedIndices(selected);
        }

        let startIndex = 0;
        if (profileStore.numVisibleRows) {
            startIndex = 1;
        }

        const catalogFileDataSize = profileStore.catalogInfo.dataSize;
        const maxRow = profileStore.maxRows;
        const tableVisibleRows = catalogTable.numVisibleRows;
        let info = `Showing ${startIndex} to ${tableVisibleRows} of total ${catalogFileDataSize} entries`;
        const filterDataSize = profileStore.filterDataSize;
        if (profileStore.hasFilter && filterDataSize !== undefined && isFinite(filterDataSize)) {
            info = `Showing ${startIndex} to ${tableVisibleRows} of ${filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
        }
        if (maxRow < catalogFileDataSize && maxRow > 0) {
            info = `Showing ${startIndex} to ${tableVisibleRows} of top ${maxRow} entries. Total ${catalogFileDataSize} entries`;
        }
        if (maxRow < catalogFileDataSize && maxRow > 0 && profileStore.hasFilter && filterDataSize !== undefined && isFinite(filterDataSize)) {
            if (filterDataSize >= maxRow) {
                info = `Showing ${startIndex} to ${tableVisibleRows} of top ${maxRow} entries. Total ${filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
            } else {
                info = `Showing ${startIndex} to ${tableVisibleRows} of ${filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
            }
        }
        const tableInfo = catalogFileDataSize ? (
            <tr>
                <td className="td-label">
                    <Pre>{info}</Pre>
                </td>
            </tr>
        ) : null;

        const catalogFileItems: number[] = [];
        catalogFileIds.forEach(value => {
            catalogFileItems.push(value);
        });
        this.catalogFileNames = CatalogStore.Instance.getCatalogFileNames(catalogFileIds);

        const systemOptions: CatalogSystemType[] = [];
        AbstractCatalogProfileStore.CoordinateSystemName.forEach((value, key) => {
            systemOptions.push(key);
        });

        const activeSystem = AbstractCatalogProfileStore.CoordinateSystemName.get(profileStore.catalogCoordinateSystem.system);
        const isImageOverlay = catalogWidgetStore.catalogPlotType === CatalogPlotType.ImageOverlay;
        const isHistogram = catalogWidgetStore.catalogPlotType === CatalogPlotType.Histogram;
        const hasAppliedImageOverlay = isImageOverlay && catalogWidgetStore.hasAppliedImageOverlay;
        const isImageOverlaySelectionDirty = this.isImageOverlaySelectionDirty;
        const plotButtonText = isImageOverlay && hasAppliedImageOverlay && isImageOverlaySelectionDirty ? "Update plot" : "Plot";
        const plotButtonIntent = isImageOverlay && isImageOverlaySelectionDirty ? Intent.DANGER : Intent.PRIMARY;
        const disable = profileStore.loadOntoImage;

        let footerDropdownClass = "footer-action-large";
        if (this.width <= 600) {
            footerDropdownClass = "footer-action-small";
        }

        const noResults = <MenuItem disabled={true} text="No results" />;

        return (
            <ResizeDetector onResize={this.onResize} throttleTime={33}>
                <div className={"catalog-overlay"}>
                    <div className={"catalog-overlay-filter-settings"}>
                        <FormGroup inline={true} label="File">
                            <Select
                                className={Classes.FILL}
                                filterable={false}
                                items={catalogFileItems}
                                activeItem={this.catalogFileId}
                                onItemSelect={this.handleCatalogFileChange}
                                itemRenderer={this.renderFileIdPopOver}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            >
                                <Button text={this.catalogFileId} rightIcon="double-caret-vertical" data-testid="catalog-file-dropdown" />
                            </Select>
                        </FormGroup>
                        <FormGroup className="catalog-system" disabled={!isImageOverlay} inline={true} label="System">
                            <Select
                                filterable={false}
                                items={systemOptions}
                                activeItem={profileStore.catalogCoordinateSystem.system}
                                onItemSelect={this.handleCatalogSystemChange}
                                itemRenderer={this.renderSystemPopOver}
                                disabled={!isImageOverlay}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            >
                                <Button text={activeSystem} disabled={!isImageOverlay} rightIcon="double-caret-vertical" data-testid="catalog-system-dropdown" />
                            </Select>
                        </FormGroup>
                        <FormGroup inline={true} label="Show header">
                            <Switch checked={this.isShowHeader} onChange={this.handleHideHeader} />
                        </FormGroup>

                        <ButtonGroup className="catalog-map-buttons">
                            <AnchorButton onClick={() => this.shortcutoOnClick(CatalogSettingsTabs.SIZE)}>Size</AnchorButton>
                            <AnchorButton onClick={() => this.shortcutoOnClick(CatalogSettingsTabs.COLOR)}>Color</AnchorButton>
                            <AnchorButton onClick={() => this.shortcutoOnClick(CatalogSettingsTabs.ORIENTATION)}>Orientation</AnchorButton>
                        </ButtonGroup>
                    </div>
                    <SplitPane
                        className="catalog-table"
                        split="horizontal"
                        primary={"second"}
                        minSize={`${CatalogWidgetStore.MinTableSeparatorPosition}%`}
                        maxSize={`${CatalogWidgetStore.MaxTableSeparatorPosition}%`}
                        size={catalogWidgetStore.tableSeparatorPosition}
                        onDragFinished={this.handleSplitChange}
                        onResizerDoubleClick={this.handleHideHeader}
                    >
                        <Pane className={"catalog-overlay-column-header-container"}>{this.createHeaderTable()}</Pane>
                        <Pane className={"catalog-overlay-data-container"}>
                            <FilterableTableComponent {...dataTableProps} />
                        </Pane>
                    </SplitPane>
                    <div className={Classes.DIALOG_FOOTER}>
                        <div className={"table-info"}>
                            <HTMLTable className="info-display">
                                <tbody data-testid="catalog-table-filtering-info">{tableInfo}</tbody>
                            </HTMLTable>
                        </div>
                        <div className="footer-action-container">
                            <div className={footerDropdownClass}>
                                <Select
                                    className="catalog-type-button"
                                    filterable={false}
                                    items={Object.values(CatalogPlotType)}
                                    activeItem={catalogWidgetStore.catalogPlotType}
                                    onItemSelect={this.handlePlotTypeChange}
                                    itemRenderer={this.renderPlotTypePopOver}
                                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                >
                                    <Button className="bp3" text={catalogWidgetStore.catalogPlotType} rightIcon="double-caret-vertical" data-testid="catalog-rendering-type-dropdown" />
                                </Select>

                                <FormGroup className="catalog-axis" inline={true} label={this.xAxisLabel} disabled={disable}>
                                    <Select
                                        className="catalog-axis-select"
                                        items={this.axisOption}
                                        activeItem={null}
                                        onItemSelect={columnName => catalogWidgetStore.setxAxis(columnName)}
                                        itemRenderer={this.renderColumnNamePopOver}
                                        disabled={disable}
                                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                        filterable={true}
                                        noResults={noResults}
                                        itemPredicate={this.filterColumn}
                                        resetOnSelect={true}
                                    >
                                        <Button className="catalog-axis-button" text={catalogWidgetStore.xAxis} disabled={disable} rightIcon="double-caret-vertical" data-testid="catalog-rendering-column-x-dropdown" />
                                    </Select>
                                </FormGroup>

                                <FormGroup className="catalog-axis" inline={true} label={this.yAxisLabel} disabled={isHistogram || disable}>
                                    <Select
                                        className="catalog-axis-select"
                                        items={this.axisOption}
                                        activeItem={null}
                                        onItemSelect={columnName => catalogWidgetStore.setyAxis(columnName)}
                                        itemRenderer={this.renderColumnNamePopOver}
                                        disabled={isHistogram || disable}
                                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                        filterable={true}
                                        noResults={noResults}
                                        itemPredicate={this.filterColumn}
                                        resetOnSelect={true}
                                    >
                                        <Button className="catalog-axis-button" text={catalogWidgetStore.yAxis} disabled={isHistogram || disable} rightIcon="double-caret-vertical" data-testid="catalog-rendering-column-y-dropdown" />
                                    </Select>
                                </FormGroup>

                                <ClearableNumericInputComponent
                                    className={"catalog-max-rows"}
                                    label="Max rows"
                                    value={profileStore.maxRows}
                                    onValueChanged={val => profileStore.setMaxRows(val)}
                                    onValueCleared={() => profileStore.setMaxRows(profileStore.catalogInfo.dataSize)}
                                    displayExponential={false}
                                    disabled={disable || !profileStore.isFileBasedCatalog}
                                />
                            </div>
                        </div>
                        <div className={Classes.DIALOG_FOOTER}>
                            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                                <AnchorButton
                                    intent={Intent.SUCCESS}
                                    text="Apply filter"
                                    onClick={this.handleFilterRequest}
                                    disabled={disable || !profileStore.updateTableView || !profileStore.hasFilter}
                                    data-testid="catalog-filter-button"
                                />
                                <AnchorButton intent={Intent.WARNING} text="Reset filter" onClick={this.handleResetClick} disabled={disable} data-testid="catalog-reset-button" />
                                <AnchorButton text="Close catalog" onClick={this.handleFileCloseClick} disabled={disable} data-testid="catalog-close-button" />
                                <AnchorButton intent={plotButtonIntent} text={plotButtonText} onClick={this.handlePlotClick} disabled={!this.enablePlotButton} data-testid="catalog-plot-button" />
                            </div>
                        </div>
                    </div>
                </div>
            </ResizeDetector>
        );
    }
}

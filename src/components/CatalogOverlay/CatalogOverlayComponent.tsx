import * as React from "react";
import {action, autorun, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, ButtonGroup, FormGroup, Intent, NonIdealState, Switch, MenuItem, PopoverPosition, Button} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import * as ScrollUtils from "../../../node_modules/@blueprintjs/table/lib/esm/common/internal/scrollUtils";
import {Select, IItemRendererProps, ItemPredicate} from "@blueprintjs/select";
import ReactResizeDetector from "react-resize-detector";
import SplitPane, {Pane} from "react-split-pane";
import FuzzySearch from "fuzzy-search";
import {CARTA} from "carta-protobuf";
import {FilterableTableComponent, FilterableTableComponentProps, ClearableNumericInputComponent} from "components/Shared";
import {AppStore, CatalogStore, CatalogProfileStore, CatalogOverlay, CatalogUpdateMode, CatalogSystemType, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore, PreferenceStore, PreferenceKeys} from "stores";
import {CatalogWidgetStore, CatalogPlotWidgetStoreProps, CatalogPlotType, CatalogSettingsTabs} from "stores/widgets";
import {ComparisonOperator, toFixed} from "utilities";
import {ProcessedColumnData} from "models";
import "./CatalogOverlayComponent.scss";

enum HeaderTableColumnName {
    Name = "Name",
    Unit = "Unit",
    Type = "Type",
    Display = "Display",
    Description = "Description"
}

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {
    @computed get catalogFileId() {
        return CatalogStore.Instance.catalogProfiles?.get(this.props.id);
    }

    @observable catalogTableRef: Table = undefined;
    @observable height: number;
    @observable width: number;

    private catalogHeaderTableRef: Table = undefined;
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

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-overlay",
            type: "catalog-overlay",
            minWidth: 720,
            minHeight: 400,
            defaultWidth: 720,
            defaultHeight: 400,
            title: "Catalog",
            isCloseable: true,
            helpType: HelpType.CATALOG_OVERLAY,
            componentId: "catalog-overlay-component"
        };
    }

    @computed get widgetStore(): CatalogWidgetStore {
        const widgetStoreId = CatalogStore.Instance.catalogWidgets.get(this.catalogFileId);
        return WidgetsStore.Instance.catalogWidgets.get(widgetStoreId);
    }

    @computed get profileStore(): CatalogProfileStore {
        return CatalogStore.Instance.catalogProfileStores.get(this.catalogFileId);
    }

    @action handleCatalogFileChange = (fileId: number) => {
        CatalogStore.Instance.catalogProfiles.set(this.props.id, fileId);
    };

    @action handleFileCloseClick = () => {
        const appStore = AppStore.Instance;
        const catalogWidgetStore = this.widgetStore;
        const widgetId = CatalogStore.Instance.catalogWidgets.get(this.catalogFileId);
        appStore.removeCatalog(this.catalogFileId, widgetId, this.props.id);
        catalogWidgetStore?.resetMaps();
    };

    // overwrite scrollToRegion to avoid crush when viewportRect is undefined (unpin action with goldenLayout)
    // https://github.com/palantir/blueprint/blob/841b2e12fec1970704b754f7794c683c735d0439/packages/table/src/table.tsx#L761
    scrollToRegion = (ref, region) => {
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
    };

    @computed get catalogDataInfo(): {dataset: Map<number, ProcessedColumnData>; numVisibleRows: number} {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        let dataset;
        let numVisibleRows = 0;
        if (profileStore && catalogWidgetStore) {
            dataset = profileStore.catalogData;
            numVisibleRows = profileStore.numVisibleRows;
            if (profileStore.regionSelected) {
                if (catalogWidgetStore.showSelectedData) {
                    dataset = profileStore.selectedData;
                    numVisibleRows = profileStore.regionSelected;
                    // if the length of selected source is 4, only the 4th row displayed. Auto scroll to top fixed it (bug related to blueprintjs table).
                    if (this.catalogTableRef) {
                        this.scrollToRegion(this.catalogTableRef, Regions.row(0));
                    }
                } else {
                    if (this.catalogTableRef && catalogWidgetStore.catalogTableAutoScroll) {
                        this.scrollToRegion(this.catalogTableRef, profileStore.autoScrollRowNumber);
                    }
                }
            }
        }
        return {dataset, numVisibleRows};
    }

    @computed get enablePlotButton(): boolean {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const enable = !profileStore.loadingData && !profileStore.updatingDataStream && catalogWidgetStore.xAxis !== CatalogOverlay.NONE;
        if (catalogWidgetStore.catalogPlotType === CatalogPlotType.Histogram) {
            return enable;
        } else {
            return catalogWidgetStore.yAxis !== CatalogOverlay.NONE && enable;
        }
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        if (!CatalogStore.Instance.catalogProfiles.has(this.props.id)) {
            CatalogStore.Instance.catalogProfiles.set(this.props.id, 1);
        }
        this.catalogFileNames = new Map<number, string>();

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
                    WidgetsStore.Instance.setWidgetComponentTitle(this.props.id, `Catalog : ${fileName} ${progressString}`);
                } else {
                    WidgetsStore.Instance.setWidgetComponentTitle(this.props.id, `Catalog`);
                }
            } else {
                WidgetsStore.Instance.setWidgetComponentTitle(this.props.id, `Catalog`);
            }
        });
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
        // triger table update
        if (docked) {
            ref.scrollToRegion(Regions.column(0));
        }
    }

    private handleHeaderDisplayChange(changeEvent: any, columnName: string) {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const val = changeEvent.target.checked;
        const header = profileStore.catalogControlHeader.get(columnName);
        profileStore.setHeaderDisplay(val, columnName);
        if (val === true || (header.filter !== "" && val === false)) {
            this.handleFilterRequest();
        }
        if (catalogWidgetStore.xAxis === columnName) {
            catalogWidgetStore.setxAxis(CatalogOverlay.NONE);
        }
        if (catalogWidgetStore.yAxis === columnName) {
            catalogWidgetStore.setyAxis(CatalogOverlay.NONE);
        }
    }

    private renderDataColumn(columnName: string, coloumnData: any) {
        return (
            <Column
                key={columnName}
                name={columnName}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell className="header-table-cell" key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>
                        {coloumnData[rowIndex]}
                    </Cell>
                )}
            />
        );
    }

    private renderSwitchButtonCell(rowIndex: number, columnName: string) {
        const profileStore = this.profileStore;
        const display = profileStore.catalogControlHeader.get(columnName).display;
        let disable = profileStore.loadingData;
        return (
            <Cell className="header-table-cell" key={`cell_switch_${rowIndex}`}>
                <React.Fragment>
                    <Switch className="cell-switch-button" key={`cell_switch_button_${rowIndex}`} disabled={disable} checked={display} onChange={changeEvent => this.handleHeaderDisplayChange(changeEvent, columnName)} />
                </React.Fragment>
            </Cell>
        );
    }

    @computed get axisOption() {
        const profileStore = this.profileStore;
        let axisOptions = [];
        axisOptions.push(CatalogOverlay.NONE);
        profileStore.catalogControlHeader.forEach((header, columnName) => {
            const dataType = profileStore.catalogHeader[header.dataIndex].dataType;
            if (CatalogOverlayComponent.axisDataType.includes(dataType) && header.display) {
                axisOptions.push(columnName);
            }
        });
        return axisOptions;
    }

    private renderColumnNamePopOver = (catalogName: string, itemProps: IItemRendererProps) => {
        return <MenuItem key={catalogName} text={catalogName} onClick={itemProps.handleClick} />;
    };

    private filterColumn: ItemPredicate<string> = (query: string, columnName: string) => {
        const fileSearcher = new FuzzySearch([columnName]);
        return fileSearcher.search(query).length > 0;
    };

    @computed get xAxisLable() {
        const catalogWidgetStore = this.widgetStore;
        const plotType = catalogWidgetStore.catalogPlotType;
        switch (plotType) {
            case CatalogPlotType.ImageOverlay:
                const profileStore = this.profileStore;
                return profileStore.activedSystem.x;
            default:
                return CatalogOverlay.X;
        }
    }

    @computed get yAxisLable() {
        const catalogWidgetStore = this.widgetStore;
        const plotType = catalogWidgetStore.catalogPlotType;
        switch (plotType) {
            case CatalogPlotType.ImageOverlay:
                const profileStore = this.profileStore;
                return profileStore.activedSystem.y;
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

    private getDataType(type: CARTA.ColumnType) {
        switch (type) {
            case CARTA.ColumnType.Bool:
                return "bool";
            case CARTA.ColumnType.Int8:
            case CARTA.ColumnType.Int16:
            case CARTA.ColumnType.Int32:
            case CARTA.ColumnType.Int64:
                return "int";
            case CARTA.ColumnType.Uint8:
            case CARTA.ColumnType.Uint16:
            case CARTA.ColumnType.Uint32:
            case CARTA.ColumnType.Uint64:
                return "unsigned int";
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
        const tableColumns = [];
        const headerNames = [];
        const headerDescriptions = [];
        const units = [];
        const types = [];
        const headerDataset = this.profileStore.catalogHeader;
        const numResultsRows = headerDataset.length;
        for (let index = 0; index < headerDataset.length; index++) {
            const header = headerDataset[index];
            headerNames.push(header.name);
            headerDescriptions.push(header.description);
            units.push(header.units);
            types.push(this.getDataType(header.dataType));
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

        return (
            <Table
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
                columnWidths={this.widgetStore.headerTableColumnWidts}
                onColumnWidthChanged={this.updateHeaderTableColumnSize}
                enableRowResizing={false}
            >
                {tableColumns}
            </Table>
        );
    }

    private updateHeaderTableColumnSize = (index: number, size: number) => {
        const widgetsStore = this.widgetStore;
        if (widgetsStore.headerTableColumnWidts) {
            widgetsStore.headerTableColumnWidts[index] = size;
        }
    };

    private getUserFilters(): CARTA.FilterConfig[] {
        let userFilters: CARTA.FilterConfig[] = [];
        const filters = this.profileStore.catalogControlHeader;
        filters.forEach((value, key) => {
            if (value.filter !== undefined && value.display) {
                let filter = new CARTA.FilterConfig();
                const dataType = this.profileStore.catalogHeader[value.dataIndex].dataType;
                filter.columnName = key;
                if (dataType === CARTA.ColumnType.String) {
                    filter.subString = value.filter;
                    userFilters.push(filter);
                } else if (dataType === CARTA.ColumnType.Bool) {
                    if (value.filter) {
                        filter.comparisonOperator = CARTA.ComparisonOperator.Equal;
                        const trueRegex = /^[tTyY1].*$/;
                        const falseRegex = /^[fFnN0].*$/;
                        if (value.filter.match(trueRegex)) {
                            filter.value = 1;
                            userFilters.push(filter);
                        } else if (value.filter.match(falseRegex)) {
                            filter.value = 0;
                            userFilters.push(filter);
                        }
                    }
                } else {
                    const result = CatalogOverlayComponent.GetComparisonOperatorAndValue(value.filter);
                    if (result.operator !== undefined && result.values.length > 0) {
                        filter.comparisonOperator = result.operator;
                        if (result.values.length > 1) {
                            filter.value = Math.min(result.values[0], result.values[1]);
                            filter.secondaryValue = Math.max(result.values[0], result.values[1]);
                        } else {
                            filter.value = result.values[0];
                        }
                        userFilters.push(filter);
                    }
                }
            }
        });
        return userFilters;
    }

    private static GetNumberFromFilter(filterString: string): number {
        return Number(filterString.replace(/[^0-9.+-.]+/g, ""));
    }

    private static GetComparisonOperatorAndValue(filterString: string): {operator: CARTA.ComparisonOperator; values: number[]} {
        const filter = filterString.replace(/\s/g, "");
        let result = {operator: undefined, values: []};
        // order matters, since ... and .. both include .. (same for < and <=, > and >=)
        for (const key of Object.keys(ComparisonOperator)) {
            const operator = ComparisonOperator[key];
            const found = filter.includes(operator);
            if (found) {
                if (operator === ComparisonOperator.Equal) {
                    const equalTo = CatalogOverlayComponent.GetNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.Equal;
                    result.values.push(equalTo);
                    return result;
                } else if (operator === ComparisonOperator.NotEqual) {
                    const notEqualTo = CatalogOverlayComponent.GetNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.NotEqual;
                    result.values.push(notEqualTo);
                    return result;
                } else if (operator === ComparisonOperator.Lesser) {
                    const lessThan = CatalogOverlayComponent.GetNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.Lesser;
                    result.values.push(lessThan);
                    return result;
                } else if (operator === ComparisonOperator.LessorOrEqual) {
                    const lessThanOrEqualTo = CatalogOverlayComponent.GetNumberFromFilter(filter);
                    result.values.push(lessThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.LessorOrEqual;
                    return result;
                } else if (operator === ComparisonOperator.Greater) {
                    const greaterThan = CatalogOverlayComponent.GetNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.Greater;
                    result.values.push(greaterThan);
                    return result;
                } else if (operator === ComparisonOperator.GreaterOrEqual) {
                    const greaterThanOrEqualTo = CatalogOverlayComponent.GetNumberFromFilter(filter);
                    result.values.push(greaterThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.GreaterOrEqual;
                    return result;
                } else if (operator === ComparisonOperator.RangeOpen) {
                    const fromTo = filter.split(ComparisonOperator.RangeOpen, 2);
                    result.values.push(Number(fromTo[0]));
                    result.values.push(Number(fromTo[1]));
                    result.operator = CARTA.ComparisonOperator.RangeOpen;
                    return result;
                } else if (operator === ComparisonOperator.RangeClosed) {
                    const betweenAnd = filter.split(ComparisonOperator.RangeClosed, 2);
                    result.values.push(Number(betweenAnd[0]));
                    result.values.push(Number(betweenAnd[1]));
                    result.operator = CARTA.ComparisonOperator.RangeClosed;
                    return result;
                }
            }
        }
        return result;
    }

    private resetSelectedPointIndices = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        profileStore.setSelectedPointIndices([], false);
        catalogWidgetStore.setCatalogTableAutoScroll(false);
        catalogWidgetStore.setShowSelectedData(false);
    };

    private handleFilterRequest = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        if (profileStore && appStore) {
            profileStore.updateTableStatus(false);
            profileStore.resetFilterRequestControlParams();
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(this.catalogFileId);

            let filter = profileStore.updateRequestDataSize;
            filter.imageBounds.xColumnName = catalogWidgetStore.xAxis;
            filter.imageBounds.yColumnName = catalogWidgetStore.yAxis;

            filter.fileId = profileStore.catalogInfo.fileId;
            filter.filterConfigs = this.getUserFilters();
            filter.columnIndices = profileStore.displayedColumnHeaders.map(v => v.columnIndex);
            appStore.sendCatalogFilter(filter);
        }
    };

    private updateSortRequest = (columnName: string, sortingType: CARTA.SortingType) => {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        if (profileStore && appStore) {
            profileStore.resetFilterRequestControlParams();
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(this.catalogFileId);

            let filter = profileStore.updateRequestDataSize;
            filter.sortColumn = columnName;
            filter.sortingType = sortingType;
            profileStore.setSortingInfo(columnName, sortingType);
            appStore.sendCatalogFilter(filter);
        }
    };

    private updateByInfiniteScroll = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const selectedOnly = catalogWidgetStore.showSelectedData;
        if (profileStore.loadingData === false && profileStore.updateMode === CatalogUpdateMode.TableUpdate && profileStore.shouldUpdateData && !selectedOnly) {
            profileStore.setUpdateMode(CatalogUpdateMode.TableUpdate);
            const filter = this.profileStore.updateRequestDataSize;
            filter.columnIndices = profileStore.displayedColumnHeaders.map(v => v.columnIndex);
            AppStore.Instance.sendCatalogFilter(filter);
            profileStore.setLoadingDataStatus(true);
        }
    };

    private handleResetClick = () => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        if (profileStore && catalogWidgetStore) {
            profileStore.resetCatalogFilterRequest();
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(this.catalogFileId);
            appStore.sendCatalogFilter(profileStore.catalogFilterRequest);
            catalogWidgetStore.resetMaps();
        }
    };

    private handlePlotClick = () => {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetStore = this.widgetStore;
        // init plot data
        switch (catalogWidgetStore.catalogPlotType) {
            case CatalogPlotType.ImageOverlay:
                profileStore.setUpdateMode(CatalogUpdateMode.ViewUpdate);
                const frame = appStore.getFrame(catalogStore.getFrameIdByCatalogId(this.catalogFileId));
                if (frame) {
                    const imageCoords = profileStore.get2DPlotData(catalogWidgetStore.xAxis, catalogWidgetStore.yAxis, profileStore.catalogData);
                    const wcs = frame.validWcs ? frame.wcsInfo : 0;
                    const catalogFileId = this.catalogFileId;
                    catalogStore.clearImageCoordsData(catalogFileId);
                    catalogStore.updateCatalogData(catalogFileId, imageCoords.wcsX, imageCoords.wcsY, wcs, imageCoords.xHeaderInfo.units, imageCoords.yHeaderInfo.units, profileStore.catalogCoordinateSystem.system);
                    profileStore.setSelectedPointIndices(profileStore.selectedPointIndices, false);
                    catalogWidgetStore.setCatalogTableAutoScroll(false);
                }
                if (profileStore.shouldUpdateData) {
                    profileStore.setUpdatingDataStream(true);
                    let catalogFilter = profileStore.updateRequestDataSize;
                    appStore.sendCatalogFilter(catalogFilter);
                }
                break;
            case CatalogPlotType.D2Scatter:
                const scatterProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: catalogWidgetStore.xAxis,
                    yColumnName: catalogWidgetStore.yAxis,
                    plotType: catalogWidgetStore.catalogPlotType
                };
                const scatterPlot = appStore.widgetsStore.createFloatingCatalogPlotWidget(scatterProps);
                catalogStore.setCatalogPlots(scatterPlot.widgetComponentId, this.catalogFileId, scatterPlot.widgetStoreId);
                break;
            case CatalogPlotType.Histogram:
                const historgramProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: catalogWidgetStore.xAxis,
                    plotType: catalogWidgetStore.catalogPlotType
                };
                const histogramPlot = appStore.widgetsStore.createFloatingCatalogPlotWidget(historgramProps);
                catalogStore.setCatalogPlots(histogramPlot.widgetComponentId, this.catalogFileId, histogramPlot.widgetStoreId);
                break;
            default:
                break;
        }
    };

    private handlePlotTypeChange = (plotType: CatalogPlotType) => {
        this.widgetStore.setCatalogPlotType(plotType);
    };

    // source selected in table
    private onCatalogTableDataSelected = (selectedDataIndices: number[]) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        if (!catalogWidgetStore.showSelectedData) {
            if (selectedDataIndices.length === 1) {
                const selectedPointIndexs = profileStore.selectedPointIndices;
                let highlighted = false;
                if (selectedPointIndexs.length === 1) {
                    highlighted = selectedPointIndexs.includes(selectedDataIndices[0]);
                }
                if (!highlighted) {
                    profileStore.setSelectedPointIndices(selectedDataIndices, true);
                    catalogWidgetStore.setCatalogTableAutoScroll(false);
                } else {
                    profileStore.setSelectedPointIndices([], false);
                    catalogWidgetStore.setCatalogTableAutoScroll(false);
                }
            } else {
                profileStore.setSelectedPointIndices(selectedDataIndices, true);
                catalogWidgetStore.setCatalogTableAutoScroll(false);
            }
        }
    };

    private renderFileIdPopOver = (fileId: number, itemProps: IItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        let text = `${fileId}: ${fileName}`;
        return <MenuItem key={fileId} text={text} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private renderPlotTypePopOver = (plotType: CatalogPlotType, itemProps: IItemRendererProps) => {
        return <MenuItem key={plotType} text={plotType} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
    };

    private onTableResize = (newSize: number) => {
        // update table if resizing happend
        const position = Math.floor((newSize / (this.height - 130)) * 100);
        if (position <= CatalogWidgetStore.MaxTableSeparatorPosition && position >= CatalogWidgetStore.MinTableSeparatorPosition) {
            this.widgetStore.setTableSeparatorPosition(`${position}%`);
            PreferenceStore.Instance.setPreference(PreferenceKeys.CATALOG_TABLE_SEPARATOR_POSITION, `${position}%`);
        }
        const profileStore = this.profileStore;
        if (profileStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, false);
        }
        if (profileStore && this.catalogTableRef) {
            this.updateTableSize(this.catalogTableRef, false);
        }
    };

    private renderSystemPopOver = (system: CatalogSystemType, itemProps: IItemRendererProps) => {
        const menuItem = <MenuItem key={system} text={this.profileStore.CoordinateSystemName.get(system)} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
        switch (system) {
            case CatalogSystemType.Pixel0:
                return (
                    <div key={system}>
                        <Tooltip2 position="auto-end" content={<small>PIX0: 0-based image coordinates</small>}>
                            {menuItem}
                        </Tooltip2>
                    </div>
                );
            case CatalogSystemType.Pixel1:
                return (
                    <div key={system}>
                        <Tooltip2 position="auto-end" content={<small>PIX1: 1-based image coordinates</small>}>
                            {menuItem}
                        </Tooltip2>
                    </div>
                );
            default:
                return menuItem;
        }
    };

    private shortcutoOnClick = (type: CatalogSettingsTabs) => {
        this.widgetStore.setSettingsTabId(type);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(CatalogOverlayComponent.WIDGET_CONFIG.title, this.props.id, CatalogOverlayComponent.WIDGET_CONFIG.type);
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
        const dataTableProps: FilterableTableComponentProps = {
            dataset: catalogTable.dataset,
            filter: profileStore.catalogControlHeader,
            columnHeaders: profileStore.displayedColumnHeaders,
            numVisibleRows: catalogTable.numVisibleRows,
            columnWidths: profileStore.tableColumnWidts,
            loadingCell: profileStore.loadingData,
            selectedDataIndex: profileStore.selectedPointIndices,
            showSelectedData: catalogWidgetStore.showSelectedData,
            updateTableRef: this.onCatalogDataTableRefUpdated,
            updateColumnFilter: profileStore.setColumnFilter,
            updateByInfiniteScroll: this.updateByInfiniteScroll,
            updateTableColumnWidth: profileStore.setTableColumnWidth,
            updateSelectedRow: this.onCatalogTableDataSelected,
            updateSortRequest: this.updateSortRequest,
            sortingInfo: profileStore.sortingInfo,
            disableSort: profileStore.loadOntoImage,
            tableHeaders: profileStore.catalogHeader
        };

        let startIndex = 0;
        if (profileStore.numVisibleRows) {
            startIndex = 1;
        }

        const catalogFileDataSize = profileStore.catalogInfo.dataSize;
        const maxRow = profileStore.maxRows;
        const tableVisibleRows = catalogTable.numVisibleRows;
        let info = `Showing ${startIndex} to ${tableVisibleRows} of total ${catalogFileDataSize} entries`;
        if (profileStore.hasFilter && isFinite(profileStore.filterDataSize)) {
            info = `Showing ${startIndex} to ${tableVisibleRows} of ${profileStore.filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
        }
        if (maxRow < catalogFileDataSize && maxRow > 0) {
            info = `Showing ${startIndex} to ${tableVisibleRows} of top ${maxRow} entries. Total ${catalogFileDataSize} entries`;
        }
        if (maxRow < catalogFileDataSize && maxRow > 0 && profileStore.hasFilter && isFinite(profileStore.filterDataSize)) {
            if (profileStore.filterDataSize >= maxRow) {
                info = `Showing ${startIndex} to ${tableVisibleRows} of top ${maxRow} entries. Total ${profileStore.filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
            } else {
                info = `Showing ${startIndex} to ${tableVisibleRows} of ${profileStore.filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
            }
        }
        const tableInfo = catalogFileDataSize ? (
            <tr>
                <td className="td-label">
                    <pre>{info}</pre>
                </td>
            </tr>
        ) : null;

        let catalogFileItems = [];
        catalogFileIds.forEach(value => {
            catalogFileItems.push(value);
        });
        this.catalogFileNames = CatalogStore.Instance.getCatalogFileNames(catalogFileIds);

        let systemOptions = [];
        profileStore.CoordinateSystemName.forEach((value, key) => {
            systemOptions.push(key);
        });

        const activeSystem = profileStore.CoordinateSystemName.get(profileStore.catalogCoordinateSystem.system);
        const isImageOverlay = catalogWidgetStore.catalogPlotType === CatalogPlotType.ImageOverlay;
        const isHistogram = catalogWidgetStore.catalogPlotType === CatalogPlotType.Histogram;
        const disable = profileStore.loadOntoImage;

        let footerDropdownClass = "footer-action-large";
        if (this.width <= 600) {
            footerDropdownClass = "footer-action-small";
        }

        const noResults = <MenuItem disabled={true} text="No results" />;

        return (
            <div className={"catalog-overlay"}>
                <div className={"catalog-overlay-filter-settings"}>
                    <FormGroup inline={true} label="File">
                        <Select
                            className="bp3-fill"
                            filterable={false}
                            items={catalogFileItems}
                            activeItem={this.catalogFileId}
                            onItemSelect={this.handleCatalogFileChange}
                            itemRenderer={this.renderFileIdPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={this.catalogFileId} rightIcon="double-caret-vertical" />
                        </Select>
                    </FormGroup>
                    <FormGroup className="catalog-system" disabled={!isImageOverlay} inline={true} label="System">
                        <Select
                            filterable={false}
                            items={systemOptions}
                            activeItem={profileStore.catalogCoordinateSystem.system}
                            onItemSelect={system => profileStore.setCatalogCoordinateSystem(system)}
                            itemRenderer={this.renderSystemPopOver}
                            disabled={!isImageOverlay}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={activeSystem} disabled={!isImageOverlay} rightIcon="double-caret-vertical" />
                        </Select>
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
                    onChange={this.onTableResize}
                >
                    <Pane className={"catalog-overlay-column-header-container"}>{this.createHeaderTable()}</Pane>
                    <Pane className={"catalog-overlay-data-container"}>
                        <FilterableTableComponent {...dataTableProps} />
                    </Pane>
                </SplitPane>
                <div className="bp3-dialog-footer">
                    <div className={"table-info"}>
                        <table className="info-display">
                            <tbody>{tableInfo}</tbody>
                        </table>
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
                                <Button className="bp3" text={catalogWidgetStore.catalogPlotType} rightIcon="double-caret-vertical" />
                            </Select>

                            <FormGroup className="catalog-axis" inline={true} label={this.xAxisLable} disabled={disable}>
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
                                    <Button className="catalog-axis-button" text={catalogWidgetStore.xAxis} disabled={disable} rightIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>

                            <FormGroup className="catalog-axis" inline={true} label={this.yAxisLable} disabled={isHistogram || disable}>
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
                                    <Button className="catalog-axis-button" text={catalogWidgetStore.yAxis} disabled={isHistogram || disable} rightIcon="double-caret-vertical" />
                                </Select>
                            </FormGroup>

                            <ClearableNumericInputComponent
                                className={"catalog-max-rows"}
                                label="Max Rows"
                                value={profileStore.maxRows}
                                onValueChanged={val => profileStore.setMaxRows(val)}
                                onValueCleared={() => profileStore.setMaxRows(profileStore.catalogInfo.dataSize)}
                                displayExponential={false}
                                disabled={disable}
                            />
                        </div>
                    </div>
                    <div className="bp3-dialog-footer">
                        <div className="bp3-dialog-footer-actions">
                            <AnchorButton intent={Intent.PRIMARY} text="Update" onClick={this.handleFilterRequest} disabled={disable || !profileStore.updateTableView} />
                            <AnchorButton intent={Intent.PRIMARY} text="Reset" onClick={this.handleResetClick} disabled={disable} />
                            <AnchorButton intent={Intent.PRIMARY} text="Close" onClick={this.handleFileCloseClick} disabled={disable} />
                            <AnchorButton intent={Intent.PRIMARY} text="Plot" onClick={this.handlePlotClick} disabled={!this.enablePlotButton} />
                        </div>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}

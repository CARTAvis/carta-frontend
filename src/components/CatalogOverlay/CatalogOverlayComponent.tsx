import * as React from "react";
import {Pane, SplitPane} from "react-split-pane";
import {AnchorButton, Button, ButtonGroup, Classes, FormGroup, HTMLTable, Intent, MenuItem, NonIdealState, PopoverPosition, Pre, Switch, Tooltip} from "@blueprintjs/core";
import {type ItemPredicate, type ItemRendererProps, Select} from "@blueprintjs/select";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import * as ScrollUtils from "@blueprintjs/table/lib/esm/common/internal/scrollUtils";
import {type CARTA} from "carta-protobuf";
import FuzzySearch from "fuzzy-search";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {ClearableNumericInputComponent, FilterableTableComponent, type FilterableTableComponentProps, ResizeDetector} from "components/Shared";
import {CatalogOverlay, CatalogPlotType, CatalogSettingsTabs, CatalogSystemType, HeaderTableColumnName, HelpType, ImageViewLayer, PreferenceKeys, RegionMode} from "enums";
import {AbstractCatalogProfileStore} from "models";
import {AppStore, CatalogDisplayStore, type CatalogOnlineQueryProfileStore, type CatalogProfileStore, CatalogStore, type DefaultWidgetConfig, PreferenceStore, type WidgetProps, WidgetsStore} from "stores";
import {type CatalogWidgetStore} from "stores/Widgets";
import {clamp, getCatalogDataTypeDisplayName, type ProcessedColumnData, toFixed} from "utilities";

import "./CatalogOverlayComponent.scss";

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {
    @observable private catalogTableRef: Table | undefined = undefined;
    @observable private height: number = 600;
    @observable private width: number = 720;

    @observable private isShowHeader: boolean = true;
    private prevPosition: number = 60;
    private static readonly ExpectedColumnCount: number = 5; // Name, Unit, Type, Display, Description
    private widgetId: string;
    private readonly disposers: IReactionDisposer[] = [];
    private catalogHeaderTableRef: Table | undefined = undefined;
    private catalogFileNames: Map<number, string>;

    public static get WidgetConfig(): DefaultWidgetConfig {
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

    @computed get catalogFileId(): number | undefined {
        return CatalogStore.Instance.widgetBindings.catalogOf(this.widgetId);
    }

    /** A plain lookup: the store is created when the component is, not when it is read. */
    @computed get widgetStore(): CatalogWidgetStore | undefined {
        return WidgetsStore.Instance.catalogWidgetStore(this.widgetId);
    }

    @computed get displayStore(): CatalogDisplayStore | undefined {
        const catalogFileId = this.catalogFileId;
        return catalogFileId !== undefined ? CatalogStore.Instance.getCatalogDisplayStore(catalogFileId) : undefined;
    }

    @computed get profileStore(): CatalogProfileStore | CatalogOnlineQueryProfileStore | undefined {
        const catalogFileId = this.catalogFileId;
        return catalogFileId !== undefined ? CatalogStore.Instance.catalogProfileStores.get(catalogFileId) : undefined;
    }

    @action handleCatalogFileChange = (fileId: number) => {
        CatalogStore.Instance.widgetBindings.show(this.widgetId, fileId);
    };

    @action handleFileCloseClick = () => {
        const catalogDisplayStore = this.displayStore;
        const catalogFileId = this.catalogFileId;
        if (catalogFileId !== undefined) {
            if (!catalogDisplayStore) {
                return;
            }
            CatalogStore.Instance.close(catalogFileId);
        }
    };

    // Overwrite scrollToRegion to avoid crashes when viewportRect is undefined during unpin.
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
        const catalogDisplayStore = this.displayStore;
        let dataset: Map<number, ProcessedColumnData> | undefined;
        let numVisibleRows = 0;
        if (profileStore && catalogDisplayStore) {
            dataset = profileStore.catalogData;
            numVisibleRows = profileStore.numVisibleRows;
            if (profileStore.regionSelected && catalogDisplayStore.isShowingSelectedData) {
                if (profileStore.isFileBasedCatalog) {
                    dataset = profileStore.selectedData;
                }
                numVisibleRows = profileStore.regionSelected;
            }
        }
        return {dataset, numVisibleRows};
    }

    @computed get isPlotButtonEnabled(): boolean {
        const profileStore = this.profileStore;
        const catalogDisplayStore = this.displayStore;
        const isEnabled = !profileStore?.isLoadingData && !profileStore?.isUpdatingDataStream && catalogDisplayStore?.xAxis !== CatalogOverlay.NONE;
        if (catalogDisplayStore?.catalogPlotType === CatalogPlotType.Histogram) {
            return isEnabled;
        } else {
            return catalogDisplayStore?.yAxis !== CatalogOverlay.NONE && isEnabled;
        }
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);
        this.widgetId = props.id;

        WidgetsStore.Instance.getCatalogWidgetStore(this.widgetId, CatalogStore.Instance.activeCatalogFiles[0]);
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
        const catalogDisplayStore = this.displayStore;
        this.height = height;
        this.width = width;

        // fixed bug from blueprintjs, only display 4 rows. catalog name missing (in PR #1104) fixed after package update.
        if (profileStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, this.props.docked);
        }
        if (profileStore && this.catalogTableRef && catalogDisplayStore) {
            this.updateTableSize(this.catalogTableRef, this.props.docked);
            if (profileStore.regionSelected && catalogDisplayStore.isCatalogTableAutoScrollEnabled && !catalogDisplayStore.isShowingSelectedData) {
                this.scrollToRegion(this.catalogTableRef, profileStore.autoScrollRowNumber);
            }
        }
    };

    private updateTableSize(ref: any, isDocked: boolean) {
        const viewportRect = ref.locator.getViewportRect();
        ref.updateViewportRect(viewportRect);
        // fixed bug for blueprint table, first column overlap with row index
        // trigger table update
        if (isDocked) {
            ref.scrollToRegion(Regions.column(0));
        }
    }

    private handleHeaderDisplayChange(changeEvent: any, columnName: string) {
        this.displayStore?.setColumnDisplayed(columnName, changeEvent.target.checked);
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
        const shouldDisplay = headerInfo?.display ?? false;
        const isDisabled = profileStore?.isLoadingData;
        return (
            <Cell className="header-table-cell" key={`cell_switch_${rowIndex}`}>
                <>
                    <Switch
                        className="cell-switch-button"
                        key={`cell_switch_button_${rowIndex}`}
                        disabled={isDisabled}
                        checked={shouldDisplay}
                        onChange={changeEvent => this.handleHeaderDisplayChange(changeEvent, columnName)}
                        data-testid={"catalog-header-table-switch-" + rowIndex}
                    />
                </>
            </Cell>
        );
    }

    private handleCatalogSystemChange(system: CatalogSystemType) {
        this.displayStore?.changeCoordinateSystem(system);
    }

    private renderColumnNamePopOver = (catalogName: string, itemProps: ItemRendererProps) => {
        const reason = this.displayStore?.axisColumnEligibility.get(catalogName)?.reason;
        return <MenuItem key={catalogName} text={catalogName} label={reason ? "?" : undefined} title={reason} onClick={itemProps.handleClick} />;
    };

    private filterColumn: ItemPredicate<string> = (query: string, columnName: string) => {
        const fileSearcher = new FuzzySearch([columnName]);
        return fileSearcher.search(query).length > 0;
    };

    private renderButtonColumns(columnName: HeaderTableColumnName, headerNames: Array<string>) {
        switch (columnName) {
            case HeaderTableColumnName.Display:
                return <Column key={columnName} name={columnName} cellRenderer={rowIndex => this.renderSwitchButtonCell(rowIndex, headerNames[rowIndex])} />;
            default:
                return <Column key={columnName} name={columnName} />;
        }
    }

    private createHeaderTable() {
        const profileStore = this.profileStore;
        const displayStore = this.displayStore;
        if (!profileStore || !displayStore) {
            return null;
        }

        const tableColumns: React.ReactElement<React.ComponentProps<typeof Column>>[] = [];
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
            types.push(getCatalogDataTypeDisplayName(header.dataType));
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
        let columnWidths = this.widgetStore?.headerTableColumnWidths;
        if (!columnWidths || columnWidths.length !== expectedColumnCount) {
            columnWidths = new Array(expectedColumnCount).fill(undefined);
        }

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
                columnWidths={columnWidths}
                onColumnWidthChanged={this.updateHeaderTableColumnSize}
                enableRowResizing={false}
                cellRendererDependencies={[headerDisplays, profileStore.isLoadingData]} // trigger re-render on controlHeader change
            >
                {tableColumns}
            </Table>
        );
    }

    private updateHeaderTableColumnSize = (index: number, size: number) => {
        this.widgetStore?.setHeaderTableColumnWidth(index, size);
    };

    private handleFilterRequest = () => {
        if (this.catalogFileId !== undefined) {
            CatalogStore.Instance.requestFilteredRows(this.catalogFileId);
        }
    };

    private updateSortRequest = (columnName: string, sortingType: CARTA.SortingType | null) => {
        if (this.catalogFileId !== undefined) {
            CatalogStore.Instance.requestSortedRows(this.catalogFileId, columnName, sortingType);
        }
    };

    private updateByInfiniteScroll = () => {
        if (this.catalogFileId !== undefined) {
            CatalogStore.Instance.requestMoreRows(this.catalogFileId);
        }
    };

    private handleResetClick = () => {
        const catalogFileId = this.catalogFileId;
        if (!this.profileStore || !this.displayStore || catalogFileId === undefined) {
            return;
        }
        const appStore = AppStore.Instance;
        const catalogStore = CatalogStore.Instance;
        const frame = catalogStore.frameOf(catalogFileId);
        appStore.updateActiveLayer(ImageViewLayer.RegionMoving);
        frame?.regionSet.setMode(RegionMode.MOVING);
        catalogStore.resetCatalogRows(catalogFileId);
    };

    private handlePlotClick = () => {
        const profileStore = this.profileStore;
        const catalogStore = CatalogStore.Instance;
        const catalogDisplayStore = this.displayStore;
        const catalogFileId = this.catalogFileId;

        if (!profileStore || !catalogDisplayStore || catalogFileId === undefined) {
            return;
        }

        // init plot data
        switch (catalogDisplayStore.catalogPlotType) {
            case CatalogPlotType.ImageOverlay:
                catalogStore.plotImageOverlay(catalogFileId);
                break;
            case CatalogPlotType.D2Scatter:
                catalogStore.widgetBindings.openPlot(catalogFileId, {xColumnName: catalogDisplayStore.xAxis, yColumnName: catalogDisplayStore.yAxis, plotType: catalogDisplayStore.catalogPlotType});
                break;
            case CatalogPlotType.Histogram:
                catalogStore.widgetBindings.openPlot(catalogFileId, {xColumnName: catalogDisplayStore.xAxis, plotType: catalogDisplayStore.catalogPlotType});
                break;
            default:
                break;
        }
    };

    private handlePlotTypeChange = (plotType: CatalogPlotType) => {
        this.displayStore?.changePlotType(plotType);
    };

    // source selected in table
    private onCatalogTableDataSelected = (selectedDataIndices: number[]) => {
        const profileStore = this.profileStore;
        const catalogDisplayStore = this.displayStore;
        if (!catalogDisplayStore?.isShowingSelectedData) {
            if (selectedDataIndices.length === 1) {
                const selectedPointIndexs = profileStore?.selectedPointIndices;
                let isHighlighted = false;
                if (selectedPointIndexs?.length === 1) {
                    isHighlighted = selectedPointIndexs.includes(selectedDataIndices[0]);
                }
                if (!isHighlighted) {
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
        const catalogDisplayStore = this.displayStore;
        const profileStore = this.profileStore;
        if (!catalogDisplayStore || !profileStore || catalogDisplayStore.catalogPlotType !== CatalogPlotType.ImageOverlay || !catalogDisplayStore.hasPlottedImageOverlay) {
            return false;
        }

        const shouldPlotMoreRows = catalogDisplayStore.plottedImageOverlayMaxRows !== undefined && profileStore.maxRows > catalogDisplayStore.plottedImageOverlayMaxRows;
        return (
            catalogDisplayStore.plottedImageOverlayXAxis !== catalogDisplayStore.xAxis ||
            catalogDisplayStore.plottedImageOverlayYAxis !== catalogDisplayStore.yAxis ||
            catalogDisplayStore.plottedImageOverlaySystem !== profileStore.catalogCoordinateSystem.system ||
            shouldPlotMoreRows
        );
    }

    @action private handleSplitChange = (sizes: number[]) => {
        const newSize = sizes[1]; // second pane (data table) size
        // 130 is from 132, the height of widget excluding the header and table, subtracting 2 for the split bar width(?)
        const position = clamp((newSize / (this.height - 130)) * 100, CatalogDisplayStore.MIN_TABLE_SEPARATOR_POSITION, CatalogDisplayStore.MAX_TABLE_SEPARATOR_POSITION);
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
        const position = this.widgetStore?.tableSeparatorPosition !== "100%" ? 100 : this.prevPosition;
        this.isShowHeader = position === 100 ? false : true;
        this.widgetStore?.setTableSeparatorPosition(`${position}%`);
    };

    private renderSystemPopOver = (system: CatalogSystemType, itemProps: ItemRendererProps) => {
        const menuItem = <MenuItem key={system} text={AbstractCatalogProfileStore.COORDINATE_SYSTEM_NAME.get(system)} onClick={itemProps.handleClick} active={itemProps.modifiers.active} />;
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
        this.widgetStore?.setSettingsTab(this.catalogFileId, type);
        this.displayStore?.setSizeAxisTab(CatalogSettingsTabs.SIZE_MAJOR);
        AppStore.Instance.widgetsStore.createFloatingSettingsWidget(CatalogOverlayComponent.WidgetConfig.title ?? "", this.widgetId, CatalogOverlayComponent.WidgetConfig.type);
    };

    private onCompleteRender = () => {
        const profileStore = this.profileStore;
        const displayStore = this.displayStore;
        if (profileStore?.regionSelected) {
            if (displayStore?.isShowingSelectedData) {
                // if the length of selected source is 4, only the 4th row displayed. Auto scroll to top fixed it (bug related to blueprintjs table).
                this.scrollToRegion(this.catalogTableRef, Regions.row(0));
            } else {
                if (displayStore?.isCatalogTableAutoScrollEnabled) {
                    this.scrollToRegion(this.catalogTableRef, profileStore.autoScrollRowNumber);
                    displayStore.setCatalogTableAutoScroll(false);
                }
            }
        }
    };

    public render() {
        const catalogDisplayStore = this.displayStore;
        const profileStore = this.profileStore;
        const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;

        if (!profileStore || catalogFileIds === undefined || catalogFileIds?.length === 0 || !catalogDisplayStore) {
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
            isLoadingCell: profileStore.isLoadingData,
            selectedDataIndex: profileStore.selectedPointIndices,
            shouldShowSelectedData: catalogDisplayStore.isShowingSelectedData,
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
            shouldDisableSort: profileStore.isLoadingOntoImage,
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
        AbstractCatalogProfileStore.COORDINATE_SYSTEM_NAME.forEach((value, key) => {
            systemOptions.push(key);
        });

        const activeSystem = AbstractCatalogProfileStore.COORDINATE_SYSTEM_NAME.get(profileStore.catalogCoordinateSystem.system);
        const isImageOverlay = catalogDisplayStore.catalogPlotType === CatalogPlotType.ImageOverlay;
        const isHistogram = catalogDisplayStore.catalogPlotType === CatalogPlotType.Histogram;
        const isImageOverlaySelectionDirty = this.isImageOverlaySelectionDirty;
        const plotButtonText = isImageOverlay && isImageOverlaySelectionDirty ? "Update plot" : "Plot";
        const plotButtonIntent = isImageOverlay && isImageOverlaySelectionDirty ? Intent.DANGER : Intent.PRIMARY;
        const isOverlayDisabled = profileStore.isLoadingOntoImage;

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
                                <Button text={this.catalogFileId} endIcon="double-caret-vertical" data-testid="catalog-file-dropdown" />
                            </Select>
                        </FormGroup>
                        <FormGroup className="catalog-system" disabled={!isImageOverlay} inline={true} label="System">
                            <Select
                                filterable={false}
                                items={systemOptions}
                                activeItem={profileStore.catalogCoordinateSystem.system}
                                onItemSelect={system => this.handleCatalogSystemChange(system as CatalogSystemType)}
                                itemRenderer={this.renderSystemPopOver}
                                disabled={!isImageOverlay}
                                popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                            >
                                <Button text={activeSystem} disabled={!isImageOverlay} endIcon="double-caret-vertical" data-testid="catalog-system-dropdown" />
                            </Select>
                        </FormGroup>
                        <FormGroup inline={true} label="Show header">
                            <Switch checked={this.isShowHeader} onChange={this.handleHideHeader} />
                        </FormGroup>

                        <ButtonGroup className="catalog-map-buttons">
                            <AnchorButton data-testid="catalog-size-button" onClick={() => this.shortcutoOnClick(CatalogSettingsTabs.SIZE)}>
                                Size
                            </AnchorButton>
                            <AnchorButton data-testid="catalog-color-button" onClick={() => this.shortcutoOnClick(CatalogSettingsTabs.COLOR)}>
                                Color
                            </AnchorButton>
                            <AnchorButton data-testid="catalog-orientation-button" onClick={() => this.shortcutoOnClick(CatalogSettingsTabs.ORIENTATION)}>
                                Orientation
                            </AnchorButton>
                        </ButtonGroup>
                    </div>
                    <SplitPane className="catalog-table" direction="vertical" onResizeEnd={this.handleSplitChange}>
                        <Pane className={"catalog-overlay-column-header-container"}>{this.createHeaderTable()}</Pane>
                        <Pane
                            className={"catalog-overlay-data-container"}
                            minSize={`${CatalogDisplayStore.MIN_TABLE_SEPARATOR_POSITION}%`}
                            maxSize={`${CatalogDisplayStore.MAX_TABLE_SEPARATOR_POSITION}%`}
                            size={this.widgetStore?.tableSeparatorPosition}
                        >
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
                                    activeItem={catalogDisplayStore.catalogPlotType}
                                    onItemSelect={this.handlePlotTypeChange}
                                    itemRenderer={this.renderPlotTypePopOver}
                                    popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                >
                                    <Button className="bp3" text={catalogDisplayStore.catalogPlotType} endIcon="double-caret-vertical" data-testid="catalog-rendering-type-dropdown" />
                                </Select>

                                <FormGroup className="catalog-axis" inline={true} label={catalogDisplayStore.xAxisLabel} disabled={isOverlayDisabled}>
                                    <Select
                                        className="catalog-axis-select"
                                        items={catalogDisplayStore.xAxisOptions}
                                        activeItem={null}
                                        onItemSelect={columnName => catalogDisplayStore.setxAxis(columnName)}
                                        itemRenderer={this.renderColumnNamePopOver}
                                        disabled={isOverlayDisabled}
                                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                        filterable={true}
                                        noResults={noResults}
                                        itemPredicate={this.filterColumn}
                                        resetOnSelect={true}
                                    >
                                        <Button className="catalog-axis-button" text={catalogDisplayStore.xAxis} disabled={isOverlayDisabled} endIcon="double-caret-vertical" data-testid="catalog-rendering-column-x-dropdown" />
                                    </Select>
                                </FormGroup>

                                <FormGroup className="catalog-axis" inline={true} label={catalogDisplayStore.yAxisLabel} disabled={isHistogram || isOverlayDisabled}>
                                    <Select
                                        className="catalog-axis-select"
                                        items={catalogDisplayStore.yAxisOptions}
                                        activeItem={null}
                                        onItemSelect={columnName => catalogDisplayStore.setyAxis(columnName)}
                                        itemRenderer={this.renderColumnNamePopOver}
                                        disabled={isHistogram || isOverlayDisabled}
                                        popoverProps={{popoverClassName: "catalog-select", minimal: true, position: PopoverPosition.AUTO_END}}
                                        filterable={true}
                                        noResults={noResults}
                                        itemPredicate={this.filterColumn}
                                        resetOnSelect={true}
                                    >
                                        <Button
                                            className="catalog-axis-button"
                                            text={catalogDisplayStore.yAxis}
                                            disabled={isHistogram || isOverlayDisabled}
                                            endIcon="double-caret-vertical"
                                            data-testid="catalog-rendering-column-y-dropdown"
                                        />
                                    </Select>
                                </FormGroup>

                                <ClearableNumericInputComponent
                                    className={"catalog-max-rows"}
                                    label="Max rows"
                                    value={profileStore.maxRows}
                                    onValueChanged={val => profileStore.setMaxRows(val)}
                                    onValueCleared={() => profileStore.setMaxRows(profileStore.catalogInfo.dataSize)}
                                    displayExponential={false}
                                    disabled={isOverlayDisabled || !profileStore.isFileBasedCatalog}
                                />
                            </div>
                        </div>
                        <div className={Classes.DIALOG_FOOTER}>
                            <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                                <AnchorButton
                                    intent={Intent.SUCCESS}
                                    text="Apply filter"
                                    onClick={this.handleFilterRequest}
                                    disabled={isOverlayDisabled || !profileStore.shouldUpdateTableView || !profileStore.hasFilter}
                                    data-testid="catalog-filter-button"
                                />
                                <AnchorButton intent={Intent.WARNING} text="Reset filter" onClick={this.handleResetClick} disabled={isOverlayDisabled} data-testid="catalog-reset-button" />
                                <AnchorButton text="Close catalog" onClick={this.handleFileCloseClick} disabled={isOverlayDisabled} data-testid="catalog-close-button" />
                                <AnchorButton intent={plotButtonIntent} text={plotButtonText} onClick={this.handlePlotClick} disabled={!this.isPlotButtonEnabled} data-testid="catalog-plot-button" />
                            </div>
                        </div>
                    </div>
                </div>
            </ResizeDetector>
        );
    }
}

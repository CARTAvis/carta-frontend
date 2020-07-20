import * as React from "react";
import {action, autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, FormGroup, Intent, NonIdealState, Switch, Tooltip, MenuItem, PopoverPosition, Button} from "@blueprintjs/core";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import * as ScrollUtils from "../../../node_modules/@blueprintjs/table/lib/esm/common/internal/scrollUtils";
import {Select, IItemRendererProps} from "@blueprintjs/select";
import ReactResizeDetector from "react-resize-detector";
import SplitPane, { Pane } from "react-split-pane";
import {CARTA} from "carta-protobuf";
import {TableComponent, TableComponentProps, TableType, ClearableNumericInputComponent} from "components/Shared";
import {CatalogOverlayPlotSettingsComponent} from "./CatalogOverlayPlotSettingsComponent/CatalogOverlayPlotSettingsComponent";
import {AppStore, HelpType, WidgetConfig, WidgetProps, WidgetsStore} from "stores";
import {CatalogOverlay, CatalogCoordinate, CatalogOverlayWidgetStore, CatalogPlotType, CatalogSubplotWidgetStoreProps, CatalogUpdateMode, CatalogSystemType} from "stores/widgets";
import {toFixed} from "utilities";
import {ProcessedColumnData} from "../../models";
import "./CatalogOverlayComponent.css";

enum HeaderTableColumnName {
    Name = "Name",
    Unit = "Unit",
    Display = "Display",
    RepresentAs = "Represent As",
    Description = "Description"
}

// order matters, since ... and .. both having .. (same for < and <=, > and >=)
enum ComparisonOperator {
   Equal = "==",
   NotEqual = "!=",
   LessorOrEqual = "<=",
   Lesser = "<",
   GreaterOrEqual = ">=",
   Greater = ">",
   RangeClosed = "...",
   RangeOpen = ".."
}

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {
    @observable widgetId: string;
    @observable catalogFileId: number;
    @observable catalogTableRef: Table = undefined;

    private catalogHeaderTableRef: Table = undefined;
    private static readonly DataTypeRepresentationMap = new Map<CARTA.ColumnType, Array<CatalogCoordinate>>([
        [CARTA.ColumnType.Bool, [CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Double, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Float, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Int8, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Uint8, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Int16, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Uint8, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Int32, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Uint32, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Int64, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.Uint64, [CatalogCoordinate.X, CatalogCoordinate.Y, CatalogCoordinate.NONE]],
        [CARTA.ColumnType.String, [CatalogCoordinate.NONE]],
        [CARTA.ColumnType.UnsupportedType, [CatalogCoordinate.NONE]]
    ]);

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "catalog-overlay",
            type: "catalog-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 740,
            defaultHeight: 350,
            title: "Catalog Overlay",
            isCloseable: true,
            helpType: HelpType.CATALOG_OVERLAY,
            componentId: "catalog-overlay-component"
        };
    }

    @computed get widgetStore(): CatalogOverlayWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        let widgetStore = widgetsStore.catalogOverlayWidgets.get(this.widgetId);
        let widgetId = this.matchesSelectedCatalogFile;
        if (widgetId) {
            widgetStore = widgetsStore.catalogOverlayWidgets.get(widgetId);
        } else {
            widgetStore = widgetsStore.catalogOverlayWidgets.values().next().value;
        }
        return widgetStore;
    }

    @computed get matchesSelectedRegion() {
        const frame = AppStore.Instance.activeFrame;
        if (frame) {
            const widgetRegion = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId);
            if (frame.regionSet.selectedRegion && frame.regionSet.selectedRegion.regionId !== 0) {
                return widgetRegion === frame.regionSet.selectedRegion.regionId;
            }
        }
        return false;
    }

    @computed get matchesSelectedCatalogFile(): string {
        let widgetId = undefined;
        AppStore.Instance.catalogs.forEach((value, key) => {
            if (value === this.catalogFileId) {
                widgetId = key;
            }
        });
        return widgetId;
    }

    @action handleCatalogFileChange = (fileId: number) => {
        AppStore.Instance.catalogProfiles.set(this.props.id, fileId);
        this.widgetId = this.matchesSelectedCatalogFile;
    }

    @action handleFileCloseClick = () => {
        const appStore = AppStore.Instance;
        appStore.removeCatalog(this.widgetId, this.props.id);
    }

    // overwrite scrollToRegion to avoid crush when _b is undefined (user pin action)
    scrollToRegion = (ref, region) => {
        var _a = ref.state, numFrozenColumns = _a?.numFrozenColumnsClamped, numFrozenRows = _a?.numFrozenRowsClamped;
        var _b = ref.state.viewportRect;
        if (!_b) {
            _b = ref.locator.getViewportRect();
        } 
        var currScrollLeft = _b?.left, currScrollTop = _b?.top;
        var _c = ScrollUtils.getScrollPositionForRegion(
            region, 
            currScrollLeft, 
            currScrollTop, 
            ref.grid.getCumulativeWidthBefore, 
            ref.grid.getCumulativeHeightBefore, 
            numFrozenRows, numFrozenColumns
        ), scrollLeft = _c.scrollLeft, scrollTop = _c.scrollTop;
        var correctedScrollLeft = ref.shouldDisableHorizontalScroll() ? 0 : scrollLeft;
        var correctedScrollTop = ref.shouldDisableVerticalScroll() ? 0 : scrollTop;
        ref.quadrantStackInstance.scrollToPosition(correctedScrollLeft, correctedScrollTop);
    };

    @computed get catalogDataInfo(): {dataset: Map<number, ProcessedColumnData>, numVisibleRows: number} {
        const widgetStore = this.widgetStore;
        let dataset;
        let numVisibleRows = 0;
        if (widgetStore) {
            dataset = widgetStore.catalogData;
            numVisibleRows = widgetStore.numVisibleRows;
            if (widgetStore.regionSelected) {
                if (widgetStore.showSelectedData) {
                    dataset = widgetStore.selectedData;
                    numVisibleRows = widgetStore.regionSelected;
                    // if the length of selected source is 4, only the 4th row displayed. Auto scroll to top fixed it (bug related to blueprintjs table).
                    if (this.catalogTableRef) {
                        this.scrollToRegion(this.catalogTableRef, Regions.row(0));   
                    }  
                } else {
                    if (this.catalogTableRef && widgetStore.catalogTableAutoScroll) {
                        this.scrollToRegion(this.catalogTableRef, widgetStore.autoScrollRowNumber);  
                    }
                }
            } 
        }
        return {dataset, numVisibleRows};
    }

    constructor(props: WidgetProps) {
        super(props);
        this.widgetId = "catalog-overlay-0";
        if (!AppStore.Instance.catalogProfiles.has(this.props.id)) {
            AppStore.Instance.catalogProfiles.set(this.props.id, 1);
        }

        autorun(() => {
            if (this.widgetStore) {
                const appStore = AppStore.Instance;
                const frame = appStore.activeFrame;
                this.catalogFileId = appStore.catalogProfiles.get(this.props.id);
                this.widgetId = this.matchesSelectedCatalogFile;
                let progressString = "";
                const fileName = this.widgetStore.catalogInfo.fileInfo.name || "";
                const progress = this.widgetStore.progress;
                if (progress && isFinite(progress) && progress < 1) {
                    progressString = `[${toFixed(progress * 100)}% complete]`;
                }
                if (frame) {
                    const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                    appStore.widgetsStore.setWidgetComponentTitle(this.props.id, `Catalog ${fileName} : ${regionString} ${selectedString} ${progressString}`);
                }
            } else {
                WidgetsStore.Instance.setWidgetComponentTitle(this.props.id, `Catalog : Cursor`);
            }
        });
    }

    onCatalogDataTableRefUpdated = (ref) => {
        this.catalogTableRef = ref;
    }

    onControlHeaderTableRef = (ref) => {
        this.catalogHeaderTableRef = ref;
    }

    onResize = (width: number, height: number) => {
        const widgetStore = this.widgetStore;
        // fixed bug from blueprintjs, only display 4 rows.
        if (widgetStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, this.props.docked); 
        }
        if (widgetStore && this.catalogTableRef) {
            this.updateTableSize(this.catalogTableRef, this.props.docked);
            if (widgetStore.regionSelected && widgetStore.catalogTableAutoScroll && !widgetStore.showSelectedData) {
                this.scrollToRegion(this.catalogTableRef, widgetStore.autoScrollRowNumber);
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
        const val = changeEvent.target.checked;
        const header = this.widgetStore.catalogControlHeader.get(columnName);
        this.widgetStore.setHeaderDisplay(val, columnName);
        if (val === true || (header.filter !== "" && val === false)) {
            this.handleFilterRequest();   
        }
        if (header.representAs !== CatalogCoordinate.NONE) {
            const option = {
                coordinate: CatalogCoordinate.NONE, 
                coordinateType: CatalogOverlay.NONE
            };
            this.widgetStore.setHeaderRepresentation(option, columnName);
        }   
    }

    private handleHeaderRepresentationChange(option: {coordinate: CatalogCoordinate, coordinateType: CatalogOverlay}, columnName: string) {
        this.widgetStore.setHeaderRepresentation(option, columnName);
    }

    private renderDataColumn(columnName: string, coloumnData: any) {
        return (
            <Column 
                key={columnName} 
                name={columnName} 
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell className="header-table-cell" key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>{coloumnData[rowIndex]}</Cell>
            )}
            />
        );
    }

    private renderSwitchButtonCell(rowIndex: number, columnName: string) {
        const display = this.widgetStore.catalogControlHeader.get(columnName).display;
        let disable = this.widgetStore.loadingData;
        const progress = this.widgetStore.progress;
        if (progress === 1 || progress === undefined) {
            disable = false;
        }
        return (
            <Cell className="header-table-cell" key={`cell_switch_${rowIndex}`}>
                <React.Fragment>
                    <Switch className="cell-switch-button" key={`cell_switch_button_${rowIndex}`} disabled={disable} checked={display} onChange={changeEvent => this.handleHeaderDisplayChange(changeEvent, columnName)}/>
                </React.Fragment>
            </Cell>
        );
    }

    private renderRepresentasPopOver = (option: {coordinate: CatalogCoordinate, coordinateType: CatalogOverlay}, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={option.coordinate}
                text={option.coordinateType}
                onClick={itemProps.handleClick}
            />
        );
    }

    private renderDropDownMenuCell(rowIndex: number, columnName: string) {
        const widgetStore = this.widgetStore;
        const controlHeader = this.widgetStore.catalogControlHeader.get(columnName);
        const dataType = widgetStore.catalogHeader[controlHeader.dataIndex].dataType;
        const supportedRepresentations = CatalogOverlayComponent.DataTypeRepresentationMap.get(dataType);
        const disabled = !controlHeader.display;
        let options = [];
        let activeSystemCoords;
        switch (widgetStore.catalogPlotType) {
            case CatalogPlotType.D2Scatter:
                activeSystemCoords = {
                    x: CatalogOverlay.X,
                    y: CatalogOverlay.Y
                };
                break;
            case CatalogPlotType.Histogram: 
                activeSystemCoords = {
                    x: CatalogOverlay.X,
                    y: CatalogOverlay.NONE
                };
                break;
            default:
                activeSystemCoords = widgetStore.activedSystem;
                break;
        }

        supportedRepresentations.forEach((representation) => {
            let option = {};
            if (representation === CatalogCoordinate.X) {
                option = {
                    coordinate: CatalogCoordinate.X, 
                    coordinateType: activeSystemCoords.x
                };
                options.push(option);
            }
            if (representation === CatalogCoordinate.Y) {
                option = {
                    coordinate: CatalogCoordinate.Y, 
                    coordinateType: activeSystemCoords.y
                };
                if (widgetStore.catalogPlotType !== CatalogPlotType.Histogram) {
                    options.push(option);
                }
            } 
            if (representation === CatalogCoordinate.NONE) {
                option = {
                    coordinate: CatalogCoordinate.NONE, 
                    coordinateType: CatalogOverlay.NONE
                };
                options.push(option);
            }      
        });

        let activeItem;
        switch (columnName) {
            case widgetStore.xColumnRepresentation:
                activeItem = activeSystemCoords.x;
                break;
            case widgetStore.yColumnRepresentation:
                activeItem = activeSystemCoords.y;
                break;
            default:
                activeItem = CatalogOverlay.NONE;
                break;
        }

        return (
            <Cell className="cell-dropdown-menu" key={`cell_drop_down_${rowIndex}`}>
                <Select
                    filterable={false}
                    items={options}
                    activeItem={null}
                    onItemSelect={(option) => this.handleHeaderRepresentationChange(option, columnName)}
                    itemRenderer={this.renderRepresentasPopOver}
                    disabled={disabled}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                >
                    <Button className="bp3-minimal catalog-represent-as-select-button" text={activeItem} disabled={disabled} rightIcon="double-caret-vertical"/>
                </Select>
            </Cell>
        );
    }

    private renderButtonColumns(columnName: HeaderTableColumnName, headerNames: Array<string>) {
        switch (columnName) {
            case HeaderTableColumnName.Display:
                return <Column  key={columnName} name={columnName} cellRenderer={rowIndex => this.renderSwitchButtonCell(rowIndex, headerNames[rowIndex])}/>;
            case HeaderTableColumnName.RepresentAs:
                return <Column  key={columnName} name={columnName} cellRenderer={rowIndex => this.renderDropDownMenuCell(rowIndex, headerNames[rowIndex])}/>;
            default:
                return <Column  key={columnName} name={columnName}/>;
        }
    }

    private createHeaderTable() {
        const tableColumns = [];
        const headerNames = [];
        const headerDescriptions = [];
        const units = [];
        const headerDataset = this.widgetStore.catalogHeader;
        const numResultsRows = headerDataset.length;
        for (let index = 0; index < headerDataset.length; index++) {
            const header = headerDataset[index];
            headerNames.push(header.name);
            headerDescriptions.push(header.description);
            units.push(header.units);
        }
        const columnName = this.renderDataColumn(HeaderTableColumnName.Name, headerNames);
        tableColumns.push(columnName);
        const columnUnit = this.renderDataColumn(HeaderTableColumnName.Unit, units);
        tableColumns.push(columnUnit);
        const columnDisplaySwitch = this.renderButtonColumns(HeaderTableColumnName.Display, headerNames);
        tableColumns.push(columnDisplaySwitch);
        const columnRepresentation = this.renderButtonColumns(HeaderTableColumnName.RepresentAs, headerNames);
        tableColumns.push(columnRepresentation);
        const columnDescription = this.renderDataColumn(HeaderTableColumnName.Description, headerDescriptions);
        tableColumns.push(columnDescription);

        return (
            <Table 
                ref={(ref) => this.onControlHeaderTableRef(ref)}
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
    }

    private getUserFilters(): CARTA.FilterConfig[] {
        let userFilters: CARTA.FilterConfig[] = [];
        const filters = this.widgetStore.catalogControlHeader;
        filters.forEach((value, key) => {
            if (value.filter !== undefined && value.display) {
                let filter = new CARTA.FilterConfig();
                const dataType = this.widgetStore.catalogHeader[value.dataIndex].dataType;
                filter.columnName = key;
                if (dataType === CARTA.ColumnType.String) {
                    filter.subString = value.filter;
                    userFilters.push(filter);
                } else {
                    const result = this.getComparisonOperatorAndValue(value.filter);
                    if (result.operator !== -1 && result.values.length > 0) {
                        filter.comparisonOperator = result.operator;
                        if (result.values.length > 1) {
                            filter.value =  Math.min(result.values[0], result.values[1]);
                            filter.secondaryValue =  Math.max(result.values[0], result.values[1]);
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

    private getNumberFromFilter(filterString: string): number {
        return Number(filterString.replace(/[^0-9.+-\.]+/g, ""));
    }

    private getComparisonOperatorAndValue(filterString: string): {operator: CARTA.ComparisonOperator, values: number[]} {
        const filter = filterString.replace(/\s/g, "");
        let result = {operator: -1, values: []};
        // order matters, since ... and .. both include .. (same for < and <=, > and >=)
        for (const key of Object.keys(ComparisonOperator)) {
            const operator = ComparisonOperator[key];
            const found = filter.includes(operator);
            if (found) {
                if (operator === ComparisonOperator.Equal) {
                    const equalTo = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.Equal;
                    result.values.push(equalTo);
                    return result;
                } else if (operator === ComparisonOperator.NotEqual) {
                    const notEqualTo = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.NotEqual;
                    result.values.push(notEqualTo);
                    return result;
                } else if (operator === ComparisonOperator.Lesser) {
                    const lessThan = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.Lesser;
                    result.values.push(lessThan);
                    return result;
                } else if (operator === ComparisonOperator.LessorOrEqual) {
                    const lessThanOrEqualTo = this.getNumberFromFilter(filter);
                    result.values.push(lessThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.LessorOrEqual;
                    return result;
                } else if (operator === ComparisonOperator.Greater) {
                    const greaterThan = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.Greater;
                    result.values.push(greaterThan);
                    return result;
                } else if (operator === ComparisonOperator.GreaterOrEqual) {
                    const greaterThanOrEqualTo = this.getNumberFromFilter(filter);
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

    private handleFilterRequest = () => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        if (widgetStore && appStore) {
            widgetStore.updateTableStatus(false);
            widgetStore.resetFilterRequestControlParams();
            widgetStore.resetSelectedPointIndices();
            appStore.catalogStore.clearData(this.widgetId);

            let filter = widgetStore.updateRequestDataSize;
            // Todo filter by region Id and Imageview boundary
            filter.imageBounds.xColumnName = widgetStore.xColumnRepresentation;
            filter.imageBounds.yColumnName = widgetStore.yColumnRepresentation;
            
            filter.fileId = widgetStore.catalogInfo.fileId;
            filter.filterConfigs = this.getUserFilters();
            filter.columnIndices = widgetStore.displayedColumnHeaders.map(v => v.columnIndex);
            appStore.sendCatalogFilter(filter);
        }
    };

    private updateSortRequest = (columnName: string, sortingType: CARTA.SortingType) => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        if (widgetStore && appStore) {
            widgetStore.resetFilterRequestControlParams();
            widgetStore.resetSelectedPointIndices();
            appStore.catalogStore.clearData(this.widgetId);

            let filter = widgetStore.updateRequestDataSize;
            filter.sortColumn = columnName;
            filter.sortingType = sortingType;
            widgetStore.setSortingInfo(columnName, sortingType);
            appStore.sendCatalogFilter(filter);
        }
    }

    private updateByInfiniteScroll = () => {
        const widgetStore = this.widgetStore;
        const selectedMode = widgetStore.showSelectedData;
        if (widgetStore.loadingData === false && widgetStore.updateMode === CatalogUpdateMode.TableUpdate && widgetStore.shouldUpdateData && !selectedMode) {
            widgetStore.setUpdateMode(CatalogUpdateMode.TableUpdate);
            const filter = this.widgetStore.updateRequestDataSize;
            filter.columnIndices = widgetStore.displayedColumnHeaders.map(v => v.columnIndex);
            AppStore.Instance.sendCatalogFilter(filter);
            widgetStore.setLoadingDataStatus(true);
        }
    }

    private handleResetClick = () => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        if (widgetStore) {
            widgetStore.resetCatalogFilterRequest();
            widgetStore.resetSelectedPointIndices();
            appStore.catalogStore.clearData(this.widgetId);
            appStore.sendCatalogFilter(widgetStore.catalogFilterRequest); 
        }
    }

    private handlePlotClick = () => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        // init plot data   
        switch (widgetStore.catalogPlotType) {
            case CatalogPlotType.ImageOverlay:
                widgetStore.setUpdateMode(CatalogUpdateMode.ViewUpdate);
                if (frame) {
                    const imageCoords = widgetStore.get2DPlotData(widgetStore.xColumnRepresentation, widgetStore.yColumnRepresentation, widgetStore.catalogData);
                    const wcs = frame.validWcs ? frame.wcsInfo : 0;
                    const id = this.widgetId;
                    const catalogStore = appStore.catalogStore;
                    catalogStore.clearData(this.widgetId);
                    catalogStore.updateCatalogData(id, imageCoords.wcsX, imageCoords.wcsY, wcs, imageCoords.xHeaderInfo.units, imageCoords.yHeaderInfo.units, widgetStore.catalogCoordinateSystem.system);
                    catalogStore.updateCatalogColor(id, widgetStore.catalogColor);
                    catalogStore.updateCatalogSize(id, widgetStore.catalogSize);
                    catalogStore.updateCatalogShape(id, widgetStore.catalogShape);
                    widgetStore.setSelectedPointIndices(widgetStore.selectedPointIndices, false, false);
                }
                if (widgetStore.shouldUpdateData) {
                    widgetStore.setUpdatingDataStream(true);   
                    let catalogFilter = widgetStore.updateRequestDataSize;
                    appStore.sendCatalogFilter(catalogFilter);
                }

                break;
            case CatalogPlotType.D2Scatter:
                const scatterCoords = widgetStore.get2DPlotData(widgetStore.xColumnRepresentation, widgetStore.yColumnRepresentation, widgetStore.catalogData);
                const scatterProps: CatalogSubplotWidgetStoreProps = {
                    x: scatterCoords.wcsX,
                    y: scatterCoords.wcsY,
                    catalogOverlayWidgetStore: this.widgetStore,
                    plotType: widgetStore.catalogPlotType
                };
                const scatterWidgetId = appStore.widgetsStore.createFloatingCatalogScatterWidget(scatterProps);
                widgetStore.setCatalogScatterWidget(scatterWidgetId);
                break;
            case CatalogPlotType.Histogram:
                const historgramCoords = widgetStore.get1DPlotData(widgetStore.xColumnRepresentation);
                const historgramProps: CatalogSubplotWidgetStoreProps = {
                    x: historgramCoords.wcsData,
                    catalogOverlayWidgetStore: this.widgetStore,
                    plotType: widgetStore.catalogPlotType
                };
                const widgetId = appStore.widgetsStore.createFloatingCatalogScatterWidget(historgramProps);
                widgetStore.setCatalogScatterWidget(widgetId);
                break;
            default:
                break;
        }
    }

    private handlePlotTypeChange = (plotType: CatalogPlotType) => {
        this.widgetStore.setCatalogPlotType(plotType);
    }

    // source selected in table
    private onCatalogTableDataSelected = (selectedDataIndices: number[]) => {
        const widgetsStore = this.widgetStore;
        if (!widgetsStore.showSelectedData) {
            if (selectedDataIndices.length === 1) {
                const selectedPointIndexs = widgetsStore.selectedPointIndices;
                let highlighted = false;
                if (selectedPointIndexs.length === 1) {
                    highlighted = selectedPointIndexs.includes(selectedDataIndices[0]);
                }
                if (!highlighted) {
                    widgetsStore.setSelectedPointIndices(selectedDataIndices, false, true);
                } else {
                    widgetsStore.setSelectedPointIndices([], false, false);
                }
            } else {
                widgetsStore.setSelectedPointIndices(selectedDataIndices, false, true);
            }
        }
    }

    private renderFileIdPopOver = (fileId: number, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={fileId}
                text={fileId}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private renderPlotTypePopOver = (plotType: CatalogPlotType, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={plotType}
                text={plotType}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    private onTableResize = () => {
        // update table if resizing happend
        const widgetStore = this.widgetStore;
        if (widgetStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, false); 
        }
        if (widgetStore && this.catalogTableRef) {
            this.updateTableSize(this.catalogTableRef, false);
        }
    }
    
    private onMaxRowsChange = (val: number) => {
        const widgetStore = this.widgetStore;
        const dataSize = widgetStore?.catalogInfo?.dataSize;
        if (widgetStore && val > 0 && val < dataSize) {
            widgetStore.setMaxRows(val);
        } else if (widgetStore && val === 0) {
            widgetStore.setMaxRows(1);
        }else {
            widgetStore.setMaxRows(widgetStore.catalogInfo.dataSize);
        }
    }

    private renderSystemPopOver = (system: CatalogSystemType, itemProps: IItemRendererProps) => {
        return (
            <MenuItem
                key={system}
                text={this.widgetStore.CoordinateSystemName.get(system)}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
    }

    public render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;

        if (!widgetStore) {
            return (
                <div className="catalog-overlay">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                </div>
            );
        }

        const catalogTable = this.catalogDataInfo;
        const dataTableProps: TableComponentProps = {
            type: TableType.ColumnFilter,
            dataset: catalogTable.dataset,
            filter: widgetStore.catalogControlHeader,
            columnHeaders: widgetStore.displayedColumnHeaders,
            numVisibleRows: catalogTable.numVisibleRows,
            columnWidths: widgetStore.tableColumnWidts,
            loadingCell: widgetStore.loadingData,
            selectedDataIndex: widgetStore.selectedPointIndices,
            showSelectedData: widgetStore.showSelectedData,
            updateTableRef: this.onCatalogDataTableRefUpdated,
            updateColumnFilter: widgetStore.setColumnFilter,
            updateByInfiniteScroll: this.updateByInfiniteScroll,
            updateTableColumnWidth: widgetStore.setTableColumnWidth,
            updateSelectedRow: this.onCatalogTableDataSelected,
            updateSortRequest: this.updateSortRequest,
            sortingInfo: widgetStore.sortingInfo,
        };

        let startIndex = 0;
        if (widgetStore.numVisibleRows) {
            startIndex = 1;
        }

        const catalogFileDataSize = widgetStore.catalogInfo.dataSize;
        const maxRow = widgetStore.maxRows;
        const tableVisibleRows = catalogTable.numVisibleRows;
        let info = `Showing ${startIndex} to ${tableVisibleRows} of total ${catalogFileDataSize} entries`;
        if (widgetStore.hasFilter && isFinite(widgetStore.filterDataSize)) {
            info = `Showing ${startIndex} to ${tableVisibleRows} of ${widgetStore.filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
        } 
        if (maxRow < catalogFileDataSize && maxRow > 0) {
            info = `Showing ${startIndex} to ${tableVisibleRows} of top ${maxRow} entries. Total ${catalogFileDataSize} entries`;
        }
        if (maxRow < catalogFileDataSize && maxRow > 0 && widgetStore.hasFilter && isFinite(widgetStore.filterDataSize)) {
            if (widgetStore.filterDataSize >= maxRow) {
                info = `Showing ${startIndex} to ${tableVisibleRows} of top ${maxRow} entries. Total ${widgetStore.filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
            } else {
                info = `Showing ${startIndex} to ${tableVisibleRows} of ${widgetStore.filterDataSize} filtered entries. Total ${catalogFileDataSize} entries`;
            }
        }
        let tableInfo = (catalogFileDataSize) ? (
            <tr>
                <td className="td-label">
                    <pre>{info}</pre>
                </td>
            </tr>
        ) : null;

        let catalogFiles = [];
        appStore.catalogs.forEach((value, key) => {
            catalogFiles.push(value);
        });

        let systemOptions = [];
        widgetStore.CoordinateSystemName.forEach((value, key) => {
            systemOptions.push(key);
        });

        const activeSystem = widgetStore.CoordinateSystemName.get(widgetStore.catalogCoordinateSystem.system);
        const systemActive = widgetStore.catalogPlotType === CatalogPlotType.ImageOverlay;

        return (
            <div className={"catalog-overlay"}>
                <div className={"catalog-overlay-filter-settings"}>
                    <FormGroup  inline={true} label="File">
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={catalogFiles} 
                            activeItem={this.catalogFileId}
                            onItemSelect={this.handleCatalogFileChange}
                            itemRenderer={this.renderFileIdPopOver}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={this.catalogFileId} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    <Select
                        className="catalog-type-button" 
                        filterable={false}
                        items={Object.values(CatalogPlotType)} 
                        activeItem={widgetStore.catalogPlotType}
                        onItemSelect={this.handlePlotTypeChange}
                        itemRenderer={this.renderPlotTypePopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button className="bp3-minimal" text={widgetStore.catalogPlotType} rightIcon="double-caret-vertical"/>
                    </Select>
                    {systemActive &&
                    <FormGroup disabled={!systemActive} inline={true} label="System">
                        <Select 
                            className="catalog-system"
                            filterable={false}
                            items={systemOptions} 
                            activeItem={widgetStore.catalogCoordinateSystem.system}
                            onItemSelect={system => widgetStore.setCatalogCoordinateSystem(system)}
                            itemRenderer={this.renderSystemPopOver}
                            disabled={!systemActive}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={activeSystem} disabled={!systemActive} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    }
                    {systemActive &&
                    <CatalogOverlayPlotSettingsComponent widgetStore={this.widgetStore} id={this.widgetId}/>
                    }
                </div>
                <SplitPane 
                    className="catalog-table" 
                    split="horizontal" 
                    primary={"second"} 
                    defaultSize={"60%"} 
                    minSize={"5%"}
                    onChange={this.onTableResize}
                >
                    <Pane className={"catalog-overlay-column-header-container"}>
                        {this.createHeaderTable()}
                    </Pane>
                    <Pane className={"catalog-overlay-data-container"}>
                        <TableComponent {...dataTableProps}/>
                    </Pane>
                </SplitPane>
                <div className="bp3-dialog-footer">
                    <div className={"table-info"}>
                        <table className="info-display">
                            <tbody>
                                {tableInfo}
                            </tbody>
                        </table>
                    </div>
                    <div className="bp3-dialog-footer-actions">
                        <ClearableNumericInputComponent
                            className={"catalog-max-rows"}
                            label="Max Rows"
                            value={widgetStore.maxRows}
                            onValueChanged={val => this.onMaxRowsChange(val)}
                            onValueCleared={() => widgetStore.setMaxRows(widgetStore.catalogInfo.dataSize)}
                            displayExponential={false}
                            disabled={widgetStore.loadOntoImage}
                        />
                        <Tooltip content={"Apply filter"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Update"
                            onClick={this.handleFilterRequest}
                            disabled={widgetStore.loadOntoImage || !widgetStore.updateTableView}
                        />
                        </Tooltip>
                        <Tooltip content={"Reset table view and remove catalog overlay"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Reset"
                            onClick={this.handleResetClick}
                            disabled={widgetStore.loadOntoImage}
                        />
                        </Tooltip>
                        <Tooltip content={"Close file"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Close"
                            onClick={this.handleFileCloseClick}
                            disabled={widgetStore.loadOntoImage}
                        />
                        </Tooltip>
                        <Tooltip content={"Plot data"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Plot"
                            onClick={this.handlePlotClick}
                            disabled={!widgetStore.enablePlotButton}
                        />
                        </Tooltip>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }

}
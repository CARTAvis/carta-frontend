import * as React from "react";
import {action, autorun, computed, makeObservable, observable} from "mobx";
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
import {AppStore, CatalogStore, CatalogProfileStore, CatalogOverlay, CatalogCoordinate, CatalogUpdateMode, CatalogSystemType, HelpType, WidgetProps, WidgetsStore, DefaultWidgetConfig} from "stores";
import {CatalogWidgetStore, CatalogPlotWidgetStoreProps, CatalogPlotType} from "stores/widgets";
import {toFixed} from "utilities";
import {ProcessedColumnData} from "models";
import "./CatalogOverlayComponent.scss";

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
    @computed get catalogFileId() {
        return CatalogStore.Instance.catalogProfiles?.get(this.props.id);
    }

    @observable catalogTableRef: Table = undefined;

    private catalogHeaderTableRef: Table = undefined;
    private catalogFileNames: Map<number, string>;
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

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "catalog-overlay",
            type: "catalog-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 740,
            defaultHeight: 350,
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
    }

    @action handleFileCloseClick = () => {
        const appStore = AppStore.Instance;
        const widgetId = CatalogStore.Instance.catalogWidgets.get(this.catalogFileId);
        appStore.removeCatalog(this.catalogFileId, widgetId, this.props.id);
    }

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
        const {scrollLeft, scrollTop} = ScrollUtils.getScrollPositionForRegion(
            region,
            currScrollLeft,
            currScrollTop,
            ref.grid.getCumulativeWidthBefore,
            ref.grid.getCumulativeHeightBefore,
            numFrozenRows,
            numFrozenColumns,
        );
        const correctedScrollLeft = ref.shouldDisableHorizontalScroll() ? 0 : scrollLeft;
        const correctedScrollTop = ref.shouldDisableVerticalScroll() ? 0 : scrollTop;
        ref.quadrantStackInstance.scrollToPosition(correctedScrollLeft, correctedScrollTop);
    };

    @computed get catalogDataInfo(): {dataset: Map<number, ProcessedColumnData>, numVisibleRows: number} {
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
        if (catalogWidgetStore.catalogPlotType === CatalogPlotType.Histogram) {
            return (profileStore.xColumnRepresentation !== null && !profileStore.loadingData && !profileStore.updatingDataStream);
        } else {
            return (profileStore.xColumnRepresentation !== null && profileStore.yColumnRepresentation !== null && !profileStore.loadingData && !profileStore.updatingDataStream);
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

    onCatalogDataTableRefUpdated = (ref) => {
        this.catalogTableRef = ref;
    }

    onControlHeaderTableRef = (ref) => {
        this.catalogHeaderTableRef = ref;
    }

    @action private onResize = (width: number, height: number) => {
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        // fixed bug from blueprintjs, only display 4 rows.
        if (profileStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, this.props.docked);
            // hack way to update catalog title
            if (profileStore.progress === 1 || profileStore.progress === undefined) {
                const fileName = profileStore.catalogInfo.fileInfo.name;
                WidgetsStore.Instance.setWidgetComponentTitle(this.props.id, `Catalog : ${fileName}`);    
            }
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
        const val = changeEvent.target.checked;
        const header = this.profileStore.catalogControlHeader.get(columnName);
        this.profileStore.setHeaderDisplay(val, columnName);
        if (val === true || (header.filter !== "" && val === false)) {
            this.handleFilterRequest();   
        }
        if (header.representAs !== CatalogCoordinate.NONE) {
            const option = {
                coordinate: CatalogCoordinate.NONE, 
                coordinateType: CatalogOverlay.NONE
            };
            this.profileStore.setHeaderRepresentation(option, columnName);
        }   
    }

    private handleHeaderRepresentationChange(option: {coordinate: CatalogCoordinate, coordinateType: CatalogOverlay}, columnName: string) {
        this.profileStore.setHeaderRepresentation(option, columnName);
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
        const profileStore = this.profileStore;
        const display = profileStore.catalogControlHeader.get(columnName).display;
        let disable = profileStore.loadingData || profileStore.disableWithDataLoading;
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
        const profileStore = this.profileStore;
        const catalogWidgetStore = this.widgetStore;
        const controlHeader = this.profileStore.catalogControlHeader.get(columnName);
        const dataType = profileStore.catalogHeader[controlHeader.dataIndex].dataType;
        const supportedRepresentations = CatalogOverlayComponent.DataTypeRepresentationMap.get(dataType);
        let disable = !controlHeader.display || profileStore.disableWithDataLoading;
        let options = [];
        let activeSystemCoords;
        switch (catalogWidgetStore.catalogPlotType) {
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
                activeSystemCoords = profileStore.activedSystem;
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
                if (catalogWidgetStore.catalogPlotType !== CatalogPlotType.Histogram) {
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
            case profileStore.xColumnRepresentation:
                activeItem = activeSystemCoords.x;
                break;
            case profileStore.yColumnRepresentation:
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
                    disabled={disable}
                    popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                >
                    <Button className="bp3-minimal catalog-represent-as-select-button" text={activeItem} disabled={disable} rightIcon="double-caret-vertical"/>
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
        const headerDataset = this.profileStore.catalogHeader;
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
        const filters = this.profileStore.catalogControlHeader;
        filters.forEach((value, key) => {
            if (value.filter !== undefined && value.display) {
                let filter = new CARTA.FilterConfig();
                const dataType = this.profileStore.catalogHeader[value.dataIndex].dataType;
                filter.columnName = key;
                if (dataType === CARTA.ColumnType.String) {
                    filter.subString = value.filter;
                    userFilters.push(filter);
                } else {
                    const result = CatalogOverlayComponent.GetComparisonOperatorAndValue(value.filter);
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

    private static GetNumberFromFilter(filterString: string): number {
        return Number(filterString.replace(/[^0-9.+-.]+/g, ""));
    }

    private static GetComparisonOperatorAndValue(filterString: string): {operator: CARTA.ComparisonOperator, values: number[]} {
        const filter = filterString.replace(/\s/g, "");
        let result = {operator: -1, values: []};
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
    } 

    private handleFilterRequest = () => {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        if (profileStore && appStore) {
            profileStore.updateTableStatus(false);
            profileStore.resetFilterRequestControlParams();
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(this.catalogFileId);

            let filter = profileStore.updateRequestDataSize;
            filter.imageBounds.xColumnName = profileStore.xColumnRepresentation;
            filter.imageBounds.yColumnName = profileStore.yColumnRepresentation;
            
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
    }

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
    }

    private handleResetClick = () => {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        if (profileStore) {
            profileStore.resetCatalogFilterRequest();
            this.resetSelectedPointIndices();
            appStore.catalogStore.clearImageCoordsData(this.catalogFileId);
            appStore.sendCatalogFilter(profileStore.catalogFilterRequest); 
        }
    }

    private handlePlotClick = () => {
        const profileStore = this.profileStore;
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const catalogStore = CatalogStore.Instance;
        const catalogWidgetStore = this.widgetStore;
        // init plot data   
        switch (catalogWidgetStore.catalogPlotType) {
            case CatalogPlotType.ImageOverlay:
                profileStore.setUpdateMode(CatalogUpdateMode.ViewUpdate);
                if (frame) {
                    const imageCoords = profileStore.get2DPlotData(profileStore.xColumnRepresentation, profileStore.yColumnRepresentation, profileStore.catalogData);
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
                    xColumnName: profileStore.xColumnRepresentation,
                    yColumnName: profileStore.yColumnRepresentation,
                    plotType: catalogWidgetStore.catalogPlotType
                };
                const scatterPlot = appStore.widgetsStore.createFloatingCatalogPlotWidget(scatterProps);
                catalogStore.setCatalogPlots(scatterPlot.widgetComponentId, this.catalogFileId, scatterPlot.widgetStoreId);
                break;
            case CatalogPlotType.Histogram:
                const historgramProps: CatalogPlotWidgetStoreProps = {
                    xColumnName: profileStore.xColumnRepresentation,
                    plotType: catalogWidgetStore.catalogPlotType
                };
                const histogramPlot = appStore.widgetsStore.createFloatingCatalogPlotWidget(historgramProps);
                catalogStore.setCatalogPlots(histogramPlot.widgetComponentId, this.catalogFileId, histogramPlot.widgetStoreId);
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
    }

    private renderFileIdPopOver = (fileId: number, itemProps: IItemRendererProps) => {
        const fileName = this.catalogFileNames.get(fileId);
        let text = `${fileId}: ${fileName}`;
        return (
            <MenuItem
                key={fileId}
                text={text}
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
        const profileStore = this.profileStore;
        if (profileStore && this.catalogHeaderTableRef) {
            this.updateTableSize(this.catalogHeaderTableRef, false); 
        }
        if (profileStore && this.catalogTableRef) {
            this.updateTableSize(this.catalogTableRef, false);
        }
    }

    private renderSystemPopOver = (system: CatalogSystemType, itemProps: IItemRendererProps) => {
        const menuItem = (
            <MenuItem
                key={system}
                text={this.profileStore.CoordinateSystemName.get(system)}
                onClick={itemProps.handleClick}
                active={itemProps.modifiers.active}
            />
        );
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
                        <Tooltip position="auto-end" content={<small>PIX1:  1-based image coordinates</small>}>
                            {menuItem}
                        </Tooltip>
                    </div>
                );
            default:
                return menuItem;
        }
    }

    public render() {
        const catalogWidgetStore = this.widgetStore;
        const profileStore = this.profileStore;
        const catalogFileIds = CatalogStore.Instance.activeCatalogFiles;

        if (!profileStore || catalogFileIds === undefined || catalogFileIds?.length === 0) {
            return (
                <div className="catalog-overlay">
                    <NonIdealState icon={"folder-open"} title={"No catalog file loaded"} description={"Load a catalog file using the menu"}/>;
                </div>
            );
        }

        const catalogTable = this.catalogDataInfo;
        const dataTableProps: TableComponentProps = {
            type: TableType.ColumnFilter,
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
            disable: profileStore.disableWithDataLoading,
            darkTheme: AppStore.Instance.darkTheme
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
        let tableInfo = (catalogFileDataSize) ? (
            <tr>
                <td className="td-label">
                    <pre>{info}</pre>
                </td>
            </tr>
        ) : null;

        let catalogFileItems = [];
        catalogFileIds.forEach((value) => {
            catalogFileItems.push(value);
        });
        this.catalogFileNames = CatalogStore.Instance.getCatalogFileNames(catalogFileIds);
        
        let systemOptions = [];
        profileStore.CoordinateSystemName.forEach((value, key) => {
            systemOptions.push(key);
        });

        const activeSystem = profileStore.CoordinateSystemName.get(profileStore.catalogCoordinateSystem.system);
        const systemActive = catalogWidgetStore.catalogPlotType === CatalogPlotType.ImageOverlay;

        return (
            <div className={"catalog-overlay"}>
                <div className={"catalog-overlay-filter-settings"}>
                    <FormGroup  inline={true} label="File">
                        <Select 
                            className="bp3-fill"
                            filterable={false}
                            items={catalogFileItems} 
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
                        activeItem={catalogWidgetStore.catalogPlotType}
                        onItemSelect={this.handlePlotTypeChange}
                        itemRenderer={this.renderPlotTypePopOver}
                        popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                    >
                        <Button className="bp3-minimal" text={catalogWidgetStore.catalogPlotType} rightIcon="double-caret-vertical"/>
                    </Select>
                    {systemActive &&
                    <FormGroup disabled={!systemActive} inline={true} label="System">
                        <Select 
                            className="catalog-system"
                            filterable={false}
                            items={systemOptions} 
                            activeItem={profileStore.catalogCoordinateSystem.system}
                            onItemSelect={system => profileStore.setCatalogCoordinateSystem(system)}
                            itemRenderer={this.renderSystemPopOver}
                            disabled={!systemActive}
                            popoverProps={{popoverClassName: "catalog-select", minimal: true , position: PopoverPosition.AUTO_END}}
                        >
                            <Button text={activeSystem} disabled={!systemActive} rightIcon="double-caret-vertical"/>
                        </Select>
                    </FormGroup>
                    }
                    {systemActive && 
                        <CatalogOverlayPlotSettingsComponent 
                            catalogSize={catalogWidgetStore.catalogSize}
                            catalogColor={catalogWidgetStore.catalogColor}
                            catalogFileId={catalogWidgetStore.catalogFileId}
                            catalogShape={catalogWidgetStore.catalogShape}
                            setCatalogShape={shape => catalogWidgetStore.setCatalogShape(shape)}
                            setCatalogSize={size => catalogWidgetStore.setCatalogSize(size)}
                            setCatalogColor={color => catalogWidgetStore.setCatalogColor(color)}
                        />
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
                            max={profileStore.catalogInfo.dataSize}
                            min={1}
                            integerOnly={true}
                            value={profileStore.maxRows}
                            onValueChanged={val => profileStore.setMaxRows(val)}
                            onValueCleared={() => profileStore.setMaxRows(profileStore.catalogInfo.dataSize)}
                            displayExponential={false}
                            updateValueOnKeyDown={true}
                            disabled={profileStore.loadOntoImage}
                        />
                        <Tooltip content={"Apply filter"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Update"
                            onClick={this.handleFilterRequest}
                            disabled={profileStore.loadOntoImage || !profileStore.updateTableView}
                        />
                        </Tooltip>
                        <Tooltip content={"Reset table view and remove catalog overlay"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Reset"
                            onClick={this.handleResetClick}
                            disabled={profileStore.loadOntoImage}
                        />
                        </Tooltip>
                        <Tooltip content={"Close file"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Close"
                            onClick={this.handleFileCloseClick}
                            disabled={profileStore.loadOntoImage}
                        />
                        </Tooltip>
                        <Tooltip content={"Plot data"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Plot"
                            onClick={this.handlePlotClick}
                            disabled={!this.enablePlotButton}
                        />
                        </Tooltip>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }

}
import * as React from "react";
import * as _ from "lodash";
import {autorun, computed, observable, action} from "mobx";
import {observer} from "mobx-react";
import {Switch, HTMLSelect, AnchorButton, Intent, Tooltip, FormGroup, NonIdealState} from "@blueprintjs/core";
import {Cell, Column, Table, SelectionModes, RenderMode} from "@blueprintjs/table";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {TableComponent, TableComponentProps, TableType} from "components/Shared";
import {CatalogOverlayPlotSettingsComponent} from "./CatalogOverlayPlotSettingsComponent/CatalogOverlayPlotSettingsComponent";
import {WidgetConfig, WidgetProps, HelpType} from "stores";
import {CatalogOverlayWidgetStore, CatalogOverlay, CatalogUpdateMode, CatalogPlotType, CatalogScatterWidgetStoreProps} from "stores/widgets";
import {toFixed} from "utilities";
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
   EqualTo = "==", 
   NotEqualTo = "!=",
   LessThanOrEqualTo = "<=",
   LessThan = "<", 
   GreaterThanOrEqualTo = ">=",
   GreaterThan = ">",
   BetweenAnd = "...",
   FromTo = ".."
}

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    @observable coordinate: {x: CatalogOverlay, y: CatalogOverlay};
    @observable widgetId: string;
    @observable catalogFileId: number;

    private catalogdataTableRef: Table;
    private controlHeaderTableRef: Table;
    private static readonly DataTypeRepresentationMap = new Map<CARTA.EntryType, Array<CatalogOverlay>>([
        [CARTA.EntryType.BOOL, [CatalogOverlay.NONE]],
        [CARTA.EntryType.DOUBLE, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.NONE]],
        [CARTA.EntryType.FLOAT, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.NONE]],
        [CARTA.EntryType.INT, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.NONE]],
        [CARTA.EntryType.LONGLONG, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.NONE]],
        [CARTA.EntryType.STRING, [CatalogOverlay.NONE]],
        [CARTA.EntryType.UNKNOWN_TYPE, [CatalogOverlay.NONE]]
    ]);

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "catalog-overlay",
            type: "catalog-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 600,
            defaultHeight: 350,
            title: "Catalog Overlay",
            isCloseable: true,
            helpType: HelpType.CATALOG_OVERLAY
        };
    }

    @computed get widgetStore(): CatalogOverlayWidgetStore {

        let widgetStore = this.props.appStore.widgetsStore.catalogOverlayWidgets.get(this.widgetId);
        let widgetId = this.matchesSelectedCatalogFile;
        if (widgetId) {
            widgetStore = this.props.appStore.widgetsStore.catalogOverlayWidgets.get(widgetId);   
        } else {
            widgetStore = this.props.appStore.widgetsStore.catalogOverlayWidgets.values().next().value;
        }
        return widgetStore;
    }

    @computed get matchesSelectedRegion() {
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;
        if (frame) {
            const widgetRegion = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId);
            if (frame.regionSet.selectedRegion && frame.regionSet.selectedRegion.regionId !== 0) {
                return widgetRegion === frame.regionSet.selectedRegion.regionId;
            }
        }
        return false;
    }

    @computed get matchesSelectedCatalogFile(): string {
        let widgetId = null;
        this.props.appStore.catalogs.forEach((value, key) => {
            if (value === this.catalogFileId) {
                widgetId = key;
            }
        });
        return widgetId;
    }

    @action handleCatalogFileChange(changeEvent: React.ChangeEvent<HTMLSelectElement>) {
        const val = Number(changeEvent.currentTarget.value);
        this.catalogFileId = val;
        this.widgetId = this.matchesSelectedCatalogFile;
    }

    constructor(props: WidgetProps) {
        super(props);
        this.widgetId = this.props.id;
        if (this.widgetStore) {
            this.catalogFileId = this.widgetStore.catalogInfo.fileId;  
        }
        autorun(() => {
            if (this.widgetStore) {
                this.widgetId = this.matchesSelectedCatalogFile;
                let progressString = "";
                const fileName = this.widgetStore.catalogInfo.fileInfo.name || "";
                const appStore = this.props.appStore;
                const frame = appStore.activeFrame;
                const progress = this.widgetStore.progress;
                if (progress && isFinite(progress) && progress < 1) {
                    progressString = `[${toFixed(progress * 100)}% complete]`;
                }
                if (frame) {
                    const regionId = this.widgetStore.regionIdMap.get(frame.frameInfo.fileId) || 0;
                    const regionString = regionId === 0 ? "Cursor" : `Region #${regionId}`;
                    const selectedString = this.matchesSelectedRegion ? "(Selected)" : "";
                    this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Catalog ${fileName} : ${regionString} ${selectedString} ${progressString}`);
                }
            } else {
                this.props.appStore.widgetsStore.setWidgetTitle(this.props.id, `Catalog : Cursor`);
                this.props.appStore.widgetsStore.removeFloatingWidget(this.props.id, true);
            }
        });
    }

    onCatalogdataTableRefUpdated = (ref) => {
        this.catalogdataTableRef = ref;
    }

    onControlHeaderTableRef = (ref) => {
        this.controlHeaderTableRef = ref;
    }

    onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;
        const widgetStore = this.widgetStore;
        // fixed bug from blueprintjs, only display 4 rows.
        if (widgetStore && this.controlHeaderTableRef) {
            this.updateTableSize(this.controlHeaderTableRef); 
        }
        if (widgetStore && this.catalogdataTableRef) {
            this.updateTableSize(this.catalogdataTableRef);
        }
    };

    private handleHeaderDisplayChange(changeEvent: any, columnName: string) {
        const val = changeEvent.target.checked;
        const withFilter = this.widgetStore.catalogControlHeader.get(columnName);
        this.widgetStore.setHeaderDisplay(val, columnName);
        if (val === true || (withFilter.filter !== undefined && val === false)) {
            this.handleFilterClick();   
        }   
    }

    private handleHeaderRepresentationChange(changeEvent: React.ChangeEvent<HTMLSelectElement>, columnName: string) {
        const val = changeEvent.currentTarget.value as CatalogOverlay;
        this.widgetStore.setHeaderRepresentation(val, columnName);
    }

    private renderDataColumn(columnName: string, coloumnData: any) {
        return (
            <Column 
                key={columnName} 
                name={columnName} 
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>{coloumnData[rowIndex]}</Cell>
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
            <Cell key={`cell_switch_${rowIndex}`}>
                <React.Fragment>
                    <Switch className="display-switch" key={`cell_switch_button_${rowIndex}`} disabled={disable} checked={display} onChange={changeEvent => this.handleHeaderDisplayChange(changeEvent, columnName)}/>
                </React.Fragment>
            </Cell>
        );
    }

    private renderDropDownMenuCell(rowIndex: number, columnName: string) {
        const widgetStore = this.widgetStore;
        const controlHeader = widgetStore.catalogControlHeader.get(columnName);
        const dataType = widgetStore.catalogHeader[controlHeader.dataIndex].dataType;
        const supportedRepresentations = CatalogOverlayComponent.DataTypeRepresentationMap.get(dataType);
        const disabled = !controlHeader.display;

        return (
            <Cell key={`cell_drop_down_${rowIndex}`}>
                <React.Fragment>
                    <HTMLSelect className="bp3-minimal bp3-fill " value={controlHeader.representAs} disabled={disabled} onChange={changeEvent => this.handleHeaderRepresentationChange(changeEvent, columnName)}>
                        {supportedRepresentations.map( representation => {                           
                            if (representation === CatalogOverlay.X) {
                                return (<option key={representation} value={representation}>{this.coordinate.x}</option>);
                            } else if (representation === CatalogOverlay.Y) {
                                return (<option key={representation} value={representation}>{this.coordinate.y}</option>);
                            } else {
                                return (<option key={representation} value={representation}>{representation}</option>);
                            }   
                        })}
                    </HTMLSelect>
                </React.Fragment>
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
                defaultRowHeight={35}
                minRowHeight={20}
                minColumnWidth={30}
                enableGhostCells={true}
                numFrozenColumns={1}
                columnWidths={this.widgetStore.headerTableColumnWidts}
                onColumnWidthChanged={this.updateHeaderTableColumnSize}
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

    private updateTableSize(ref: any) {
        const viewportRect = ref.locator.getViewportRect();
        ref.updateViewportRect(viewportRect); 
    }

    private getUserFilters(): CARTA.FilterConfig[] {
        let userFilters: CARTA.FilterConfig[] = [];
        const filters = this.widgetStore.catalogControlHeader;
        filters.forEach((value, key) => {
            if (value.filter !== undefined && value.display) {
                let filter = new CARTA.FilterConfig();
                const dataType = this.widgetStore.catalogHeader[value.dataIndex].dataType;
                filter.columnName = key;
                if (dataType === CARTA.EntryType.STRING) {
                    filter.subString = value.filter;
                    filter.comparisonOperator = null;
                    filter.max = null;
                    filter.min = null;
                    userFilters.push(filter);
                } else {
                    const result = this.getComparisonOperatorAndValue(value.filter);
                    if (result.operator !== -1 && result.values.length > 0) {
                        filter.comparisonOperator = result.operator;
                        switch (result.values.length) {
                            case 2:
                                filter.min = Math.min(result.values[0], result.values[1]);
                                filter.max = Math.max(result.values[0], result.values[1]);
                                break;
                            default:
                                filter.min = result.values[0];
                                filter.max = result.values[0];
                                break;
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

    private getComparisonOperatorAndValue(filterString: string): {operator: number, values: number[]} {
        const filter = filterString.replace(/\s/g, "");
        let result = {operator: -1, values: []};
        // order matters, since ... and .. both having .. (same for < and <=, > and >=)
        for (const key of Object.keys(ComparisonOperator)) {
            const operator = ComparisonOperator[key];
            const found = filter.includes(operator);
            if (found) {
                if (operator === ComparisonOperator.EqualTo) {
                    const equalTo = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.EqualTo;
                    result.values.push(equalTo);
                    return result;
                } else if (operator === ComparisonOperator.NotEqualTo) {
                    const notEqualTo = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.NotEqualTo;
                    result.values.push(notEqualTo);
                    return result;
                } else if (operator === ComparisonOperator.LessThan) {
                    const lessThan = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.LessThan;
                    result.values.push(lessThan);
                    return result;
                } else if (operator === ComparisonOperator.LessThanOrEqualTo) {
                    const lessThanOrEqualTo = this.getNumberFromFilter(filter);
                    result.values.push(lessThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.LessThanOrEqualTo;
                    return result;
                } else if (operator === ComparisonOperator.GreaterThan) {
                    const greaterThan = this.getNumberFromFilter(filter);
                    result.operator = CARTA.ComparisonOperator.GreaterThan;
                    result.values.push(greaterThan);
                    return result;
                } else if (operator === ComparisonOperator.GreaterThanOrEqualTo) {
                    const greaterThanOrEqualTo = this.getNumberFromFilter(filter);
                    result.values.push(greaterThanOrEqualTo);
                    result.operator = CARTA.ComparisonOperator.GreaterThanOrEqualTo;
                    return result;
                } else if (operator === ComparisonOperator.FromTo) {
                    const fromTo = filter.split(ComparisonOperator.FromTo, 2);
                    result.values.push(Number(fromTo[0]));
                    result.values.push(Number(fromTo[1]));
                    result.operator = CARTA.ComparisonOperator.FromTo;
                    return result;
                } else if (operator === ComparisonOperator.BetweenAnd) {
                    const betweenAnd = filter.split(ComparisonOperator.BetweenAnd, 2);
                    result.values.push(Number(betweenAnd[0]));
                    result.values.push(Number(betweenAnd[1]));
                    result.operator = CARTA.ComparisonOperator.BetweenAnd;
                    return result;
                }
            }
        }
        return result;
    }

    private handleFilterClick = () => {
        const widgetStore = this.widgetStore;
        const appStore = this.props.appStore;
        widgetStore.setUpdateMode(CatalogUpdateMode.TableUpdate);
        widgetStore.clearData();
        widgetStore.setNumVisibleRows(0);
        widgetStore.setSubsetEndIndex(0);
        widgetStore.setselectedPointIndexs([]);
        widgetStore.setLoadingDataStatus(true);
        let catalogFilter = widgetStore.updateRequestDataSize;

        // Todo filter by region Id and Imageview boundary
        catalogFilter.imageBounds.xColumnName = widgetStore.xColumnRepresentation;
        catalogFilter.imageBounds.yColumnName = widgetStore.yColumnRepresentation;
        
        catalogFilter.fileId = widgetStore.catalogInfo.fileId;
        catalogFilter.filterConfigs = this.getUserFilters();
        catalogFilter.hidedHeaders = widgetStore.hidedHeaders;
        appStore.sendCatalogFilter(catalogFilter);
    };

    private updateTableData = () => {
        const widgetStore = this.widgetStore;
        // const profile = this.profileStore;
        if (widgetStore.loadingData === false && widgetStore.updateMode === CatalogUpdateMode.TableUpdate && widgetStore.shouldUpdateData && !widgetStore.showSelectedData) {
            widgetStore.setUpdateMode(CatalogUpdateMode.TableUpdate);
            const filter = this.widgetStore.updateRequestDataSize;
            const currentHidedHeaders = widgetStore.hidedHeaders;
            filter.hidedHeaders = currentHidedHeaders;
            this.props.appStore.sendCatalogFilter(filter);
            widgetStore.setLoadingDataStatus(true);
        }
    }

    private handleResetClick = () => {
        const widgetStore = this.widgetStore;
        const appStore = this.props.appStore;
        if (widgetStore) {
            widgetStore.reset();
            widgetStore.setselectedPointIndexs([]);
            appStore.catalogStore.clearData(this.widgetId);
            const catalogFilter = widgetStore.initUserFilters;
            appStore.sendCatalogFilter(catalogFilter); 
        }
    }

    private handlePlotClick = () => {
        const widgetStore = this.widgetStore;
        const appStore = this.props.appStore;
        const frame = appStore.activeFrame;

        // init plot data   
        const coords = widgetStore.get2DPlotData(widgetStore.xColumnRepresentation, widgetStore.yColumnRepresentation, widgetStore.catalogData);

        switch (widgetStore.catalogPlotType) {
            case CatalogPlotType.ImageOverlay:
                widgetStore.setUpdateMode(CatalogUpdateMode.ViewUpdate);
                if (frame) {
                    const wcs = frame.validWcs ? frame.wcsInfo : 0;
                    const id = this.widgetId;
                    const catalogStore = appStore.catalogStore;
                    catalogStore.clearData(this.widgetId);
                    catalogStore.updateCatalogData(id, coords.wcsX, coords.wcsY, wcs, coords.xHeaderInfo.units, coords.yHeaderInfo.units, widgetStore.catalogCoordinateSystem.system);
                    catalogStore.updateCatalogColor(id, widgetStore.catalogColor);
                    catalogStore.updateCatalogSize(id, widgetStore.catalogSize);
                    catalogStore.updateCatalogShape(id, widgetStore.catalogShape);
                }
                if (widgetStore.shouldUpdateData) {
                    widgetStore.setPlotingData(true);   
                    let catalogFilter = widgetStore.updateRequestDataSize;
                    appStore.sendCatalogFilter(catalogFilter);
                }

                break;
            case CatalogPlotType.D2Scatter:
                const scatterProps: CatalogScatterWidgetStoreProps = {
                    x: coords.wcsX,
                    y: coords.wcsY,
                    catalogOverlayWidgetStore: this.widgetStore
                };
                const scatterWidgetId = appStore.widgetsStore.createFloatingCatalogScatterWidget(scatterProps);
                widgetStore.setCatalogScatterWidget(scatterWidgetId);
                break;
            default:
                break;
        }
    }

    private handlePlotTypeChange(changeEvent: React.ChangeEvent<HTMLSelectElement>) {
        const val = changeEvent.currentTarget.value as CatalogPlotType;
        this.widgetStore.setCatalogPlotType(val);
    }

    @action handleFileCloseClick = () => {
        const appStore = this.props.appStore;
        appStore.reomveCatalog(this.widgetId, this.props.id);
        if (appStore.catalogs.size > 0) {
            const catalogFileId = appStore.catalogs.values().next().value;
            this.catalogFileId = catalogFileId;
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.widgetStore;

        if (!widgetStore) {
            return (
                <div className="catalog-overlay">
                    <NonIdealState icon={"folder-open"} title={"No file loaded"} description={"Load a file using the menu"}/>;
                </div>
            );
        }

        this.coordinate = widgetStore.catalogCoordinateSystem.coordinate;
        let dataset = widgetStore.catalogData;
        let numVisibleRows = widgetStore.numVisibleRows;
        // Todo optimal filter method
        if (widgetStore.regionSelected && widgetStore.showSelectedData) {
            dataset = widgetStore.selectedData;
            numVisibleRows = widgetStore.regionSelected;
        }
        const dataTableProps: TableComponentProps = {
            type: TableType.ColumnFilter,
            dataset: dataset,
            filter: widgetStore.catalogControlHeader,
            columnHeaders: widgetStore.displayedColumnHeaders,
            numVisibleRows: numVisibleRows,
            columnWidts: widgetStore.tableColumnWidts,
            loadingCell: widgetStore.loadingData,
            selectedDataIndex: widgetStore.selectedPointIndexs,
            showSelectedData: widgetStore.showSelectedData,
            upTableRef: this.onCatalogdataTableRefUpdated,
            updateColumnFilter: widgetStore.setColumnFilter,
            updateTableData: this.updateTableData,
            updateTableColumnWidth: widgetStore.setTableColumnWidth
        };

        let startIndex = 0;
        if (widgetStore.numVisibleRows) {
            startIndex = 1;
        }
        let info = `Showing ${startIndex} to ${numVisibleRows} of ${widgetStore.catalogInfo.dataSize} entries`;
        if (widgetStore.hasFilter && widgetStore.filterDataSize) {
            info = `Showing ${startIndex} to ${numVisibleRows} of ${widgetStore.filterDataSize} entries, total ${widgetStore.catalogInfo.dataSize} entries`;
        }
        let tableInfo = (widgetStore.catalogInfo.dataSize) ? (
            <tr>
                <td className="td-label">
                    <pre>{info}</pre>
                </td>
            </tr>
        ) : null;

        let catalogFile = [];
        // Todo map file id with name
        appStore.catalogs.forEach((value, key) => {
            catalogFile.push(<option key={key} value={value}>{value}</option>);
        }); 

        return (
            <div className={"catalog-overlay"}>
                <div className={"catalog-overlay-filter-settings"}>
                    <FormGroup  inline={true} label="File">
                        <HTMLSelect className="bp3-fill" value={this.catalogFileId} onChange={changeEvent => this.handleCatalogFileChange(changeEvent)}>
                            {catalogFile}
                        </HTMLSelect>
                    </FormGroup>
                    <CatalogOverlayPlotSettingsComponent widgetStore={this.widgetStore} appStore={appStore} id={this.widgetId}/>
                </div>
                <div className={"catalog-overlay-column-header-container"}>
                    {this.createHeaderTable()}
                </div>
                <div className={"catalog-overlay-data-container"}>
                    <TableComponent {...dataTableProps}/>
                </div>
                <div className="bp3-dialog-footer">
                    <div className={"table-info"}>
                        <table className="info-display">
                            <tbody>
                                {tableInfo}
                            </tbody>
                        </table>
                    </div>
                    <div className="bp3-dialog-footer-actions">
                        <Tooltip content={"Apply filter"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Filter"
                            onClick={this.handleFilterClick}
                            disabled={widgetStore.loadOntoImage}
                        />
                        </Tooltip>
                        <Tooltip content={"Reset filter and catalog data"}>
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
                            disabled={!widgetStore.enableLoadButton}
                        />
                        </Tooltip>
                        <HTMLSelect className="bp3-minimal" value={widgetStore.catalogPlotType} onChange={changeEvent => this.handlePlotTypeChange(changeEvent)}>
                            {Object.keys(CatalogPlotType).map(plotType => {                           
                                return <option key={plotType} value={CatalogPlotType[plotType]}>{CatalogPlotType[plotType]}</option>;
                            })}
                        </HTMLSelect>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }

}
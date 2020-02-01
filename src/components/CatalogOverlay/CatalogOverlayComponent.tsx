import * as React from "react";
import * as _ from "lodash";
import {autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Colors, NonIdealState, Switch, HTMLSelect, AnchorButton, Intent, Tooltip, InputGroup} from "@blueprintjs/core";
import {Cell, Column, Table, Utils, SelectionModes, RenderMode, ColumnHeaderCell, EditableName, EditableCell} from "@blueprintjs/table";
import ReactResizeDetector from "react-resize-detector";
import {CARTA} from "carta-protobuf";
import {TableComponent, TableComponentProps, ColumnFilter, TableType} from "components/Shared";
import {CatalogOverlayFilterComponent} from "./CatalogOverlayFilterComponent/CatalogOverlayFilterComponent";
import {CatalogOverlayPlotSettingsComponent} from "./CatalogOverlayPlotSettingsComponent/CatalogOverlayPlotSettingsComponent";
// import {} from "./CatalogOverlayTableComponent/TableComponent";
import {WidgetConfig, WidgetProps} from "stores";
import {CatalogOverlayWidgetStore, CatalogOverlay} from "stores/widgets";
import {ChannelInfo, Point2D} from "models";
import {clamp, normalising, polarizationAngle, polarizedIntensity, binarySearchByX, closestPointIndexToCursor, toFixed, minMaxPointArrayZ} from "utilities";
import "./CatalogOverlayComponent.css";

enum HeaderTableColumnName {
    Name = "Name",
    Display = "Display",
    RepresentAs = "Represent As",
    Description = "Description"
}

@observer
export class CatalogOverlayComponent extends React.Component<WidgetProps> {
    private catalogdataTableRef: Table;
    private controlHeaderTableRef: Table;
    // private defaultcolumnWidth: number = 100;
    private static readonly DataTypeRepresentationMap = new Map<CARTA.EntryType, Array<CatalogOverlay>>([
        [CARTA.EntryType.BOOL, [CatalogOverlay.NULL]],
        [CARTA.EntryType.DOUBLE, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.PlotSize, CatalogOverlay.NULL]],
        [CARTA.EntryType.FLOAT, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.PlotSize, CatalogOverlay.NULL]],
        [CARTA.EntryType.INT, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.PlotSize, CatalogOverlay.NULL]],
        [CARTA.EntryType.LONGLONG, [CatalogOverlay.X, CatalogOverlay.Y, CatalogOverlay.PlotSize, CatalogOverlay.NULL]],
        [CARTA.EntryType.STRING, [CatalogOverlay.PlotShape, CatalogOverlay.NULL]],
        [CARTA.EntryType.UNKNOWN_TYPE, [CatalogOverlay.NULL]]
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
            isCloseable: true
        };
    }

    @observable width: number;
    @observable height: number;

    @computed get widgetStore(): CatalogOverlayWidgetStore {
        const widgetStore = this.props.appStore.widgetsStore.catalogOverlayWidgets.get(this.props.id); 
        return widgetStore;
    }

    // @computed get profileStore(): SpectralProfileStore {
    //     if (this.props.appStore && this.props.appStore.activeFrame) {
    //         let fileId = this.props.appStore.activeFrame.frameInfo.fileId;
    //         const regionId = this.widgetStore.regionIdMap.get(fileId) || 0;
    //         const frameMap = this.props.appStore.spectralProfiles.get(fileId);
    //         if (frameMap) {
    //             return frameMap.get(regionId);
    //         }
    //     }
    //     return null;
    // }

    constructor(props: WidgetProps) {
        super(props);
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
        // retrun column width according context length
        if (widgetStore && this.controlHeaderTableRef) {
            const columnWidths = this.columnWidts(this.controlHeaderTableRef, 4, 100, 2);
            widgetStore.setHeaderTableColumnWidts(columnWidths); 
        }
        if (widgetStore && this.catalogdataTableRef) {
            const numOfDisplayedColumn = widgetStore.numOfDisplayedColumn;
            const columnWidths = this.columnWidts(this.catalogdataTableRef, numOfDisplayedColumn);
            widgetStore.setDataTableColumnWidts(columnWidths); 
        }
    };

    private handleHeaderDisplayChange(changeEvent: any, columnName: string) {
        const val = changeEvent.target.checked;
        this.widgetStore.setHeaderDisplay(val, columnName);
        const numOfDisplayedColumn = this.widgetStore.numOfDisplayedColumn;
        const columnWidths = this.columnWidts(this.catalogdataTableRef, numOfDisplayedColumn);
        this.widgetStore.setDataTableColumnWidts(columnWidths);
    }

    private handleHeaderRepresentationChange(changeEvent: any, columnName: string) {
        const val = changeEvent.currentTarget.value;
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
        return (
            <Cell key={`cell_switch_${rowIndex}`}>
                <React.Fragment>
                    <Switch className="display-switch" key={`cell_switch_button_${rowIndex}`} checked={display} onChange={changeEvent => this.handleHeaderDisplayChange(changeEvent, columnName)}/>
                </React.Fragment>
            </Cell>
        );
    }

    private renderDropDownMenuCell(rowIndex: number, columnName: string) {
        const widgetStore = this.widgetStore;
        const controlHeader = widgetStore.catalogControlHeader.get(columnName);
        const dataType = widgetStore.catalogHeader[controlHeader.dataIndex].dataType;
        const supportedRepresentations = CatalogOverlayComponent.DataTypeRepresentationMap.get(dataType);
        return (
            <Cell key={`cell_drop_down_${rowIndex}`}>
                <React.Fragment>
                    <HTMLSelect className="bp3-minimal bp3-fill " value={controlHeader.representAs} onChange={changeEvent => this.handleHeaderRepresentationChange(changeEvent, columnName)}>
                        {supportedRepresentations.map( representation => <option key={representation} value={representation}>{representation}</option>)}
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
        const headerDataset = this.widgetStore.catalogHeader;
        const numResultsRows = headerDataset.length;
        for (let index = 0; index < headerDataset.length; index++) {
            const header = headerDataset[index];
            headerNames.push(header.name);
            headerDescriptions.push(header.description);
        }
        const columnName = this.renderDataColumn(HeaderTableColumnName.Name, headerNames);
        tableColumns.push(columnName);
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
                renderMode={RenderMode.NONE} 
                selectionModes={SelectionModes.NONE} 
                defaultRowHeight={35}
                minRowHeight={20}
                minColumnWidth={30}
                enableGhostCells={true}
                numFrozenColumns={1}
                columnWidths={this.widgetStore.headerTableColumnWidts}
            >
                {tableColumns}
            </Table>
        );
    }

    // private updateColumnFilter(value: string, columnName: string) {
    //     // send filter request
    //     this.widgetStore.setColumnFilter(value, columnName);
    // }

    private columnWidts = (ref, numColumns: number, fixedWidth?: number, fixedIndex?: number) => {
        const viewportRect = ref.locator.getViewportRect();
        const tableRect = ref.locator.getTableRect();
        ref.updateViewportRect(viewportRect); 
        const tableWidth = tableRect.width;
        const minColumnWidth = 100;

        let cumulativeColumnWidths = [];
        if (ref) { 
            let totalMinSizeReq = 0;
            for (let index = 0; index < numColumns; index++) {
                let columnWidth = 0;
                if (fixedWidth && fixedIndex === index) {
                    columnWidth = fixedWidth;
                } else {
                    columnWidth = ref.locator.getWidestVisibleCellInColumn(index);
                    // ref.locator.getColumnCellSelector(index) return nodelist [], bugs from blueprint table
                    if (columnWidth === 0 ) {
                        columnWidth = minColumnWidth;
                    }
                }
                // console.log(columnWidth)
                totalMinSizeReq += columnWidth;
                cumulativeColumnWidths.push(columnWidth);
            }

            if (totalMinSizeReq > tableWidth) {
                return cumulativeColumnWidths;
            } else {
                let diff = ((tableWidth - totalMinSizeReq) / numColumns);
                return cumulativeColumnWidths.map(columnWidt => columnWidt + diff);
            }
        } else {
            const defaultWidth = tableWidth / numColumns;
            for (let index = 0; index < numColumns; index++) {
                cumulativeColumnWidths.push(defaultWidth);
            }
            return cumulativeColumnWidths;
        }
    }

    public render() {
        const appStore = this.props.appStore;
        const widgetStore = this.widgetStore;
        console.log(widgetStore)
        const dataTableProps: TableComponentProps = {
            type: TableType.ColumnFilter,
            dataset: widgetStore.catalogData,
            filter: widgetStore.catalogControlHeader,
            columnHeaders: widgetStore.displayedColumnHeaders,
            numVisibleRows: widgetStore.numVisibleRows,
            columnWidts: widgetStore.dataTableColumnWidts,
            updateRef: this.onCatalogdataTableRefUpdated,
            updateColumnFilter: widgetStore.setColumnFilter,
            setNumVisibleRows: widgetStore.setNumVisibleRows,
        };

        return (
            <div className={"catalog-overlay"}>
                <div className={"catalog-overlay-filter-settings"}>
                    <CatalogOverlayFilterComponent widgetStore={this.widgetStore} appStore={appStore}/>
                    <CatalogOverlayPlotSettingsComponent widgetStore={this.widgetStore} appStore={appStore}/>
                </div>
                <div className={"catalog-overlay-column-header-container"}>
                    {this.createHeaderTable()}
                </div>
                <div className={"catalog-overlay-data-container"}>
                    <TableComponent {...dataTableProps}/>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <Tooltip content={"Apply filter"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Filter"
                        />
                        </Tooltip>
                        <Tooltip content={"Clear filter"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Clear"
                        />
                        </Tooltip>
                        <Tooltip content={"Load"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            text="Load"
                        />
                        </Tooltip>
                    </div>
                </div>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }

}
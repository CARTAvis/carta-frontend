import * as React from "react";
import {action, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Button, Classes, Divider, FormGroup, HTMLSelect, Intent, Menu, MenuItem, Overlay, Popover, Position, Spinner, Switch, Tooltip} from "@blueprintjs/core";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import ReactResizeDetector from "react-resize-detector";
import {SafeNumericInput, TableComponent, TableComponentProps, TableType} from "components/Shared";
import {AppStore, HelpType, WidgetConfig, WidgetProps, WidgetsStore} from "stores";
import {RedshiftType, SpectralLineHeaders, SpectralLineOverlayWidgetStore, SpectralLineQueryRangeType, SpectralLineQueryUnit} from "stores/widgets";
import "./SpectralLineOverlayComponent.css";

enum HeaderTableColumnName {
    Name = "Name",
    Description = "Description",
    Display = "Display"
}

@observer
export class SpectralLineOverlayComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    @observable widgetId: string;
    @observable headerTableColumnWidths: Array<number>;
    private headerTableRef: Table;

    public static get WIDGET_CONFIG(): WidgetConfig {
        return {
            id: "spectral-line-overlay",
            type: "spectral-line-overlay",
            minWidth: 320,
            minHeight: 400,
            defaultWidth: 600,
            defaultHeight: 600,
            title: "Spectral Line Overlay",
            isCloseable: true,
            helpType: HelpType.SPECTRAL_LINE_OVERLAY,
            componentId: "spectral-line-overlay-component"
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        this.headerTableColumnWidths = [150, 70, 300];
    }

    @computed get widgetStore(): SpectralLineOverlayWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spectralLineOverlayWidgets) {
            const widgetStore = widgetsStore.spectralLineOverlayWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new SpectralLineOverlayWidgetStore();
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;

        // fixed bug from blueprintjs, only display 4 rows.
        if (this.headerTableRef) {
            this.updateTableSize(this.headerTableRef, this.props.docked);
        }
    };

    @action setHeaderTableColumnWidts(vals: Array<number>) {
        this.headerTableColumnWidths = vals;
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

    private renderSwitchButtonCell(rowIndex: number, columnName: SpectralLineHeaders) {
        const widgetStore = this.widgetStore;
        const display = widgetStore.headerDisplay.get(columnName);
        return (
            <Cell className="header-table-cell" key={`cell_switch_${rowIndex}`}>
                <React.Fragment>
                    <Switch className="cell-switch-button" key={`cell_switch_button_${rowIndex}`} checked={display} onChange={() => widgetStore.setHeaderDisplay(columnName)}/>
                </React.Fragment>
            </Cell>
        );
    }

    private renderButtonColumns(columnName: HeaderTableColumnName, headerNames: SpectralLineHeaders[]) {
        return <Column key={columnName} name={columnName} cellRenderer={rowIndex => this.renderSwitchButtonCell(rowIndex, headerNames[rowIndex])}/>;
    }

    onControlHeaderTableRef = (ref) => {
        this.headerTableRef = ref;
    }

    private createHeaderTable() {
        const headerNames = [];
        const headerDescriptions = [];
        this.widgetStore.formalizedHeaders.forEach(header => {
            headerNames.push(header.name);
            headerDescriptions.push(header.desc);
        });
        const tableColumns = [];
        const columnName = this.renderDataColumn(HeaderTableColumnName.Name, headerNames);
        tableColumns.push(columnName);
        const columnDisplaySwitch = this.renderButtonColumns(HeaderTableColumnName.Display, headerNames);
        tableColumns.push(columnDisplaySwitch);
        const columnDescription = this.renderDataColumn(HeaderTableColumnName.Description, headerDescriptions);
        tableColumns.push(columnDescription);

        return (
            <Table
                ref={(ref) => this.onControlHeaderTableRef(ref)}
                numRows={this.widgetStore.formalizedHeaders.length}
                enableRowReordering={false}
                renderMode={RenderMode.BATCH}
                selectionModes={SelectionModes.NONE}
                defaultRowHeight={30}
                minRowHeight={20}
                minColumnWidth={30}
                enableGhostCells={true}
                numFrozenColumns={1}
                columnWidths={this.headerTableColumnWidths}
                onColumnWidthChanged={this.updateHeaderTableColumnSize}
                enableRowResizing={false}
            >
                {tableColumns}
            </Table>
        );
    }

    private updateHeaderTableColumnSize = (index: number, size: number) => {
        if (this.headerTableColumnWidths) {
            this.headerTableColumnWidths[index] = size;
        }
    }

    private updateTableSize(ref: any, docked: boolean) {
        const viewportRect = ref.locator.getViewportRect();
        ref.updateViewportRect(viewportRect);
        // fixed bug for blueprint table, first column overlap with row index
        // triger table update
        if (docked) {
            ref.scrollToRegion(Regions.column(0));
        }
    }

    private handleEnterWidgetOption = (isEntering: boolean, widgetID: string) => {
        if (widgetID) {
            const hoveredOverWidgetStore = AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(widgetID);
            if (hoveredOverWidgetStore) {
                hoveredOverWidgetStore.setSelected(isEntering);
            }
        }
    };

    private handlePlot = () => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (widgetStore.selectedSpectralProfilerID && frame) {
            const selectedWidgetStore = appStore.widgetsStore.getSpectralWidgetStoreByID(widgetStore.selectedSpectralProfilerID);
            if (selectedWidgetStore) {
                selectedWidgetStore.addSpectralLines(widgetStore.selectedLines);
            }
        }
    };

    private handleClear = () => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        if (widgetStore.selectedSpectralProfilerID) {
            const selectedWidgetStore = appStore.widgetsStore.getSpectralWidgetStoreByID(widgetStore.selectedSpectralProfilerID);
            if (selectedWidgetStore) {
                selectedWidgetStore.clearSpectralLines();
            }
        }
    };

    render() {
        const appStore = AppStore.Instance;
        const widgetStore = this.widgetStore;

        const inputByRange = (
            <React.Fragment>
                <FormGroup label="From" inline={true}>
                    <SafeNumericInput
                        value={widgetStore.queryRange[0]}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setQueryRange([val, widgetStore.queryRange[1]])}
                    />
                </FormGroup>
                <FormGroup label="To" inline={true}>
                    <SafeNumericInput
                        value={widgetStore.queryRange[1]}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setQueryRange([widgetStore.queryRange[0], val])}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const inputByCenter = (
            <React.Fragment>
                <FormGroup inline={true}>
                    <SafeNumericInput
                        value={widgetStore.queryRangeByCenter[0]}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setQueryRangeByCenter([val, widgetStore.queryRangeByCenter[1]])}
                    />
                </FormGroup>
                <FormGroup label="±" inline={true}>
                    <SafeNumericInput
                        value={widgetStore.queryRangeByCenter[1]}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setQueryRangeByCenter([widgetStore.queryRangeByCenter[0], val])}
                    />
                </FormGroup>
            </React.Fragment>
        );

        const queryPanel = (
            <div className="query-panel">
                <div className="query-panel-input">
                    <FormGroup inline={true}>
                        <HTMLSelect
                            options={[SpectralLineQueryRangeType.Range, SpectralLineQueryRangeType.Center]}
                            value={widgetStore.queryRangeType}
                            onChange={(ev) => widgetStore.setQueryRangeType(ev.currentTarget.value as SpectralLineQueryRangeType)}
                        />
                    </FormGroup>
                    {widgetStore.queryRangeType === SpectralLineQueryRangeType.Range ? inputByRange : inputByCenter}
                    <FormGroup inline={true}>
                        <HTMLSelect
                            options={Object.values(SpectralLineQueryUnit)}
                            value={widgetStore.queryUnit}
                            onChange={(ev) => widgetStore.setQueryUnit(ev.currentTarget.value as SpectralLineQueryUnit)}
                        />
                    </FormGroup>
                </div>
                <div>
                    <Button intent={Intent.PRIMARY} onClick={widgetStore.query}>Query</Button>
                </div>
            </div>
        );

        const redshiftPanel = (
            <div className="redshift-panel">
                <FormGroup inline={true}>
                    <HTMLSelect options={[RedshiftType.V, RedshiftType.Z]} value={widgetStore.redshiftType} onChange={(ev) => widgetStore.setRedshiftType(ev.currentTarget.value as RedshiftType)}/>
                </FormGroup>
                <FormGroup label="Redshift" labelInfo={widgetStore.redshiftType === RedshiftType.V ? "(km/s)" : ""} inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftInput}
                        buttonPosition="none"
                        onValueChange={val => widgetStore.setRedshiftInput(val)}
                    />
                </FormGroup>
            </div>
        );

        const tableInfo = (widgetStore.queryResult.size > 0) ? (
            <pre>Showing {widgetStore.numDataRows} entries.</pre>
        ) : null;

        const isSelectedWidgetExisted = widgetStore.selectedSpectralProfilerID && AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(widgetStore.selectedSpectralProfilerID);
        const widgetMenu = (
            <Popover
                content={
                    <Menu>
                        {AppStore.Instance.widgetsStore.spectralProfilerList.map(widgetID =>
                            <MenuItem
                                key={widgetID}
                                text={widgetID}
                                onMouseEnter={() => this.handleEnterWidgetOption(true, widgetID)}
                                onMouseLeave={() => this.handleEnterWidgetOption(false, widgetID)}
                                onClick={() => widgetStore.setSelectedSpectralProfiler(widgetID)}
                            />
                        )}
                    </Menu>
                }
                position={Position.BOTTOM}
            >
                <Button minimal={true} rightIcon="caret-down">
                    {isSelectedWidgetExisted ? widgetStore.selectedSpectralProfilerID : "-- Select a widget --"}
                </Button>
            </Popover>
        );

        const queryResultTableProps: TableComponentProps = {
            type: TableType.Normal,
            dataset: widgetStore.queryResult,
            filter: widgetStore.controlHeaders,
            columnHeaders: widgetStore.displayedColumnHeaders,
            numVisibleRows: widgetStore.numDataRows,
            manualSelectionProps: {
                isSelectingAll: widgetStore.isSelectingAllLines,
                isSelectingIndeterminated: widgetStore.isSelectingIndeterminatedLines,
                selectAllLines: widgetStore.selectAllLines,
                selectSingleLine: widgetStore.selectSingleLine
            },
            manualSelectionData: widgetStore.manualSelectionData,
            sortingInfo: widgetStore.sortingInfo
        };

        let className = "spectral-line-overlay-widget";
        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        return (
            <div className={className}>
                <div className="bp3-dialog-body">
                    <div className="query-section">
                        {queryPanel}
                        <div className="header-table">
                            {this.createHeaderTable()}
                        </div>
                    </div>
                    <Divider/>
                    <div className="result-section">
                        {redshiftPanel}
                        <div className={"result-table"}>
                            <TableComponent {...queryResultTableProps}/>
                        </div>
                        <div className="result-table-info">
                            {tableInfo}
                        </div>
                    </div>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        {widgetMenu}
                        <Button intent={Intent.PRIMARY} disabled={!appStore.activeFrame || !isSelectedWidgetExisted || widgetStore.queryResult.size <= 0} onClick={this.handlePlot}>Plot</Button>
                        <Button intent={Intent.PRIMARY} disabled={!appStore.activeFrame || !isSelectedWidgetExisted || widgetStore.queryResult.size <= 0} onClick={this.handleClear}>Clear</Button>
                    </div>
                </div>
                <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={widgetStore.isQuerying} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null}/>
                    </div>
                </Overlay>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}/>
            </div>
        );
    }
}

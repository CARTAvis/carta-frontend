import * as React from "react";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";
import {AnchorButton, Button, Classes, ControlGroup, FormGroup, HTMLSelect, Intent, Menu, MenuItem, Overlay, Popover, Position, Spinner, Switch, Tooltip} from "@blueprintjs/core";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import SplitPane, { Pane } from "react-split-pane";
import ReactResizeDetector from "react-resize-detector";
import {SafeNumericInput, TableComponent, TableComponentProps, TableType} from "components/Shared";
import {AppStore, HelpType, DefaultWidgetConfig, WidgetProps, WidgetsStore} from "stores";
import {RedshiftType, SpectralLineHeaders, SpectralLineQueryWidgetStore, SpectralLineQueryRangeType, SpectralLineQueryUnit} from "stores/widgets";
import "./SpectralLineQueryComponent.scss";

enum HeaderTableColumnName {
    Name = "Name",
    Description = "Description",
    Display = "Display"
}

const KEYCODE_ENTER = 13;
const MINIMUM_WIDTH = 450;
const PLOT_LINES_LIMIT = 1000;

@observer
export class SpectralLineQueryComponent extends React.Component<WidgetProps> {
    @observable width: number;
    @observable height: number;
    @observable widgetId: string;
    @observable headerTableColumnWidths: Array<number>;
    private headerTableRef: Table;
    private resultTableRef: Table;

    public static get WIDGET_CONFIG(): DefaultWidgetConfig {
        return {
            id: "spectral-line-query",
            type: "spectral-line-query",
            minWidth: 500,
            minHeight: 400,
            defaultWidth: 750,
            defaultHeight: 600,
            title: "Spectral Line Query",
            isCloseable: true,
            helpType: HelpType.SPECTRAL_LINE_QUERY
        };
    }

    constructor(props: WidgetProps) {
        super(props);
        makeObservable(this);

        this.headerTableColumnWidths = [150, 70, 300];
    }

    @computed get widgetStore(): SpectralLineQueryWidgetStore {
        const widgetsStore = WidgetsStore.Instance;
        if (widgetsStore.spectralLineQueryWidgets) {
            const widgetStore = widgetsStore.spectralLineQueryWidgets.get(this.props.id);
            if (widgetStore) {
                return widgetStore;
            }
        }
        console.log("can't find store for widget");
        return new SpectralLineQueryWidgetStore();
    }

    @action onResize = (width: number, height: number) => {
        this.width = width;
        this.height = height;

        // fixed bug from blueprintjs, only display 4 rows.
        if (this.headerTableRef) {
            this.updateTableSize(this.headerTableRef, this.props.docked);
        }
        if (this.resultTableRef) {
            this.updateTableSize(this.resultTableRef, this.props.docked);
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

    private onTableResize = () => {
        // update table if resizing happend
        if (this.headerTableRef) {
            this.updateTableSize(this.headerTableRef, false);
        }
        if (this.resultTableRef) {
            this.updateTableSize(this.resultTableRef, false);
        }
    }

    private handleRedshiftChange = (ev) => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.widgetStore.redshiftInput;
        if (isFinite(value) && value !== existingValue) {
            if ((this.widgetStore.redshiftType === RedshiftType.Z && value >= 0) ||
                this.widgetStore.redshiftType === RedshiftType.V) {
                this.widgetStore.setRedshiftInput(value);
                return;
            }
        }
        ev.currentTarget.value = existingValue;
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
                ref={(ref) => this.headerTableRef = ref}
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

    private handleEnterWidgetOption = (isEntering: boolean, widgetID: string) => {
        if (widgetID) {
            const hoveredOverWidgetStore = AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(widgetID);
            if (hoveredOverWidgetStore) {
                hoveredOverWidgetStore.setHighlighted(isEntering);
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
                    <ControlGroup className="intensity-limit">
                        <FormGroup label={"Intensity Limit"} inline={true}>
                            <Switch checked={widgetStore.intensityLimitEnabled} onChange={() => widgetStore.toggleIntensityLimit()}/>
                        </FormGroup>
                        {widgetStore.intensityLimitEnabled &&
                        <Tooltip content="CDMS/JPL intensity (log)" position={Position.BOTTOM}>
                            <SafeNumericInput
                                value={widgetStore.intensityLimitValue}
                                buttonPosition="none"
                                onValueChange={val => widgetStore.setIntensityLimitValue(val)}
                            />
                        </Tooltip>
                        }
                    </ControlGroup>
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
                <FormGroup inline={true}>
                    <SafeNumericInput
                        value={widgetStore.redshiftInput}
                        buttonPosition="none"
                        onBlur={this.handleRedshiftChange}
                        onKeyDown={this.handleRedshiftChange}
                    />
                </FormGroup>
            </div>
        );

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
                                onClick={() => {
                                    this.handleEnterWidgetOption(false, widgetID);
                                    widgetStore.setSelectedSpectralProfiler(widgetID);
                                }}
                            />
                        )}
                    </Menu>
                }
                position={Position.BOTTOM}
                minimal={true}
            >
                <Button disabled={AppStore.Instance.widgetsStore.spectralProfilerList.length <= 0} rightIcon="caret-down">
                    {isSelectedWidgetExisted ? widgetStore.selectedSpectralProfilerID : "----"}
                </Button>
            </Popover>
        );

        const queryResultTableProps: TableComponentProps = {
            type: TableType.Normal,
            dataset: widgetStore.queryResult,
            columnHeaders: widgetStore.displayedColumnHeaders,
            numVisibleRows: widgetStore.numDataRows,
            manualSelectionProps: {
                isSelectingAll: widgetStore.isSelectingAllLines,
                isSelectingIndeterminate: widgetStore.isSelectingIndeterminatedLines,
                selectAllLines: widgetStore.selectAllLines,
                selectSingleLine: widgetStore.selectSingleLine
            },
            manualSelectionData: widgetStore.manualSelectionData,
            sortingInfo: widgetStore.sortingInfo,
            updateTableRef: (ref) => { this.resultTableRef = ref; }
        };

        let className = "spectral-line-query-widget";
        if (appStore.darkTheme) {
            className += " dark-theme";
        }

        const isSelectedLinesUnderLimit = widgetStore.selectedLines?.length < PLOT_LINES_LIMIT;
        const hint = (
            <span><br/><i><small>
                {!isSelectedLinesUnderLimit ? `Please select fewer than ${PLOT_LINES_LIMIT} lines.` : ""}
                {!isSelectedLinesUnderLimit && !isSelectedWidgetExisted ? <br/> : ""}
                {!isSelectedWidgetExisted ? "Please select one spectral profiler." : ""}
            </small></i></span>
        );
        const plotTip = <span>Plot lines to selected profiler{hint}</span>;

        return (
            <div className={className}>
                <div className="bp3-dialog-body">
                    {queryPanel}
                    <SplitPane
                        className="body-split-pane"
                        split="horizontal"
                        primary={"second"}
                        defaultSize={"60%"}
                        minSize={"5%"}
                        onChange={this.onTableResize}
                    >
                        <Pane className={"header-table-container"}>
                            {this.width > 0 && this.createHeaderTable()}
                        </Pane>
                        <Pane className={"result-table-container"}>
                            {redshiftPanel}
                            <div className="result-table">
                                {this.width > 0 && <TableComponent {...queryResultTableProps}/>}
                            </div>
                        </Pane>
                    </SplitPane>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="result-table-info"><pre>Showing {widgetStore.numDataRows} entries.{widgetStore.selectedLines?.length > 0 ? ` Selected ${widgetStore.selectedLines.length} lines.` : ""}</pre></div>
                    <div className="bp3-dialog-footer-actions">
                        <FormGroup inline={true} label={this.width < MINIMUM_WIDTH ? "" : "Spectral Profiler"}>
                            {widgetMenu}
                        </FormGroup>
                        <Tooltip content={plotTip} position={Position.BOTTOM}>
                            <AnchorButton
                                text="Plot"
                                intent={Intent.PRIMARY}
                                disabled={!appStore.activeFrame || widgetStore.queryResult.size <= 0 || !isSelectedWidgetExisted || !isSelectedLinesUnderLimit}
                                onClick={this.handlePlot}
                            />
                        </Tooltip>
                        <Tooltip content="Clear plotted lines" position={Position.BOTTOM}>
                            <AnchorButton text="Clear" intent={Intent.PRIMARY} disabled={!appStore.activeFrame || !isSelectedWidgetExisted || widgetStore.queryResult.size <= 0} onClick={this.handleClear}/>
                        </Tooltip>
                    </div>
                </div>
                <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={widgetStore.isQuerying} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null}/>
                    </div>
                </Overlay>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}>
                </ReactResizeDetector>
            </div>
        );
    }
}

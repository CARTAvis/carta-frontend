import * as React from "react";
import ReactResizeDetector from "react-resize-detector";
import SplitPane, {Pane} from "react-split-pane";
import {AnchorButton, Button, Classes, ControlGroup, FormGroup, HTMLSelect, Intent, Menu, Overlay, Position, Spinner, Switch} from "@blueprintjs/core";
import {MenuItem2, Popover2, Tooltip2} from "@blueprintjs/popover2";
import {Cell, Column, Regions, RenderMode, SelectionModes, Table2} from "@blueprintjs/table";
import classNames from "classnames";
import {action, computed, makeObservable, observable} from "mobx";
import {observer} from "mobx-react";

import {FilterableTableComponent, FilterableTableComponentProps, SafeNumericInput} from "components/Shared";
import {AppStore, DefaultWidgetConfig, HelpType, WidgetProps, WidgetsStore} from "stores";
import {RedshiftType, SpectralLineHeaders, SpectralLineQueryRangeType, SpectralLineQueryUnit, SpectralLineQueryWidgetStore} from "stores/Widgets";

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
    private headerTableRef: Table2;
    private resultTableRef: Table2;
    private scrollToTopHandle;

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
        return null;
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
    };

    private handleRedshiftChange = ev => {
        if (ev.type === "keydown" && ev.keyCode !== KEYCODE_ENTER) {
            return;
        }
        const valueString = ev.currentTarget.value;
        const value = parseFloat(valueString);
        const existingValue = this.widgetStore.redshiftInput;
        if (isFinite(value) && value !== existingValue) {
            if ((this.widgetStore.redshiftType === RedshiftType.Z && value >= 0) || this.widgetStore.redshiftType === RedshiftType.V) {
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
                    <Cell className="header-table-cell" key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>
                        {coloumnData[rowIndex]}
                    </Cell>
                )}
            />
        );
    }

    private renderSwitchButtonCell(rowIndex: number, columnName: SpectralLineHeaders) {
        const widgetStore = this.widgetStore;
        const display = widgetStore.controlHeader?.get(columnName)?.display;
        return (
            <Cell className="header-table-cell" key={`cell_switch_${rowIndex}`}>
                <React.Fragment>
                    <Switch className="cell-switch-button" key={`cell_switch_button_${rowIndex}`} checked={display ?? false} onChange={ev => widgetStore.setHeaderDisplay(ev.currentTarget.checked, columnName)} />
                </React.Fragment>
            </Cell>
        );
    }

    private renderButtonColumns(columnName: HeaderTableColumnName, headerNames: SpectralLineHeaders[]) {
        return <Column key={columnName} name={columnName} cellRenderer={rowIndex => this.renderSwitchButtonCell(rowIndex, headerNames[rowIndex])} />;
    }

    private createHeaderTable() {
        const headerNames = [];
        const headerDescriptions = [];
        this.widgetStore.columnHeaders?.forEach(header => {
            headerNames.push(header.name);
            headerDescriptions.push(header.description);
        });
        const tableColumns = [];
        const columnName = this.renderDataColumn(HeaderTableColumnName.Name, headerNames);
        tableColumns.push(columnName);
        const columnDisplaySwitch = this.renderButtonColumns(HeaderTableColumnName.Display, headerNames);
        tableColumns.push(columnDisplaySwitch);
        const columnDescription = this.renderDataColumn(HeaderTableColumnName.Description, headerDescriptions);
        tableColumns.push(columnDescription);

        return (
            <Table2
                ref={ref => (this.headerTableRef = ref)}
                numRows={this.widgetStore.columnHeaders?.length}
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
                cellRendererDependencies={[this.widgetStore.displayedColumnHeaders]} // trigger re-render on controlHeader change
            >
                {tableColumns}
            </Table2>
        );
    }

    private updateHeaderTableColumnSize = (index: number, size: number) => {
        if (this.headerTableColumnWidths) {
            this.headerTableColumnWidths[index] = size;
        }
    };

    private handleEnterWidgetOption = (isEntering: boolean, widgetID: string) => {
        if (widgetID) {
            const hoveredOverWidgetStore = AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(widgetID);
            if (hoveredOverWidgetStore) {
                hoveredOverWidgetStore.setHighlighted(isEntering);
            }
        }
    };

    private handleFilter = () => {
        this.widgetStore.filter();
        clearTimeout(this.scrollToTopHandle);
        this.scrollToTopHandle = setTimeout(() => this.resultTableRef?.scrollToRegion(Regions.row(0)), 20);
    };

    private handleResetFilter = () => {
        this.widgetStore.resetFilter();
        clearTimeout(this.scrollToTopHandle);
        this.scrollToTopHandle = setTimeout(() => this.resultTableRef?.scrollToRegion(Regions.row(0)), 20);
    };

    private handlePlot = () => {
        const widgetStore = this.widgetStore;
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        const lines = widgetStore.getSelectedLines();
        if (widgetStore.selectedSpectralProfilerID && frame && lines?.length > 0) {
            appStore.widgetsStore.getSpectralWidgetStoreByID(widgetStore.selectedSpectralProfilerID)?.addSpectralLines(lines);
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
        // trigger re-render of SpectralLineQueryComponent while reset filter string
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const filters = widgetStore.filters;

        const inputByRange = (
            <React.Fragment>
                <FormGroup label="From" inline={true}>
                    <SafeNumericInput value={widgetStore.queryRange[0]} buttonPosition="none" onValueChange={val => widgetStore.setQueryRange([val, widgetStore.queryRange[1]])} />
                </FormGroup>
                <FormGroup label="To" inline={true}>
                    <SafeNumericInput value={widgetStore.queryRange[1]} buttonPosition="none" onValueChange={val => widgetStore.setQueryRange([widgetStore.queryRange[0], val])} />
                </FormGroup>
            </React.Fragment>
        );

        const inputByCenter = (
            <React.Fragment>
                <FormGroup inline={true}>
                    <SafeNumericInput value={widgetStore.queryRangeByCenter[0]} buttonPosition="none" onValueChange={val => widgetStore.setQueryRangeByCenter([val, widgetStore.queryRangeByCenter[1]])} />
                </FormGroup>
                <FormGroup label="±" inline={true}>
                    <SafeNumericInput value={widgetStore.queryRangeByCenter[1]} buttonPosition="none" onValueChange={val => widgetStore.setQueryRangeByCenter([widgetStore.queryRangeByCenter[0], val])} />
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
                            onChange={ev => widgetStore.setQueryRangeType(ev.currentTarget.value as SpectralLineQueryRangeType)}
                        />
                    </FormGroup>
                    {widgetStore.queryRangeType === SpectralLineQueryRangeType.Range ? inputByRange : inputByCenter}
                    <FormGroup inline={true}>
                        <HTMLSelect options={Object.values(SpectralLineQueryUnit)} value={widgetStore.queryUnit} onChange={ev => widgetStore.setQueryUnit(ev.currentTarget.value as SpectralLineQueryUnit)} />
                    </FormGroup>
                    <ControlGroup className="intensity-limit">
                        <FormGroup label={"Intensity limit"} inline={true}>
                            <Switch checked={widgetStore.intensityLimitEnabled} onChange={() => widgetStore.toggleIntensityLimit()} />
                        </FormGroup>
                        {widgetStore.intensityLimitEnabled && (
                            <Tooltip2 content="CDMS/JPL intensity (log)" position={Position.BOTTOM}>
                                <SafeNumericInput value={widgetStore.intensityLimitValue} buttonPosition="none" onValueChange={val => widgetStore.setIntensityLimitValue(val)} />
                            </Tooltip2>
                        )}
                    </ControlGroup>
                </div>
                <div>
                    <Button intent={Intent.PRIMARY} onClick={widgetStore.query}>
                        Query
                    </Button>
                </div>
            </div>
        );

        const redshiftPanel = (
            <div className="redshift-panel">
                <FormGroup inline={true}>
                    <HTMLSelect options={[RedshiftType.V, RedshiftType.Z]} value={widgetStore.redshiftType} onChange={ev => widgetStore.setRedshiftType(ev.currentTarget.value as RedshiftType)} />
                </FormGroup>
                <FormGroup inline={true}>
                    <SafeNumericInput value={widgetStore.redshiftInput} buttonPosition="none" onBlur={this.handleRedshiftChange} onKeyDown={this.handleRedshiftChange} />
                </FormGroup>
            </div>
        );

        const isSelectedWidgetExisted = widgetStore.selectedSpectralProfilerID && AppStore.Instance.widgetsStore.getSpectralWidgetStoreByID(widgetStore.selectedSpectralProfilerID);
        const widgetMenu = (
            <Popover2
                content={
                    <Menu>
                        {AppStore.Instance.widgetsStore.spectralProfilerList.map(widgetID => (
                            <MenuItem2
                                key={widgetID}
                                text={widgetID}
                                onMouseEnter={() => this.handleEnterWidgetOption(true, widgetID)}
                                onMouseLeave={() => this.handleEnterWidgetOption(false, widgetID)}
                                onClick={() => {
                                    this.handleEnterWidgetOption(false, widgetID);
                                    widgetStore.setSelectedSpectralProfiler(widgetID);
                                }}
                            />
                        ))}
                    </Menu>
                }
                position={Position.BOTTOM}
                minimal={true}
            >
                <Button disabled={AppStore.Instance.widgetsStore.spectralProfilerList.length <= 0} rightIcon="caret-down">
                    {isSelectedWidgetExisted ? widgetStore.selectedSpectralProfilerID : "----"}
                </Button>
            </Popover2>
        );

        const queryResultTableProps: FilterableTableComponentProps = {
            filter: widgetStore.controlHeader,
            dataset: widgetStore.filterResult,
            columnHeaders: widgetStore.displayedColumnHeaders,
            // Workaround for disappearing scroll(+3), should be a bug of BlueprintJS in <table>.
            // The filter header hight is 60px and occupies the hight of 3 rows(20px/row)
            numVisibleRows: widgetStore.numVisibleRows > 0 ? widgetStore.numVisibleRows + 3 : widgetStore.numVisibleRows,
            flipRowSelection: widgetStore.selectSingleLine,
            updateTableRef: ref => {
                this.resultTableRef = ref;
            },
            disableSort: true,
            updateColumnFilter: widgetStore.setColumnFilter,
            columnWidths: widgetStore.resultTableColumnWidths,
            updateTableColumnWidth: widgetStore.setResultTableColumnWidth,
            tableHeaders: widgetStore.columnHeaders
        };

        const className = classNames("spectral-line-query-widget", {"bp4-dark": appStore.darkTheme});
        const isSelectedLinesUnderLimit = widgetStore.numSelectedLines <= PLOT_LINES_LIMIT;

        const hint = (
            <span>
                <br />
                <i>
                    <small>
                        {!isSelectedLinesUnderLimit ? `Please select no greater than ${PLOT_LINES_LIMIT} lines.` : ""}
                        {!isSelectedLinesUnderLimit && !isSelectedWidgetExisted ? <br /> : ""}
                        {!isSelectedWidgetExisted ? "Please select one spectral profiler." : ""}
                    </small>
                </i>
            </span>
        );
        const plotTip = <span>Plot lines to selected profiler{hint}</span>;

        return (
            <div className={className}>
                <div className="bp4-dialog-body">
                    {queryPanel}
                    <SplitPane className="body-split-pane" split="horizontal" primary={"second"} defaultSize={"60%"} minSize={"5%"} onChange={this.onTableResize}>
                        <Pane className={"header-table-container"}>{this.width > 0 && this.createHeaderTable()}</Pane>
                        <Pane className={"result-table-container"}>
                            {redshiftPanel}
                            <div className="result-table">{this.width > 0 && <FilterableTableComponent {...queryResultTableProps} />}</div>
                        </Pane>
                    </SplitPane>
                </div>
                <div className="bp4-dialog-footer">
                    <div className="result-table-info">
                        <pre>{widgetStore.resultTableInfo}</pre>
                    </div>
                    <div className="bp4-dialog-footer-actions">
                        <FormGroup inline={true} label={this.width < MINIMUM_WIDTH ? "" : "Spectral profiler"}>
                            {widgetMenu}
                        </FormGroup>
                        <Tooltip2 content="Apply filter" position={Position.BOTTOM}>
                            <AnchorButton text="Filter" intent={Intent.PRIMARY} disabled={widgetStore.numDataRows <= 0} onClick={this.handleFilter} />
                        </Tooltip2>
                        <Tooltip2 content="Reset filter" position={Position.BOTTOM}>
                            <AnchorButton text="Reset" intent={Intent.PRIMARY} onClick={this.handleResetFilter} />
                        </Tooltip2>
                        <Tooltip2 content={plotTip} position={Position.BOTTOM}>
                            <AnchorButton text="Plot" intent={Intent.PRIMARY} disabled={!appStore.activeFrame || widgetStore.filterResult.size <= 0 || !isSelectedWidgetExisted || !isSelectedLinesUnderLimit} onClick={this.handlePlot} />
                        </Tooltip2>
                        <Tooltip2 content="Clear plotted lines" position={Position.BOTTOM}>
                            <AnchorButton text="Clear" intent={Intent.PRIMARY} disabled={!appStore.activeFrame || !isSelectedWidgetExisted || widgetStore.filterResult.size <= 0} onClick={this.handleClear} />
                        </Tooltip2>
                    </div>
                </div>
                <Overlay className={Classes.OVERLAY_SCROLL_CONTAINER} autoFocus={true} canEscapeKeyClose={false} canOutsideClickClose={false} isOpen={widgetStore.isQuerying} usePortal={false}>
                    <div className="query-loading-overlay">
                        <Spinner intent={Intent.PRIMARY} size={30} value={null} />
                    </div>
                </Overlay>
                <ReactResizeDetector handleWidth handleHeight onResize={this.onResize} refreshMode={"throttle"} refreshRate={33}></ReactResizeDetector>
            </div>
        );
    }
}

import * as React from "react";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, ColumnHeaderCell, IRegion} from "@blueprintjs/table";
import {Checkbox, Popover, PopoverInteractionKind, InputGroup, Icon, Label} from "@blueprintjs/core";
import {IconName} from "@blueprintjs/icons";
import {IRowIndices} from "@blueprintjs/table/lib/esm/common/grid";
import {CARTA} from "carta-protobuf";
import {ControlHeader} from "stores";
import {ProcessedColumnData} from "models";
import "./TableComponent.scss";

export type ColumnFilter = { index: number, columnFilter: string };

export enum TableType {
    Normal,
    ColumnFilter
}

export interface ManualSelectionProps {
    isSelectingAll: boolean;
    isSelectingIndeterminate: boolean;
    selectAllLines: () => void;
    selectSingleLine: (rowIndex: number) => void;
}

export class TableComponentProps {
    dataset: Map<number, ProcessedColumnData>;
    filter?: Map<string, ControlHeader>;
    columnHeaders: Array<CARTA.CatalogHeader>;
    numVisibleRows: number;
    columnWidths?: Array<number>;
    type: TableType;
    loadingCell?: boolean;
    selectedDataIndex?: number[];
    showSelectedData?: boolean;
    manualSelectionProps?: ManualSelectionProps;
    manualSelectionData?: boolean[];
    updateTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateByInfiniteScroll?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
    updateSelectedRow?: (dataIndex: number[]) => void;
    updateSortRequest?: (columnName: string, sortingType: CARTA.SortingType) => void;
    sortingInfo?: {columnName: string, sortingType: CARTA.SortingType};
    disable?: boolean;
    darkTheme?: boolean;
    tableHeaders?: Array<CARTA.ICatalogHeader>;
}

const MANUAL_SELECTION_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 150;

@observer
export class TableComponent extends React.Component<TableComponentProps> {
    private readonly SortingTypelinkedList = {
        head: {
            value: null,
            next: {
                value: CARTA.SortingType.Ascending,                                             
                next: {
                    value: CARTA.SortingType.Descending,
                    next: null
                }
            }
        }
    };

    private renderManualSelectionColumn = (manualSelectionProps: ManualSelectionProps, manualSelectionData: boolean[]) => {
        if (!manualSelectionProps || !manualSelectionData || manualSelectionData.length <= 0) {
            return null;
        }

        const columnName = "select";
        return (
            <Column
                key={columnName}
                name={columnName}
                columnHeaderCellRenderer={() => {
                    return (
                        <ColumnHeaderCell>
                            <React.Fragment>
                                <Checkbox
                                    indeterminate={manualSelectionProps.isSelectingIndeterminate}
                                    checked={manualSelectionProps.isSelectingAll}
                                    inline={true}
                                    onChange={manualSelectionProps.selectAllLines}
                                />
                            </React.Fragment>
                        </ColumnHeaderCell>
                    );
                }}
                cellRenderer={(rowIndex, columnIndex) => {
                    return (
                        <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={false}>
                            <React.Fragment>
                                <Checkbox
                                    checked={manualSelectionData[rowIndex] || false}
                                    onChange={() => manualSelectionProps.selectSingleLine(rowIndex)}
                                />
                            </React.Fragment>
                        </Cell>
                    );
                }}
            />
        );
    };

    private getfilterSyntax = (dataType: CARTA.ColumnType) => {
        switch (dataType) {
            case CARTA.ColumnType.String || CARTA.ColumnType.Bool:
                return (
                    <div className={"column-popover-content"}>
                        <small>Filter by substring</small><br/>
                        <small>e.g. gal (no quotation, entries contain the "gal" string)</small>
                    </div>
                );
            default:
                return (
                    <div className={"column-popover-content"}>
                        <small>Operators: {">"}, {">="}, {"<"}, {"<="}, {"=="}, {"!="}, {".."}, {"..."}</small><br/>
                        <small>e.g. {"<"} 10 (everything less than 10) </small><br/>
                        <small>e.g. == 1.23 (entries equal to 1.23) </small><br/>
                        <small>e.g. 10..50 (everything between 10 and 50, exclusive)) </small><br/>
                        <small>e.g. 10...50 (everything between 10 and 50, inclusive) </small>
                    </div>
                );
        }
    }

    private renderDataColumnWithFilter = (column: CARTA.CatalogHeader, columnData: any) => {
        return (
            <Column
                key={column.name}
                name={column.name}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, column)}
                cellRenderer={columnData?.length ? (rowIndex, columnIndex) => this.renderCell(rowIndex, columnIndex, columnData) : undefined}
            />
        );
    };

    private renderCell = (rowIndex: number, columnIndex: number, columnData: any) => {
        const dataIndex = this.props.selectedDataIndex;
        if (dataIndex && dataIndex.includes(rowIndex) && !this.props.showSelectedData) {
            return <Cell key={`cell_${columnIndex}_${rowIndex}`} intent={"danger"} loading={this.isLoading(rowIndex)} interactive={false}>{columnData[rowIndex]}</Cell>;
        } else {
            return <Cell key={`cell_${columnIndex}_${rowIndex}`} loading={this.isLoading(rowIndex)} interactive={false}>{columnData[rowIndex]}</Cell>;
        }
    };

    private getNextSortingType = () => {
        const sortingInfo = this.props.sortingInfo;
        let currentNode = this.SortingTypelinkedList.head;
        while (currentNode.next) {
            if (currentNode.value === sortingInfo.sortingType) {
                return currentNode.next.value;
            }
            currentNode = currentNode.next;
        }
        return null;
    }

    private renderColumnHeaderCell = (columnIndex: number, column: CARTA.CatalogHeader) => {
        if (!isFinite(columnIndex) || !column) {
            return null;
        }
        const controlheader = this.props.filter.get(column.name);
        const filterSyntax = this.getfilterSyntax(column.dataType);
        const sortingInfo = this.props.sortingInfo;
        const sortColumn = sortingInfo.columnName === column.name;
        let activeFilter = false;
        if (controlheader.filter !== "") {
            activeFilter = true;
        }
        const headerDescription = this.props.tableHeaders[controlheader.dataIndex].description;
        
        const disable = this.props.disable;
        let popOverClass = this.props.darkTheme ? "column-popover-dark" : "column-popover";

        const nameRenderer = () => {
            // sharing css with fileList table
            let sortIcon = "sort";
            let iconClass = "sort-icon inactive";
            let nextSortType = 0;
            if (sortColumn) {
                nextSortType = this.getNextSortingType();
                if (sortingInfo.sortingType === CARTA.SortingType.Descending) {
                    sortIcon = "sort-desc";
                    iconClass = "sort-icon";
                } else if (sortingInfo.sortingType === CARTA.SortingType.Ascending) {
                    sortIcon = "sort-asc";
                    iconClass = "sort-icon";
                }
            }
            return (
                <div className="sort-label" onClick={() => disable ? null : this.props.updateSortRequest(column.name, nextSortType)}>
                    <Label disabled={disable} className="bp3-inline label">
                        <Icon className={iconClass} icon={sortIcon as IconName}/>
                        <Popover 
                            hoverOpenDelay={250} 
                            hoverCloseDelay={0} 
                            className={"column-popover"} 
                            popoverClassName={popOverClass} 
                            content={headerDescription? headerDescription : "Description not avaliable"} 
                            interactionKind={PopoverInteractionKind.HOVER}
                        >
                            {column.name}
                        </Popover>
                    </Label>
                </div>
            );
        };

        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell className={"column-name"} nameRenderer={nameRenderer}/>
                <ColumnHeaderCell isActive={activeFilter}>
                    <Popover hoverOpenDelay={250} hoverCloseDelay={0} className={"column-popover"} popoverClassName={popOverClass} content={filterSyntax} interactionKind={PopoverInteractionKind.HOVER}>
                        <InputGroup
                            key={"column-popover-" + columnIndex}
                            small={true}
                            placeholder="Click to filter"
                            value={controlheader && controlheader.filter ? controlheader.filter : ""} 
                            onChange={ev => this.props.updateColumnFilter(ev.currentTarget.value, column.name)}
                        />
                    </Popover>
                </ColumnHeaderCell>
            </ColumnHeaderCell>
        );
    };

    private isLoading(rowIndex: number): boolean {
        if (this.props.loadingCell && rowIndex + 4 > this.props.numVisibleRows) {
            return true;
        }
        return false;
    }

    private infiniteScroll = (rowIndices: IRowIndices) => {
        // rowIndices offset around 5 form blueprintjs tabel
        const currentIndex = rowIndices.rowIndexEnd + 1;
        if (rowIndices.rowIndexEnd > 0 && currentIndex >= this.props.numVisibleRows && !this.props.loadingCell && !this.props.showSelectedData) {
            this.props.updateByInfiniteScroll(rowIndices.rowIndexEnd);
        }
    };

    private renderDataColumn(columnName: string, columnData: any) {
        return (
            <Column
                key={columnName}
                name={columnName}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>{rowIndex < columnData?.length ? columnData[rowIndex] : undefined}</Cell>
                )}
            />
        );
    }

    private updateTableColumnWidth = (index: number, size: number) => {
        const header = this.props.columnHeaders[index];
        if (header && this.props.updateTableColumnWidth) {
            this.props.updateTableColumnWidth(size, header.name);
        }
    };

    private onRowIndexSelection = (selectedRegions: IRegion[]) => {
        if (selectedRegions.length > 0) {
            let selectedDataIndex = [];
            for (let i = 0; i < selectedRegions.length; i++) {
                const region = selectedRegions[i];
                const start = region.rows[0];
                const end = region.rows[1];
                if (start === end) {
                    selectedDataIndex.push(start);
                } else {
                    for (let j = start; j <= end; j++) {
                        selectedDataIndex.push(j);
                    }
                } 
            }
            this.props.updateSelectedRow(selectedDataIndex);
        }
    };

    render() {
        const table = this.props;
        const tableColumns = [];
        const tableData = table.dataset;
        let columnWidths = table.columnWidths ? table.columnWidths : new Array<number>(table.columnHeaders?.length).fill(DEFAULT_COLUMN_WIDTH);

        // Create manuanl selection checkbox column
        if (table.manualSelectionProps && table.manualSelectionData?.length > 0) {
            const column = this.renderManualSelectionColumn(table.manualSelectionProps, table.manualSelectionData);
            tableColumns.push(column);
            columnWidths.splice(0, 0, MANUAL_SELECTION_COLUMN_WIDTH);
        }

        for (let index = 0; index < table.columnHeaders.length; index++) {
            const header = table.columnHeaders[index];
            const columnIndex = header.columnIndex;
            let dataArray = tableData.get(columnIndex)?.data;

            if (table.type === TableType.ColumnFilter) {
                const column = this.renderDataColumnWithFilter(header, dataArray);
                tableColumns.push(column);
            } else if (table.type === TableType.Normal) {
                const column = this.renderDataColumn(header.name, dataArray);
                tableColumns.push(column);
            }
        }

        if (table.type === TableType.ColumnFilter) {
            return (
                <Table
                    className={"column-filter-table"}
                    ref={table.updateTableRef ? (ref) => table.updateTableRef(ref) : null}
                    numRows={table.numVisibleRows}
                    renderMode={RenderMode.BATCH}
                    enableRowReordering={false}
                    selectionModes={SelectionModes.ROWS_AND_CELLS}
                    onVisibleCellsChange={this.infiniteScroll}
                    onColumnWidthChanged={this.updateTableColumnWidth}
                    enableGhostCells={true}
                    onSelection={this.onRowIndexSelection}
                    enableMultipleSelection={true}
                    enableRowResizing={false}
                    columnWidths={columnWidths}
                >
                    {tableColumns}
                </Table>
            );
        } else {
            return (
                <Table
                    ref={table.updateTableRef ? (ref) => table.updateTableRef(ref) : null}
                    numRows={table.numVisibleRows}
                    renderMode={RenderMode.NONE}
                    enableRowReordering={false}
                    selectionModes={SelectionModes.NONE}
                    enableGhostCells={true}
                    enableRowResizing={false}
                    columnWidths={columnWidths}
                >
                    {tableColumns}
                </Table>
            );
        }
    }
}

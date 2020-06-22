import * as React from "react";
import {observer} from "mobx-react";
import {Checkbox} from "@blueprintjs/core";
import {Cell, Column, ColumnHeaderCell, EditableCell, IRegion, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import {IRowIndices} from "@blueprintjs/table/lib/esm/common/grid";
import {CARTA} from "carta-protobuf";
import {ControlHeader} from "stores/widgets";
import {ProcessedColumnData} from "models";
import "./TableComponent.css";

export type ColumnFilter = { index: number, columnFilter: string };

export enum TableType {
    Normal,
    ColumnFilter
}

export interface ManualSelectionProps {
    isSelectingAll: boolean;
    isSelectingIndeterminated: boolean;
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
    upTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateByInfiniteScroll?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
    updateSelectedRow?: (dataIndex: number) => void;
}

@observer
export class TableComponent extends React.Component<TableComponentProps> {

    private renderManualSelectionColumn = (manualSelectionProps: ManualSelectionProps, manualSelectionData: boolean[]) => {
        if (!manualSelectionProps || !manualSelectionData || manualSelectionData.length <= 0) {
            return null;
        }

        const columnName = "select";
        const controlheader = this.props.filter.get(columnName);
        return (
            <Column
                key={columnName}
                name={columnName}
                columnHeaderCellRenderer={(columnIndex: number) => {
                    return (
                        <ColumnHeaderCell>
                            <ColumnHeaderCell isActive={true}>
                                <EditableCell
                                    className={"column-filter"}
                                    key={"column-filter-" + columnIndex}
                                    intent={"primary"}
                                    onChange={((value: string) => this.props.updateColumnFilter(value, columnName))}
                                    value={controlheader && controlheader.filter ? controlheader.filter : ""}
                                />
                            </ColumnHeaderCell>
                            <ColumnHeaderCell>
                                <React.Fragment>
                                    <Checkbox
                                        indeterminate={manualSelectionProps.isSelectingIndeterminated}
                                        checked={manualSelectionProps.isSelectingAll}
                                        inline={true}
                                        onChange={manualSelectionProps.selectAllLines}
                                    />
                                </React.Fragment>
                            </ColumnHeaderCell>
                        </ColumnHeaderCell>
                    );
                }}
                cellRenderer={(rowIndex, columnIndex) => {
                    return (
                        <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={false}>
                            <React.Fragment>
                                <Checkbox
                                    checked={manualSelectionData[rowIndex]}
                                    onChange={() => manualSelectionProps.selectSingleLine(rowIndex)}
                                />
                            </React.Fragment>
                        </Cell>
                    );
                }}
            />
        );
    };

    private renderDataColumnWithFilter = (columnName: string, columnData: any) => {
        return (
            <Column
                key={columnName}
                name={columnName}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, columnName)}
                cellRenderer={columnData ? (rowIndex, columnIndex) => this.renderCell(rowIndex, columnIndex, columnData) : undefined}
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

    private renderColumnHeaderCell = (columnIndex: number, columnName: string) => {
        const controlheader = this.props.filter.get(columnName);
        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell isActive={true}>
                    <EditableCell
                        className={"column-filter"}
                        key={"column-filter-" + columnIndex}
                        intent={"primary"}
                        onChange={((value: string) => this.props.updateColumnFilter(value, columnName))}
                        value={controlheader && controlheader.filter ? controlheader.filter : ""}
                    />
                </ColumnHeaderCell>
                <ColumnHeaderCell name={columnName}/>
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

    private updateTableColumnWidth = (index: number, size: number) => {
        const header = this.props.columnHeaders[index];
        if (header && this.props.updateTableColumnWidth) {
            this.props.updateTableColumnWidth(size, header.name);
        }
    };

    private onRowIndexSelection = (selectedRegions: IRegion[]) => {
        if (selectedRegions.length > 0) {
            this.props.updateSelectedRow(selectedRegions[0].rows["0"]);
        }
    };

    render() {
        const table = this.props;
        const tableColumns = [];
        const tableData = table.dataset;

        // Create manuanl selection checkbox column
        if (table.manualSelectionProps && table.manualSelectionData && table.dataset && table.dataset.size > 0) {
            const column = this.renderManualSelectionColumn(table.manualSelectionProps, table.manualSelectionData);
            tableColumns.push(column);
        }

        for (let index = 0; index < table.columnHeaders.length; index++) {
            const header = table.columnHeaders[index];
            const columnIndex = header.columnIndex;
            let dataArray = tableData.get(columnIndex)?.data;

            if (table.type === TableType.ColumnFilter) {
                const column = this.renderDataColumnWithFilter(header.name, dataArray);
                tableColumns.push(column);
            } else if (table.type === TableType.Normal) {
                const column = this.renderDataColumn(header.name, dataArray);
                tableColumns.push(column);
            }
        }

        const tableComponent = table.type === TableType.ColumnFilter ? (
            <Table
                ref={(ref) => table.upTableRef(ref)}
                numRows={table.numVisibleRows}
                renderMode={RenderMode.BATCH}
                enableRowReordering={false}
                selectionModes={SelectionModes.ROWS_AND_CELLS}
                onVisibleCellsChange={this.infiniteScroll}
                columnWidths={table.columnWidths}
                onColumnWidthChanged={this.updateTableColumnWidth}
                enableGhostCells={true}
                onSelection={this.onRowIndexSelection}
                enableMultipleSelection={false}
                enableRowResizing={false}
            >
                {tableColumns}
            </Table>
        ) : (
            <Table
                numRows={table.numVisibleRows}
                renderMode={RenderMode.NONE}
                enableRowReordering={false}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={true}
                enableRowResizing={false}
            >
                {tableColumns}
            </Table>
        );

        return (
            <div className={"table"}>
                {tableComponent}
            </div>
        );
    }
}

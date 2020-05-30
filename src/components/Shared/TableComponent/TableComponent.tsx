import * as React from "react";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, ColumnHeaderCell, EditableCell, IRegion} from "@blueprintjs/table";
import {Tooltip} from "@blueprintjs/core";
import {IRowIndices} from "@blueprintjs/table/lib/esm/common/grid";
import {CARTA} from "carta-protobuf";
import {ControlHeader} from "stores/widgets";
import {ProcessedColumnData} from "models";

export type ColumnFilter = { index: number, columnFilter: string };

export enum TableType {
    Normal,
    ColumnFilter
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
    upTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateByInfiniteScroll?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
    updateSelectedRow?: (dataIndex: number[]) => void;
}

@observer
export class TableComponent extends React.Component<TableComponentProps> {

    private getfilterSyntax = (dataType: CARTA.ColumnType) => {
        switch (dataType) {
            case CARTA.ColumnType.String || CARTA.ColumnType.Bool:
                return ("Filter by substring");
            default:
                return ("Operators  >, >=, <, <=, ==, !=, .., ...");
        }
    }

    private renderDataColumnWithFilter = (column: CARTA.CatalogHeader, columnData: any) => {
        return (
            <Column
                key={column.name}
                name={column.name}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, column)}
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

    private renderColumnHeaderCell = (columnIndex: number, column: CARTA.CatalogHeader) => {
        const controlheader = this.props.filter.get(column.name);
        const filterSyntax = this.getfilterSyntax(column.dataType);
        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell name={column.name}/>
                <ColumnHeaderCell isActive={true}>  
                    <Tooltip content={filterSyntax}>
                        <EditableCell
                            className={"column-filter"}
                            key={"column-filter-" + columnIndex}
                            onChange={((value: string) => this.props.updateColumnFilter(value, column.name))}
                            value={controlheader.filter ? controlheader.filter : "Double click to filter"}
                        />
                    </Tooltip>
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
        if (header) {
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
                    className={"column-filter"}
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
                    enableMultipleSelection={true}
                    enableRowResizing={false}
                >
                    {tableColumns}
                </Table>
            );
        } else {
            return (
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
        }
    }
}
import * as React from "react";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, ColumnHeaderCell, EditableCell} from "@blueprintjs/table";
import {ControlHeader} from "stores/widgets";
import {getTableDataByType} from "utilities";

export type ColumnFilter = { index: number, columnFilter: string };

export enum TableType {
    Normal,
    ColumnFilter
}

export class TableComponentProps {
    dataset: CARTA.ICatalogColumnsData;
    filter?: Map<string, ControlHeader>;
    columnHeaders: Array<CARTA.CatalogHeader>;
    numVisibleRows: number;
    columnWidts?: Array<number>;
    type: TableType;
    loadingCell?: boolean;
    selectedDataIndex?: number[];
    upTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateTableData?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
}

@observer
export class TableComponent extends React.Component<TableComponentProps> {

    private renderDataColumnWithFilter = (columnName: string, coloumnData: any) => {
        return (
            <Column 
                key={columnName} 
                name={columnName} 
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, columnName)} 
                cellRenderer={(rowIndex, columnIndex) => this.renderCell(rowIndex, columnIndex, coloumnData)}
            />
        );
    }

    private renderCell = (rowIndex: number, columnIndex: number, coloumnData: any) => {
        const dataIndex = this.props.selectedDataIndex;
        if (dataIndex && dataIndex.includes(rowIndex)) {
            return <Cell key={`cell_${columnIndex}_${rowIndex}`} intent={"danger"} loading={this.isLoading(rowIndex)} interactive={true}>{coloumnData[rowIndex]}</Cell>;
        }
        return <Cell key={`cell_${columnIndex}_${rowIndex}`} loading={this.isLoading(rowIndex)} interactive={true}>{coloumnData[rowIndex]}</Cell>;
    }

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
                        value={controlheader.filter ? controlheader.filter : ""}
                    />
                </ColumnHeaderCell> 
                <ColumnHeaderCell name={columnName}/>
            </ColumnHeaderCell>
            
        );
    }

    private isLoading(rowIndex: number): boolean {
        if (this.props.loadingCell && rowIndex + 4 > this.props.numVisibleRows) {
            return true;
        }
        return false;
    }

    private infiniteLoad(rowIndexEnd: number, numVisibleRows: number) {
        const currentIndex = rowIndexEnd + 1;
        if (rowIndexEnd > 0 && currentIndex >= numVisibleRows && !this.props.loadingCell) {
            this.props.updateTableData(rowIndexEnd);
        }
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

    private updateTableColumnWidth = (index: number, size: number) => {
        const header = this.props.columnHeaders[index];
        if (header) {
            this.props.updateTableColumnWidth(size, header.name);
        }
    }

    render() {
        const table = this.props;
        const tableColumns = [];
        const tableData = table.dataset;
        for (let index = 0; index < table.columnHeaders.length; index++) {
            const header = table.columnHeaders[index];
            const dataType = header.dataType;
            const dataIndex = header.dataTypeIndex;
            const dataArray = getTableDataByType(tableData, dataType, dataIndex);
            if (table.type === TableType.ColumnFilter) {
                const column = this.renderDataColumnWithFilter(header.name, dataArray);
                tableColumns.push(column); 
            } else if (table.type === TableType.Normal) {
                const column = this.renderDataColumn(header.name, dataArray);
                tableColumns.push(column);
            }  
        }

        if (table.type === TableType.ColumnFilter) {
            return (
                <Table
                    ref={(ref) => table.upTableRef(ref)}
                    numRows={table.numVisibleRows}
                    renderMode={RenderMode.NONE}
                    enableRowReordering={false}
                    selectionModes={SelectionModes.NONE}
                    onVisibleCellsChange={(rowIndices) => this.infiniteLoad(rowIndices.rowIndexEnd, table.numVisibleRows)}
                    columnWidths={table.columnWidts}
                    onColumnWidthChanged={this.updateTableColumnWidth}
                    enableGhostCells={true}
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
                >
                    {tableColumns}
                </Table>
            );
        }
    }
}
import * as React from "react";
import {CARTA} from "carta-protobuf";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, ColumnHeaderCell, EditableCell, TableLoadingOption} from "@blueprintjs/table";
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
    upTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateTableData?: (rowIndexEnd: number) => void;
}

@observer
export class TableComponent extends React.Component<TableComponentProps> {

    private renderDataColumnWithFilter = (columnName: string, coloumnData: any) => {
        return (
            <Column 
                key={columnName} 
                name={columnName} 
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, columnName)} 
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>{coloumnData[rowIndex]}</Cell>
                    )}
            />
        );
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

    private getLoadingOptions() {
        const loadingOptions: TableLoadingOption[] = [];
        if (this.props.loadingCell) {
            loadingOptions.push(TableLoadingOption.CELLS);
        }
        return loadingOptions;
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
                    loadingOptions={this.getLoadingOptions()}
                    onVisibleCellsChange={(rowIndices) => this.infiniteLoad(rowIndices.rowIndexEnd, table.numVisibleRows)}
                    columnWidths={table.columnWidts}
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
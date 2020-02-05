import * as React from "react";
import {observer} from "mobx-react";
import {Cell, Column, Table, Utils, SelectionModes, RenderMode, ColumnHeaderCell, EditableCell, TableLoadingOption} from "@blueprintjs/table";
import {ControlHeader} from "stores/widgets";
import {CARTA} from "carta-protobuf";

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
    updateRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    setNumVisibleRows?: (val: number) => void;
    updateTable?: (updateRowNumber: number) => void;
    loadingCell?: boolean;
    updateSpeed?: number;
    tableSize?: number;
}

@observer
export class TableComponent extends React.Component<TableComponentProps> {
    
    private getDataByType (columnsData: CARTA.ICatalogColumnsData, dataType: CARTA.EntryType, index: number) {
        switch (dataType) {
            case CARTA.EntryType.INT:
                return columnsData.intColumn[index].intColumn;
            case CARTA.EntryType.STRING:
                return columnsData.stringColumn[index].stringColumn;
            case CARTA.EntryType.BOOL:
                return columnsData.boolColumn[index].boolColumn;
            case CARTA.EntryType.DOUBLE:
                    return columnsData.doubleColumn[index].doubleColumn;
            case CARTA.EntryType.FLOAT:
                return columnsData.floatColumn[index].floatColumn;   
            case CARTA.EntryType.LONGLONG:
                return columnsData.llColumn[index].llColumn;      
            default:
                return [];
        }
    }

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
                        value={controlheader.filter}
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

    // private infiniteLoad(rowIndexEnd: number, numVisibleRows: number) {
    //     // incorrect rowIndices, bliuprintjs table bug https://github.com/palantir/blueprint/issues/3341
    //     const props = this.props;
    //     // console.log(rowIndexEnd)
    //     if (props.updateTable && props.updateSpeed && rowIndexEnd + 1 >= numVisibleRows) {
    //         props.updateTable(numVisibleRows + props.updateSpeed);
    //         props.setNumVisibleRows(numVisibleRows + props.updateSpeed);
    //     }
    // }

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
            const dataArray = this.getDataByType(tableData, dataType, dataIndex);

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
                    ref={(ref) => table.updateRef(ref)}
                    numRows={table.numVisibleRows}
                    renderMode={RenderMode.BATCH}
                    enableRowReordering={false}
                    selectionModes={SelectionModes.NONE}
                    loadingOptions={this.getLoadingOptions()}
                    // onVisibleCellsChange={(rowIndices) => this.infiniteLoad(rowIndices.rowIndexEnd, table.numVisibleRows)}
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
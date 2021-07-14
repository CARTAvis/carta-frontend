import * as React from "react";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, RowHeaderCell} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";

export class SimpleTableComponentProps {
    dataset: Map<number, any>;
    columnHeaders: Array<CARTA.CatalogHeader>;
    numVisibleRows: number;
    defaultColumnWidths?: Array<number>;
    defaultRowHeight?: number;
    enableGhostCells?: boolean;
    isIndexZero?: boolean;
    updateTableRef?: (ref: Table) => void;
}

@observer
export class SimpleTableComponent extends React.Component<SimpleTableComponentProps> {
    private widths: number[] = this.props.defaultColumnWidths;

    private onColumnWidthChanged = (index: number, size: number) => {
        if (!Number.isInteger(index) || index < 0 || index >= this.widths.length || size <= 0) {
            return;
        }
        this.widths[index] = size;
    };

    private renderRowHeaderCell = (rowIndex: number) => {
        return <RowHeaderCell name={rowIndex.toString()} />;
    };

    private renderDataColumn = (columnName: string, columnData: any) => {
        return (
            <Column
                key={columnName}
                name={columnName}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={true}>
                        {rowIndex < columnData?.length ? columnData[rowIndex] : undefined}
                    </Cell>
                )}
            />
        );
    };

    render() {
        const table = this.props;
        const tableColumns = [];
        const tableData = table.dataset;

        table.columnHeaders?.forEach(header => {
            const columnIndex = header.columnIndex;
            let dataArray = tableData.get(columnIndex)?.data;
            const column = this.renderDataColumn(header.name, dataArray);
            tableColumns.push(column);
        });

        return (
            <Table
                ref={table.updateTableRef ? ref => table.updateTableRef(ref) : null}
                numRows={table.numVisibleRows}
                renderMode={RenderMode.NONE}
                enableRowReordering={false}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={this.props.enableGhostCells ?? true}
                defaultRowHeight={this.props.defaultRowHeight}
                rowHeaderCellRenderer={this.props.isIndexZero ? this.renderRowHeaderCell : null}
                enableRowResizing={false}
                columnWidths={this.widths}
                onColumnWidthChanged={this.onColumnWidthChanged}
            >
                {tableColumns}
            </Table>
        );
    }
}

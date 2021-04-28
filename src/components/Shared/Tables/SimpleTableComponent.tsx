import * as React from "react";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import {ProcessedColumnData} from "models";

export class SimpleTableComponentProps {
    dataset: Map<number, ProcessedColumnData>;
    columnHeaders: Array<CARTA.CatalogHeader>;
    numVisibleRows: number;
    columnWidths?: Array<number>;
    updateTableRef?: (ref: Table) => void;
}

@observer
export class SimpleTableComponent extends React.Component<SimpleTableComponentProps> {
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
                ref={table.updateTableRef ? (ref) => table.updateTableRef(ref) : null}
                numRows={table.numVisibleRows}
                renderMode={RenderMode.NONE}
                enableRowReordering={false}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={true}
                enableRowResizing={false}
                columnWidths={table.columnWidths}
            >
                {tableColumns}
            </Table>
        );
    }
}

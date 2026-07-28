import type {CSSProperties} from "react";
import * as React from "react";
import {Cell, Column, RenderMode, RowHeaderCell, SelectionModes, Table} from "@blueprintjs/table";
import {type CARTA} from "carta-protobuf";
import {observer} from "mobx-react";

export class SimpleTableComponentProps {
    dataset: Map<number, any>;
    columnHeaders: Array<CARTA.CatalogHeader>;
    numVisibleRows: number;
    columnWidths?: Array<number>;
    onColumnWidthChanged?: (index: number, size: number) => void;
    defaultRowHeight?: number;
    areGhostCellsEnabled?: boolean;
    isIndexZero?: boolean;
    boldIndex?: number[];
    updateTableRef?: (ref: Table) => void;
    tooltipIndex?: number;
    cellRendererDependencies?: React.DependencyList;
}

@observer
export class SimpleTableComponent extends React.Component<SimpleTableComponentProps> {
    private getFontStyle = (rowIndex: number): CSSProperties | undefined => {
        return this.props.boldIndex?.includes(rowIndex) ? {fontWeight: "bold"} : undefined;
    };

    private renderRowHeaderCell = (rowIndex: number) => {
        const index = this.props.isIndexZero ? rowIndex : rowIndex + 1;
        return <RowHeaderCell name={index.toString()} style={this.getFontStyle(rowIndex)} />;
    };

    private getTooltip = (columnData: any, columnIndex: number, rowIndex: number) => {
        const tooltip = rowIndex < columnData?.length ? columnData[rowIndex] : undefined;
        return typeof this.props.tooltipIndex !== "undefined" && columnIndex === this.props.tooltipIndex ? tooltip : undefined;
    };

    private renderDataColumn = (columnName: string, columnData: any) => {
        return (
            <Column
                key={columnName}
                name={columnName}
                cellRenderer={(rowIndex, columnIndex) => (
                    <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={true} style={this.getFontStyle(rowIndex)} tooltip={this.getTooltip(columnData, columnIndex, rowIndex)}>
                        <>
                            <div data-testid={"simple-table-" + rowIndex + "-" + columnIndex}>{rowIndex < columnData?.length ? columnData[rowIndex] : undefined}</div>
                        </>
                    </Cell>
                )}
            />
        );
    };

    render() {
        const table = this.props;
        const tableColumns: React.ReactElement<React.ComponentProps<typeof Column>>[] = [];
        const tableData = table.dataset;

        table.columnHeaders?.forEach(header => {
            const columnIndex = header.columnIndex;
            const dataArray = tableData.get(columnIndex)?.data;
            const column = this.renderDataColumn(header.name, dataArray);
            tableColumns.push(column);
        });

        return (
            <Table
                ref={
                    table.updateTableRef
                        ? ref => {
                              if (ref) {
                                  table.updateTableRef?.(ref);
                              }
                          }
                        : undefined
                }
                numRows={table.numVisibleRows}
                renderMode={RenderMode.NONE}
                enableRowReordering={false}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={this.props.areGhostCellsEnabled ?? true}
                defaultRowHeight={this.props.defaultRowHeight}
                rowHeaderCellRenderer={this.renderRowHeaderCell}
                enableRowResizing={false}
                columnWidths={this.props.columnWidths}
                onColumnWidthChanged={this.props.onColumnWidthChanged}
                cellRendererDependencies={this.props.cellRendererDependencies}
                getCellClipboardData={undefined}
            >
                {tableColumns}
            </Table>
        );
    }
}

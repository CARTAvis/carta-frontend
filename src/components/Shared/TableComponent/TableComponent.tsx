import * as React from "react";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, ColumnHeaderCell, IRegion} from "@blueprintjs/table";
import {Checkbox, Tooltip, PopoverPosition, InputGroup, Menu, MenuItem, Icon, Label} from "@blueprintjs/core";
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
    updateTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateByInfiniteScroll?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
    updateSelectedRow?: (dataIndex: number[]) => void;
    updateSortRequest?: (columnName: string, sortingType: CARTA.SortingType) => void;
    sortingInfo?: {columnName: string, sortingType: CARTA.SortingType};
}

const MANUAL_SELECTION_COLUMN_WIDTH = 50;
const DEFAULT_COLUMN_WIDTH = 150;

@observer
export class TableComponent extends React.Component<TableComponentProps> {

    private renderManualSelectionColumn = (manualSelectionProps: ManualSelectionProps, manualSelectionData: boolean[]) => {
        if (!manualSelectionProps || !manualSelectionData || manualSelectionData.length <= 0) {
            return null;
        }

        const columnName = "select";
        return (
            <Column
                key={columnName}
                name={columnName}
                columnHeaderCellRenderer={(columnIndex: number) => {
                    return (
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

    private getfilterSyntax = (dataType: CARTA.ColumnType) => {
        switch (dataType) {
            case CARTA.ColumnType.String || CARTA.ColumnType.Bool:
                return (
                    <div>
                        <small>Filter by substring</small><br/>
                        <small>e.g. gal (no quotation, entries contain the "gal" string)</small>
                    </div>
                );
            default:
                return (
                    <div>
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

    private renderColumnHeaderCell = (columnIndex: number, column: CARTA.CatalogHeader) => {
        if (!isFinite(columnIndex) || !column) {
            return null;
        }

        const controlheader = this.props.filter.get(column.name);
        const filterSyntax = this.getfilterSyntax(column.dataType);
        const sortingInfo = this.props.sortingInfo;
        const sortColumn = sortingInfo.columnName === column.name;
        const sortDesc = sortingInfo.sortingType === CARTA.SortingType.Descending;
        let activeFilter = false;
        if (controlheader.filter !== "") {
            activeFilter = true;
        }

        const menuRenderer = () => {
            let activeAsc = false;
            let activeDesc = false;
            if (sortColumn) {
                if (sortDesc) {
                    activeDesc = true;
                } else {
                    activeAsc = true;
                }
            }
            return(
                <Menu className="catalog-sort-menu-item">
                    <MenuItem icon="sort-asc" active={activeAsc} onClick={() => this.props.updateSortRequest(column.name, CARTA.SortingType.Ascending)} text="Sort Asc" />
                    <MenuItem icon="sort-desc" active={activeDesc} onClick={() => this.props.updateSortRequest(column.name, CARTA.SortingType.Descending)} text="Sort Desc" />
                    <MenuItem icon="cross" onClick={() => this.props.updateSortRequest(null, null)} text="Clear Sort" />
                </Menu>
            );
        };

        const nameRenderer = () => {
            if (sortColumn) {
                return (
                    <Label className="bp3-inline lable">
                        {sortDesc ? 
                            <Icon className="sort-icon" icon={"sort-desc"} />
                            :
                            <Icon className="sort-icon" icon={"sort-asc"} />
                        }   
                        {column.name}
                    </Label>
                );
            } else {
                return (
                    <Label className="bp3-inline lable">
                        {column.name}
                    </Label>
                );
            }
        };

        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell className={"column-name"} nameRenderer={nameRenderer} menuRenderer={menuRenderer}/>
                <ColumnHeaderCell isActive={activeFilter}>
                    <Tooltip content={filterSyntax} position={PopoverPosition.TOP} className={"column-filter"}>
                        <InputGroup
                            key={"column-filter-" + columnIndex}
                            small={true}
                            placeholder="Click to filter"
                            value={controlheader && controlheader.filter ? controlheader.filter : ""} 
                            onChange={ev => this.props.updateColumnFilter(ev.currentTarget.value, column.name)}
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
        let columnWidths = table.columnWidths;

        // Create manuanl selection checkbox column
        if (table.manualSelectionProps && table.manualSelectionData && table.dataset && table.dataset.size > 0) {
            const column = this.renderManualSelectionColumn(table.manualSelectionProps, table.manualSelectionData);
            tableColumns.push(column);
            if (!columnWidths) {
                columnWidths = new Array<number>(table.columnHeaders.length).fill(DEFAULT_COLUMN_WIDTH);
            }
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

        return table.type === TableType.ColumnFilter ? (
            <Table
                className={"column-filter"}
                ref={(ref) => table.updateTableRef(ref)}
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
        ) : (
            <Table
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

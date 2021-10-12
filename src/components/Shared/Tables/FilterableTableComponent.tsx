import * as React from "react";
import classNames from "classnames";
import {observer} from "mobx-react";
import {Cell, Column, Table, SelectionModes, RenderMode, ColumnHeaderCell, IRegion} from "@blueprintjs/table";
import {Checkbox, InputGroup, Icon, Label, Position} from "@blueprintjs/core";
import {Tooltip2} from "@blueprintjs/popover2";
import {IconName} from "@blueprintjs/icons";
import {IRowIndices} from "@blueprintjs/table/lib/esm/common/grid";
import {CARTA} from "carta-protobuf";
import {AppStore, ControlHeader} from "stores";
import {CatalogApiService} from "services";
import {SpectralLineHeaders} from "stores/widgets";
import {CatalogType} from "models";
import {ProcessedColumnData} from "utilities";
import "./FilterableTableComponent.scss";

export type ColumnFilter = {index: number; columnFilter: string};

enum RowSelectionType {
    None,
    Indeterminate,
    All
}

export class FilterableTableComponentProps {
    dataset: Map<number, ProcessedColumnData>;
    filter?: Map<string, ControlHeader>;
    columnHeaders: Array<CARTA.CatalogHeader>;
    numVisibleRows: number;
    columnWidths?: Array<number>;
    loadingCell?: boolean;
    selectedDataIndex?: number[];
    showSelectedData?: boolean;
    updateTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateByInfiniteScroll?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
    updateSelectedRow?: (dataIndex: number[]) => void;
    updateSortRequest?: (columnName: string, sortingType: CARTA.SortingType, columnIndex: number) => void;
    flipRowSelection?: (rowIndex: number) => void;
    sortingInfo?: {columnName: string; sortingType: CARTA.SortingType};
    disableSort?: boolean;
    tableHeaders?: Array<CARTA.ICatalogHeader>;
    sortedIndexMap?: Array<number>;
    sortedIndices?: Array<number>;
    onCompleteRender?: () => void;
    catalogType?: CatalogType;
}

@observer
export class FilterableTableComponent extends React.Component<FilterableTableComponentProps> {
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

    private getFilterSyntax = (dataType: CARTA.ColumnType) => {
        const className = "column-popover-content";
        switch (dataType) {
            case CARTA.ColumnType.String:
                return (
                    <div className={className}>
                        <small>Filter by substring</small>
                        <br />
                        <small>e.g. gal (no quotation, entries contain the "gal" string)</small>
                    </div>
                );
            case CARTA.ColumnType.Bool:
                return (
                    <div className={className}>
                        <small>Filter by boolean value</small>
                        <br />
                        <small>e.g. "True" or "T", "False" or "F", case insensitive</small>
                    </div>
                );
            case CARTA.ColumnType.Double:
            default:
                return (
                    <div className={className}>
                        <small>
                            Operators: {">"}, {">="}, {"<"}, {"<="}, {"=="}, {"!="}, {".."}, {"..."}
                        </small>
                        <br />
                        <small>e.g. {"<"} 10 (everything less than 10) </small>
                        <br />
                        <small>e.g. == 1.23 (entries equal to 1.23) </small>
                        <br />
                        <small>e.g. 10..50 (everything between 10 and 50, exclusive)) </small>
                        <br />
                        <small>e.g. 10...50 (everything between 10 and 50, inclusive) </small>
                    </div>
                );
        }
    };

    private renderCheckboxColumnHeaderCell = (columnIndex: number, columnHeader: CARTA.CatalogHeader, columnData: any, selectionType: RowSelectionType) => {
        const controlHeader = this.props.filter?.get(columnHeader.name);
        const filterSyntax = this.getFilterSyntax(columnHeader.dataType);
        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell>
                    <Checkbox
                        indeterminate={selectionType === RowSelectionType.Indeterminate}
                        checked={selectionType === RowSelectionType.All}
                        inline={true}
                        onChange={() => {
                            if (selectionType === RowSelectionType.None || selectionType === RowSelectionType.All) {
                                columnData?.forEach((isSelected, rowIndex) => this.props.flipRowSelection(rowIndex));
                            } else {
                                columnData?.forEach((isSelected, rowIndex) => {
                                    if (isSelected) {
                                        this.props.flipRowSelection(rowIndex);
                                    }
                                });
                            }
                        }}
                    />
                </ColumnHeaderCell>
                <ColumnHeaderCell isActive={controlHeader?.filter !== ""}>
                    <Tooltip2 hoverOpenDelay={250} hoverCloseDelay={0} content={filterSyntax} position={Position.BOTTOM}>
                        <InputGroup
                            key={"column-popover-" + columnIndex}
                            small={true}
                            placeholder="Click to filter"
                            value={controlHeader?.filter ?? ""}
                            onChange={ev => this.props.updateColumnFilter(ev.currentTarget.value, columnHeader.name)}
                        />
                    </Tooltip2>
                </ColumnHeaderCell>
            </ColumnHeaderCell>
        );
    };

    private renderCheckboxCell = (rowIndex: number, columnIndex: number, columnData: any) => {
        return (
            <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={false}>
                <React.Fragment>{rowIndex < columnData?.length ? <Checkbox checked={columnData[rowIndex]} onChange={() => this.props.flipRowSelection(rowIndex)} /> : null}</React.Fragment>
            </Cell>
        );
    };

    private renderCheckboxColumn = (columnHeader: CARTA.CatalogHeader, columnData: any) => {
        let selected = 0;
        columnData?.forEach(isSelected => (selected += isSelected ? 1 : 0));
        const selectionType = selected === 0 ? RowSelectionType.None : selected === columnData?.length ? RowSelectionType.All : RowSelectionType.Indeterminate;

        return (
            <Column
                key={columnHeader.name}
                name={columnHeader.name}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderCheckboxColumnHeaderCell(columnIndex, columnHeader, columnData, selectionType)}
                cellRenderer={columnData?.length ? (rowIndex, columnIndex) => this.renderCheckboxCell(rowIndex, columnIndex, columnData) : undefined}
            />
        );
    };

    private renderDataColumnWithFilter = (columnHeader: CARTA.CatalogHeader, columnData: Array<any> | NodeJS.TypedArray) => {
        return (
            <Column
                key={columnHeader.name}
                name={columnHeader.name}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, columnHeader)}
                cellRenderer={columnData?.length ? (rowIndex, columnIndex) => this.renderCell(rowIndex, columnIndex, columnData, columnHeader) : undefined}
            />
        );
    };

    private renderCell = (index: number, columnIndex: number, columnData: any, columnHeader: CARTA.CatalogHeader) => {
        const dataIndex = this.props.selectedDataIndex;
        let rowIndex = index;
        if (this.props.sortedIndexMap) {
            rowIndex = this.props.showSelectedData ? this.props.sortedIndices[rowIndex] : this.props.sortedIndexMap[rowIndex];
        }
        const cellContext = rowIndex < columnData.length ? columnData[rowIndex] : "";
        let cell = cellContext;
        if (this.props.catalogType === CatalogType.SIMBAD) {
            if (columnHeader.name?.toLocaleLowerCase().includes("bibcode")) {
                cell = (
                    <a href={`${CatalogApiService.SimbadHyperLink.bibcode}${cellContext}`} target="_blank" rel="noopener noreferrer">
                        {cellContext}
                    </a>
                );
            }

            if (columnHeader.name?.toLocaleLowerCase().includes("main_id")) {
                cell = (
                    <a href={`${CatalogApiService.SimbadHyperLink.mainId}${cellContext}`} target="_blank" rel="noopener noreferrer">
                        {cellContext}
                    </a>
                );
            }
        }
        const selected = dataIndex && dataIndex.includes(index) && !this.props.showSelectedData;
        return (
            <Cell key={`cell_${columnIndex}_${rowIndex}`} intent={selected ? "danger" : "none"} loading={this.isLoading(rowIndex)} interactive={false}>
                <React.Fragment>{cell}</React.Fragment>
            </Cell>
        );
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
    };

    private renderColumnHeaderCell = (columnIndex: number, column: CARTA.CatalogHeader) => {
        if (!isFinite(columnIndex) || !column) {
            return null;
        }
        const controlheader = this.props.filter?.get(column.name);
        const filterSyntax = this.getFilterSyntax(column.dataType);
        const sortingInfo = this.props.sortingInfo;
        const headerDescription = this.props.tableHeaders?.[controlheader?.dataIndex]?.description;
        const disableSort = this.props.disableSort;
        const nameRenderer = () => {
            // sharing css with fileList table
            let sortIcon = "sort";
            let iconClass = "sort-icon inactive";
            let nextSortType = 0;
            if (sortingInfo?.columnName === column.name) {
                nextSortType = this.getNextSortingType();
                if (sortingInfo?.sortingType === CARTA.SortingType.Descending) {
                    sortIcon = "sort-desc";
                    iconClass = "sort-icon";
                } else if (sortingInfo?.sortingType === CARTA.SortingType.Ascending) {
                    sortIcon = "sort-asc";
                    iconClass = "sort-icon";
                }
            }
            return (
                <div className="sort-label" onClick={() => (disableSort ? null : this.props.updateSortRequest(column.name, nextSortType, column.columnIndex))}>
                    <Label disabled={disableSort} className="bp3-inline label">
                        <Icon className={iconClass} icon={sortIcon as IconName} />
                        <Tooltip2 hoverOpenDelay={250} hoverCloseDelay={0} content={headerDescription ?? "Description not avaliable"} position={Position.BOTTOM} popoverClassName={AppStore.Instance.darkTheme ? "bp3-dark" : ""}>
                            {column.name}
                        </Tooltip2>
                    </Label>
                </div>
            );
        };

        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell className={"column-name"} nameRenderer={nameRenderer} />
                <ColumnHeaderCell isActive={controlheader?.filter !== ""}>
                    <Tooltip2 hoverOpenDelay={250} hoverCloseDelay={0} content={filterSyntax} position={Position.BOTTOM}>
                        <InputGroup key={"column-popover-" + columnIndex} small={true} placeholder="Click to filter" value={controlheader?.filter ?? ""} onChange={ev => this.props.updateColumnFilter(ev.currentTarget.value, column.name)} />
                    </Tooltip2>
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
            this.props.updateByInfiniteScroll?.(rowIndices.rowIndexEnd);
        }
    };

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
            this.props.updateSelectedRow?.(selectedDataIndex);
        }
    };

    render() {
        const table = this.props;
        const tableColumns = [];
        const tableData = table.dataset;
        table.columnHeaders?.forEach(header => {
            const columnIndex = header.columnIndex;
            let dataArray = tableData.get(columnIndex)?.data;
            const column = header.name === SpectralLineHeaders.LineSelection && this.props.flipRowSelection ? this.renderCheckboxColumn(header, dataArray) : this.renderDataColumnWithFilter(header, dataArray);
            tableColumns.push(column);
        });

        const className = classNames("column-filter-table", {"bp3-dark": AppStore.Instance.darkTheme});

        return (
            <Table
                className={className}
                ref={table.updateTableRef ? ref => table.updateTableRef(ref) : null}
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
                columnWidths={table.columnWidths}
                onCompleteRender={table.onCompleteRender}
            >
                {tableColumns}
            </Table>
        );
    }
}

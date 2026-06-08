import * as React from "react";
import {Checkbox, Classes, Icon, InputGroup, Label, Position, Tooltip} from "@blueprintjs/core";
import type {IconName} from "@blueprintjs/icons";
import {Cell, Column, ColumnHeaderCell, type Region, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import type {RowIndices} from "@blueprintjs/table/lib/esm/common/grid";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import {observer} from "mobx-react";
import type {ProcessedColumnData} from "utilities";

import {CatalogType, RowSelectionType, SpectralLineHeaders} from "enums";
import {CatalogApiService} from "services";
import {AppStore, type ControlHeader} from "stores";

import "./FilterableTableComponent.scss";

export type ColumnFilter = {index: number; columnFilter: string};

export class FilterableTableComponentProps {
    dataset: Map<number, ProcessedColumnData>;
    filter?: Map<string, ControlHeader>;
    columnHeaders: Array<CARTA.ICatalogHeader>;
    numVisibleRows: number;
    columnWidths?: Array<number>;
    isLoadingCell?: boolean;
    selectedDataIndex?: number[];
    shouldShowSelectedData?: boolean;
    updateTableRef?: (ref: Table) => void;
    updateColumnFilter?: (value: string, columnName: string) => void;
    updateByInfiniteScroll?: (rowIndexEnd: number) => void;
    updateTableColumnWidth?: (width: number, columnName: string) => void;
    updateSelectedRow?: (dataIndex: number[]) => void;
    updateSortRequest?: (columnName: string, sortingType: CARTA.SortingType | null) => void;
    flipRowSelection?: (rowIndex: number) => void;
    sortingInfo?: {columnName: string; sortingType: CARTA.SortingType | null};
    shouldDisableSort?: boolean;
    tableHeaders?: Array<CARTA.ICatalogHeader>;
    sortedIndexMap?: Array<number>;
    sortedIndices?: Array<number>;
    onCompleteRender?: () => void;
    catalogType?: CatalogType;
    applyFilterWithEnter?: () => void;
}

@observer
export class FilterableTableComponent extends React.Component<FilterableTableComponentProps> {
    private readonly sortingTypelinkedList = {
        head: {
            value: null as CARTA.SortingType | null,
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

    private renderCheckboxColumnHeaderCell = (columnIndex: number, columnHeader: CARTA.ICatalogHeader, columnData: any, selectionType: RowSelectionType) => {
        const controlHeader = columnHeader.name ? this.props.filter?.get(columnHeader.name) : undefined;
        const filterSyntax = columnHeader.dataType ? this.getFilterSyntax(columnHeader.dataType) : null;
        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell>
                    <Checkbox
                        indeterminate={selectionType === RowSelectionType.Indeterminate}
                        checked={selectionType === RowSelectionType.All}
                        inline={true}
                        onChange={() => {
                            if (selectionType === RowSelectionType.None || selectionType === RowSelectionType.All) {
                                columnData?.forEach((isSelected, rowIndex) => this.props.flipRowSelection?.(rowIndex));
                            } else {
                                columnData?.forEach((isSelected, rowIndex) => {
                                    if (isSelected) {
                                        this.props.flipRowSelection?.(rowIndex);
                                    }
                                });
                            }
                        }}
                        data-testid="filterable-table-header-checkbox"
                    />
                </ColumnHeaderCell>
                <ColumnHeaderCell isActive={controlHeader?.filter !== ""}>
                    <Tooltip hoverOpenDelay={250} hoverCloseDelay={0} content={filterSyntax ?? undefined} position={Position.BOTTOM}>
                        <InputGroup
                            key={"column-popover-" + columnIndex}
                            size="small"
                            placeholder="Click to filter"
                            value={controlHeader?.filter ?? ""}
                            onChange={ev => columnHeader.name && this.props.updateColumnFilter?.(ev.currentTarget.value, columnHeader.name)}
                        />
                    </Tooltip>
                </ColumnHeaderCell>
            </ColumnHeaderCell>
        );
    };

    private renderCheckboxCell = (rowIndex: number, columnIndex: number, columnData: any) => {
        return (
            <Cell key={`cell_${columnIndex}_${rowIndex}`} interactive={false}>
                <React.Fragment>{rowIndex < columnData?.length ? <Checkbox checked={columnData[rowIndex]} onChange={() => this.props.flipRowSelection?.(rowIndex)} /> : null}</React.Fragment>
            </Cell>
        );
    };

    private renderCheckboxColumn = (columnHeader: CARTA.ICatalogHeader, columnData: any) => {
        let selectedCount = 0;
        columnData?.forEach(isSelected => (selectedCount += isSelected ? 1 : 0));
        const selectionType = selectedCount === 0 ? RowSelectionType.None : selectedCount === columnData?.length ? RowSelectionType.All : RowSelectionType.Indeterminate;

        return (
            <Column
                key={columnHeader.name ?? "checkbox"}
                name={columnHeader.name ?? ""}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderCheckboxColumnHeaderCell(columnIndex, columnHeader, columnData, selectionType)}
                cellRenderer={(rowIndex, columnIndex) => this.renderCheckboxCell(rowIndex, columnIndex, columnData ?? [])}
            />
        );
    };

    private renderDataColumnWithFilter = (columnHeader: CARTA.ICatalogHeader, columnData: Array<any> | NodeJS.TypedArray) => {
        return (
            <Column
                key={columnHeader.name ?? "data"}
                name={columnHeader.name ?? ""}
                columnHeaderCellRenderer={(columnIndex: number) => this.renderColumnHeaderCell(columnIndex, columnHeader)}
                cellRenderer={(rowIndex, columnIndex) => this.renderCell(rowIndex, columnIndex, columnData ?? [], columnHeader)}
            />
        );
    };

    private renderCell = (index: number, columnIndex: number, columnData: Array<any> | NodeJS.TypedArray, columnHeader: CARTA.ICatalogHeader) => {
        const dataIndex = this.props.selectedDataIndex;
        let rowIndex = index;
        if (this.props.sortedIndexMap) {
            rowIndex = this.props.shouldShowSelectedData && this.props.sortedIndices ? this.props.sortedIndices[rowIndex] : this.props.sortedIndexMap[rowIndex];
        }
        let cellContext = rowIndex < columnData.length ? columnData[rowIndex] : "";
        if (typeof cellContext === "boolean" && this.props.catalogType === CatalogType.FILE) {
            cellContext = cellContext.toString();
        } else if (typeof cellContext === "number" && isNaN(cellContext)) {
            cellContext = "NaN";
        }
        let cell = cellContext;
        if (this.props.catalogType === CatalogType.SIMBAD) {
            if (columnHeader.name?.toLocaleLowerCase().includes("bibcode")) {
                cell = (
                    <a href={`${CatalogApiService.SIMBAD_HYPER_LINK.bibcode}${cellContext}`} target="_blank" rel="noopener noreferrer">
                        {cellContext}
                    </a>
                );
            }

            if (columnHeader.name?.toLocaleLowerCase().includes("main_id")) {
                cell = (
                    <a href={`${CatalogApiService.SIMBAD_HYPER_LINK.mainId}${cellContext}`} target="_blank" rel="noopener noreferrer">
                        {cellContext}
                    </a>
                );
            }
        }
        const isSelected = dataIndex && dataIndex.includes(index) && !this.props.shouldShowSelectedData;
        return (
            <Cell key={`cell_${columnIndex}_${rowIndex}`} intent={isSelected ? "danger" : "none"} loading={this.isLoading(rowIndex)} interactive={false}>
                <>
                    <div data-testid={"filterable-table-" + rowIndex + "-" + columnIndex}>{cell}</div>
                </>
            </Cell>
        );
    };

    private getNextSortingType = (): CARTA.SortingType | null => {
        let currentNode: any = this.sortingTypelinkedList.head;
        while (currentNode?.next) {
            if (currentNode.value === this.props.sortingInfo?.sortingType) {
                return currentNode.next.value;
            }
            currentNode = currentNode.next;
        }
        return null;
    };

    private renderColumnHeaderCell = (columnIndex: number, column: CARTA.ICatalogHeader) => {
        if (!isFinite(columnIndex) || !column || !column.name) {
            return null;
        }
        const controlHeader = column.name ? this.props.filter?.get(column.name) : undefined;
        const filterSyntax = column.dataType ? this.getFilterSyntax(column.dataType) : null;
        const sortingInfo = this.props.sortingInfo;
        const headerDescription = controlHeader?.dataIndex != null ? this.props.tableHeaders?.[controlHeader.dataIndex]?.description : undefined;
        const shouldDisableSort = this.props.shouldDisableSort;
        const nameRenderer = () => {
            // sharing css with fileList table
            let sortIcon = "sort";
            let iconClass = "sort-icon inactive";
            let nextSortType: CARTA.SortingType | null = CARTA.SortingType.Ascending;
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
                <div className="sort-label" onClick={() => (shouldDisableSort || !column.name ? null : this.props.updateSortRequest?.(column.name, nextSortType))}>
                    <Label disabled={shouldDisableSort} className={classNames(Classes.INLINE, "label")} data-testid={"filterable-table-header-" + columnIndex}>
                        <Icon className={iconClass} icon={sortIcon as IconName} />
                        <Tooltip hoverOpenDelay={250} hoverCloseDelay={0} content={headerDescription ?? "Description not avaliable"} position={Position.BOTTOM} popoverClassName={classNames({[Classes.DARK]: AppStore.Instance.isDarkTheme})}>
                            {column.name}
                        </Tooltip>
                    </Label>
                </div>
            );
        };

        return (
            <ColumnHeaderCell>
                <ColumnHeaderCell className={"column-name"} nameRenderer={nameRenderer} />
                <ColumnHeaderCell isActive={controlHeader?.filter !== ""}>
                    <Tooltip hoverOpenDelay={250} hoverCloseDelay={0} content={filterSyntax ?? undefined} position={Position.BOTTOM}>
                        <InputGroup
                            key={"column-popover-" + columnIndex}
                            size="small"
                            placeholder="Click to filter"
                            value={controlHeader?.filter ?? ""}
                            onChange={ev => column.name && this.props.updateColumnFilter?.(ev.currentTarget.value, column.name)}
                            onKeyDown={this.handleKeyDown}
                            data-testid={"filterable-table-filter-input-" + columnIndex}
                        />
                    </Tooltip>
                </ColumnHeaderCell>
            </ColumnHeaderCell>
        );
    };

    private handleKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.type === "keydown" && ev.key === "Enter" && this.props.applyFilterWithEnter) {
            this.props.applyFilterWithEnter();
        }
    };

    private isLoading(rowIndex: number): boolean {
        if (this.props.isLoadingCell && rowIndex + 4 > this.props.numVisibleRows) {
            return true;
        }
        return false;
    }

    private infiniteScroll = (rowIndices: RowIndices) => {
        // rowIndices offset around 5 form blueprintjs tabel
        const currentIndex = rowIndices.rowIndexEnd + 1;
        if (rowIndices.rowIndexEnd > 0 && currentIndex >= this.props.numVisibleRows && !this.props.isLoadingCell && !this.props.shouldShowSelectedData) {
            this.props.updateByInfiniteScroll?.(rowIndices.rowIndexEnd);
        }
    };

    private updateTableColumnWidth = (index: number, size: number) => {
        const header = this.props.columnHeaders[index];
        if (header?.name && this.props.updateTableColumnWidth) {
            this.props.updateTableColumnWidth(size, header.name);
        }
    };

    private onRowIndexSelection = (selectedRegions: Region[]) => {
        if (selectedRegions.length > 0) {
            const selectedDataIndex: number[] = [];
            for (let i = 0; i < selectedRegions.length; i++) {
                const region = selectedRegions[i];
                if (region.rows && region.rows.length >= 2) {
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
            }
            this.props.updateSelectedRow?.(selectedDataIndex);
        }
    };

    render() {
        const table = this.props;
        const tableColumns: React.JSX.Element[] = [];
        const tableData = table.dataset;
        let lineSelectionIndex: number | undefined;
        table.columnHeaders?.forEach(header => {
            const columnIndex = header.columnIndex;
            if (columnIndex != null) {
                const dataArray = tableData.get(columnIndex)?.data;
                const column = header.name === SpectralLineHeaders.LineSelection && this.props.flipRowSelection ? this.renderCheckboxColumn(header, dataArray) : this.renderDataColumnWithFilter(header, dataArray ?? []);
                tableColumns.push(column);
                if (header.name === SpectralLineHeaders.LineSelection) {
                    lineSelectionIndex = columnIndex;
                }
            }
        });

        const tableCheckData = lineSelectionIndex != null ? this.props.dataset.get(lineSelectionIndex)?.data?.slice() : undefined;

        const className = classNames("column-filter-table", {[Classes.DARK]: AppStore.Instance.isDarkTheme});

        return (
            <Table
                className={className}
                ref={table.updateTableRef ?? null}
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
                cellRendererDependencies={[tableCheckData]} // trigger re-render on line selection change
                getCellClipboardData={undefined}
            >
                {tableColumns}
            </Table>
        );
    }
}

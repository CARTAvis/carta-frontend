import * as React from "react";
import {Button, Classes, Icon, Label, NonIdealState, Spinner} from "@blueprintjs/core";
import {Cell, Column, ColumnHeaderCell, type Region, Regions, RenderMode, SelectionModes, Table, TableLoadingOption} from "@blueprintjs/table";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import FuzzySearch from "fuzzy-search";
import globToRegExp from "glob-to-regexp";
import {action, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";
import moment from "moment";

import {BrowserMode, FileFilteringType, FileFilterMode} from "enums";
import {AppStore, type BrowserFileList, FileBrowserStore, type ISelectedFile} from "stores";
import {toFixed} from "utilities";

import "./FileListTableComponent.scss";

interface FileEntry extends ISelectedFile {
    filename: string;
    typeInfo?: {type: string; description: string};
    isDirectory?: boolean;
    isFile?: boolean;
    itemCount?: number;
    size?: number;
    sizeIsUpperBound?: boolean;
    date?: number;
    fileInfo?: CARTA.FileInfo.$Properties | CARTA.CatalogFileInfo.$Properties;
    hdu?: string;
}

export interface FileListTableComponentProps {
    darkTheme: boolean;
    loading?: boolean;
    extendedLoading?: boolean;
    fileProgress?: {total: number; checked: number};
    fileList: BrowserFileList | null;
    selectedFile: CARTA.FileInfo.$Properties | CARTA.CatalogFileInfo.$Properties | null | undefined;
    selectedHDU: string;
    filterType: FileFilteringType;
    filterString?: string;
    sortingString?: string;
    fileBrowserMode: BrowserMode;
    onSortingChanged: (columnName: string, direction: number) => void;
    onFileClicked: (file: ISelectedFile) => void;
    onSelectionChanged: (selectedFiles: ISelectedFile[]) => void;
    onFileDoubleClicked: (file: ISelectedFile) => void;
    onFolderClicked: (folder: string) => void;
    onListCancelled: () => void;
}

@observer
export class FileListTableComponent extends React.Component<FileListTableComponentProps> {
    @observable selectedRegions: Region[] = [];
    @observable columnWidths = [360, 80, 90, 106];

    private static readonly RowHeight = 22;
    private tableRef: Table | null = null;
    private cachedFilterString: string | undefined;
    private cachedSortingString: string | undefined;
    private cachedFileList: BrowserFileList | null;
    private rowPivotIndex: number = -1;

    private static readonly FileTypeMap = new Map<CARTA.FileType, {type: string; description: string}>([
        [CARTA.FileType.CASA, {type: "CASA", description: "CASA Image"}],
        [CARTA.FileType.CRTF, {type: "CRTF", description: "CASA Region Text Format"}],
        [CARTA.FileType.DS9_REG, {type: "DS9", description: "DS9 Region Format"}],
        [CARTA.FileType.FITS, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.FileType.HDF5, {type: "HDF5", description: "HDF5 File (IDIA Schema)"}],
        [CARTA.FileType.MIRIAD, {type: "Miriad", description: "Miriad Image"}],
        [CARTA.FileType.ZARR, {type: "Zarr", description: "Zarr Image (XRADIO Schema)"}]
    ]);

    private static readonly CatalogFileTypeMap = new Map<CARTA.CatalogFileType, {type: string; description: string}>([
        [CARTA.CatalogFileType.FITSTable, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.CatalogFileType.VOTable, {type: "VOTable", description: "XML-Based Table Format"}]
    ]);

    private static getFileTypeDisplay(type: CARTA.FileType) {
        return FileListTableComponent.FileTypeMap.get(type) || {type: "Unknown", description: "An unknown file format"};
    }

    private static getCatalogFileTypeDisplay(type: CARTA.CatalogFileType) {
        return FileListTableComponent.CatalogFileTypeMap.get(type) || {type: "Unknown", description: "An unknown file format"};
    }

    private static getFileSizeDisplay(sizeInBytes: number, isSizeUpperBound?: boolean): string {
        const upperBoundPrefix = isSizeUpperBound ? "≤" : "";
        if (sizeInBytes >= 1e12) {
            return `${upperBoundPrefix}${toFixed(sizeInBytes / 1e12, 2)} TB`;
        } else if (sizeInBytes >= 1e9) {
            return `${upperBoundPrefix}${toFixed(sizeInBytes / 1e9, 1)} GB`;
        } else if (sizeInBytes >= 1e6) {
            return `${upperBoundPrefix}${toFixed(sizeInBytes / 1e6, 1)} MB`;
        } else if (sizeInBytes >= 1e3) {
            return `${upperBoundPrefix}${toFixed(sizeInBytes / 1e3, 1)} kB`;
        } else {
            return `${upperBoundPrefix}${sizeInBytes} B`;
        }
    }

    get tableEntries(): FileEntry[] {
        // recalculate when receiving new file info of a file in all file mode
        if (AppStore.Instance.preferenceStore.fileFilterMode === FileFilterMode.All) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const isFileInfoResp = FileBrowserStore.Instance.isFileInfoResp;
        }

        const fileList = this.props.fileList;
        if (!fileList) {
            return [];
        }

        const fileBrowserMode = this.props.fileBrowserMode;

        let filteredSubdirectories = fileList?.subdirectories?.slice();
        let filteredFiles = fileList?.files?.slice();

        const filterString = this.props.filterString;
        const filterType = this.props.filterType;
        if (filterString) {
            try {
                let regex: RegExp;
                if (filterType === FileFilteringType.Fuzzy) {
                    const folderSearcher = new FuzzySearch(filteredSubdirectories, ["name"]);
                    filteredSubdirectories = folderSearcher.search(filterString);
                    const fileSearcher = new FuzzySearch(filteredFiles, ["name"]);
                    filteredFiles = fileSearcher.search(filterString);
                } else if (filterType === FileFilteringType.Unix) {
                    // glob search case-insensitive
                    regex = RegExp(globToRegExp(filterString.toLowerCase()));
                    filteredSubdirectories = filteredSubdirectories?.filter(info => info.name?.toLowerCase().match(regex));
                    // @ts-ignore
                    filteredFiles = filteredFiles?.filter(file => file.name?.toLowerCase().match(regex));
                } else {
                    // Strict regex search is case-sensitive
                    regex = RegExp(filterString);
                    filteredSubdirectories = filteredSubdirectories?.filter(info => info.name?.match(regex));
                    // @ts-ignore
                    filteredFiles = filteredFiles?.filter(file => file.name?.match(regex));
                }
            } catch (e) {
                if (e.name !== "SyntaxError") {
                    console.log(e);
                }
            }
        }

        const entries: FileEntry[] = [];
        const sortingString = this.props.sortingString || "+filename";
        const sortingConfig = {direction: sortingString.startsWith("+") ? 1 : -1, columnName: sortingString.substring(1).toLowerCase()};
        if (filteredSubdirectories && filteredSubdirectories.length) {
            switch (sortingConfig?.columnName) {
                case "filename":
                    filteredSubdirectories.sort((a, b) => sortingConfig.direction * ((a.name || "").toLowerCase() < (b.name || "").toLowerCase() ? -1 : 1));
                    break;
                case "size":
                    filteredSubdirectories.sort((a, b) => sortingConfig.direction * ((a.itemCount || 0) < (b.itemCount || 0) ? -1 : 1));
                    break;
                case "date":
                    filteredSubdirectories.sort((a, b) => sortingConfig.direction * ((a.date || 0) < (b.date || 0) ? -1 : 1));
                    break;
                default:
                    break;
            }

            for (const directory of filteredSubdirectories) {
                if (AppStore.Instance.preferenceStore.fileFilterMode === FileFilterMode.All && directory.size && directory.type != null && directory.type in CARTA.FileType) {
                    entries.push({
                        filename: directory.name || "",
                        typeInfo: FileListTableComponent.getFileTypeDisplay(directory.type),
                        size: directory.size as number,
                        sizeIsUpperBound: directory.sizeIsUpperBound ?? undefined,
                        date: directory.date as number,
                        isDirectory: true,
                        isFile: true,
                        fileInfo: {name: directory.name, type: directory.type, size: directory.size, HDUList: directory.HDUList, date: directory.date, sizeIsUpperBound: directory.sizeIsUpperBound}
                    });
                } else {
                    entries.push({
                        filename: directory.name || "",
                        itemCount: directory.itemCount && directory.itemCount > 0 ? directory.itemCount : undefined,
                        date: directory.date as number,
                        isDirectory: true,
                        fileInfo: {name: directory.name}
                    });
                }
            }
        }

        if (filteredFiles && filteredFiles.length) {
            switch (sortingConfig?.columnName) {
                case "filename":
                    filteredFiles.sort((a, b) => sortingConfig.direction * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                    break;
                case "type":
                    filteredFiles.sort((a, b) => sortingConfig.direction * (a.type < b.type ? -1 : 1));
                    break;
                case "size":
                    filteredFiles.sort((a, b) => sortingConfig.direction * (a.size < b.size ? -1 : 1));
                    break;
                case "date":
                    filteredFiles.sort((a, b) => sortingConfig.direction * (a.date < b.date ? -1 : 1));
                    break;
                default:
                    break;
            }

            if (fileBrowserMode === BrowserMode.Catalog) {
                for (const file of filteredFiles as CARTA.CatalogFileInfo.$Properties[]) {
                    entries.push({
                        filename: file.name || "",
                        typeInfo: file.type != null ? FileListTableComponent.getCatalogFileTypeDisplay(file.type) : undefined,
                        size: file.fileSize as number,
                        date: file.date as number,
                        fileInfo: file,
                        isFile: true
                    });
                }
            } else if (fileBrowserMode === BrowserMode.File) {
                for (const file of filteredFiles as CARTA.FileInfo.$Properties[]) {
                    if (file.HDUList) {
                        for (const hdu of file.HDUList) {
                            const filename = file.HDUList.length > 1 ? `${file.name || ""}: HDU ${hdu}` : file.name || "";
                            entries.push({
                                filename,
                                typeInfo: file.type != null ? FileListTableComponent.getFileTypeDisplay(file.type) : undefined,
                                size: file.size as number,
                                sizeIsUpperBound: file.sizeIsUpperBound ?? undefined,
                                date: file.date as number,
                                fileInfo: file,
                                hdu,
                                isFile: true
                            });
                        }
                    }
                }
            } else {
                for (const file of filteredFiles as CARTA.FileInfo.$Properties[]) {
                    entries.push({
                        filename: file.name || "",
                        typeInfo: file.type != null ? FileListTableComponent.getFileTypeDisplay(file.type) : undefined,
                        size: file.size as number,
                        sizeIsUpperBound: file.sizeIsUpperBound ?? undefined,
                        date: file.date as number,
                        fileInfo: file,
                        isFile: true
                    });
                }
            }
        }
        return entries;
    }

    get selectedFiles(): ISelectedFile[] {
        if (!this.tableEntries?.length || !this.selectedRegions?.length) {
            return [];
        }
        const files: ISelectedFile[] = [];
        for (const selection of this.selectedRegions) {
            if (selection.rows && selection.rows.length >= 2) {
                for (let i = selection.rows[0]; i <= selection.rows[1]; i++) {
                    if (i >= 0 && i < this.tableEntries.length) {
                        const entry = this.tableEntries[i];
                        if (entry) {
                            // Convert FileEntry to ISelectedFile
                            files.push({
                                fileInfo: entry.fileInfo,
                                hdu: entry.hdu,
                                isFile: entry.isFile
                            });
                        }
                    }
                }
            }
        }
        return files;
    }

    constructor(props: FileListTableComponentProps) {
        super(props);
        makeObservable(this);

        // Initialize cached values
        this.cachedFileList = props.fileList;
        this.cachedSortingString = props.sortingString;
        this.cachedFilterString = props.filterString;
    }

    componentDidUpdate(prevProps: FileListTableComponentProps) {
        // Automatically scroll to the top of the table when a new file response is received, or when filtering/sorting changes
        const fileList = this.props.fileList;
        const sortingString = this.props.sortingString;
        const filterString = this.props.filterString;

        if (fileList !== this.cachedFileList || sortingString !== this.cachedSortingString || filterString !== this.cachedFilterString) {
            this.cachedSortingString = sortingString;
            this.cachedFilterString = filterString;
            this.cachedFileList = fileList;
            runInAction(() => (this.selectedRegions = []));
            this.rowPivotIndex = -1;
            this.props.onSelectionChanged([]);

            setTimeout(() => this.tableRef?.scrollToRegion(Regions.row(0, 0)), 20);
        }
    }

    @action handleColumnWidthChanged = (index: number, size: number) => {
        if (index >= 0 && index < this.columnWidths.length) {
            this.columnWidths[index] = size;
        }
    };

    private renderColumnHeader = (name: string, _index?: number) => {
        const sortingString = this.props.sortingString || "+filename";
        const sortingConfig = {direction: sortingString.startsWith("+") ? 1 : -1, columnName: sortingString.substring(1).toLowerCase()};
        const isSortColumn = name.toLowerCase() === sortingConfig?.columnName;
        const isSortDesc = sortingConfig?.direction < 0;

        const nameRenderer = () => {
            if (isSortColumn) {
                return (
                    <div className="sort-label" onClick={() => this.props.onSortingChanged(name, -sortingConfig.direction)}>
                        <Label className={classNames(Classes.INLINE, "label")}>
                            <Icon className="sort-icon" icon={isSortDesc ? "sort-desc" : "sort-asc"} />
                            {name}
                        </Label>
                    </div>
                );
            } else {
                return (
                    <div className="sort-label" onClick={() => this.props.onSortingChanged(name, 1)}>
                        <Label className={classNames(Classes.INLINE, "label")}>
                            <Icon className="sort-icon inactive" icon="sort" />
                            {name}
                        </Label>
                    </div>
                );
            }
        };
        return <ColumnHeaderCell className={"column-name"} nameRenderer={nameRenderer} />;
    };

    private renderFilenames = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        if (!entry) {
            return <Cell loading={true} />;
        }
        return (
            <Cell className={entry.isDirectory ? "folder-cell" : "filename-cell"} tooltip={entry?.filename}>
                <React.Fragment>
                    <div onClick={event => this.handleEntryClicked(event, entry, rowIndex)} onDoubleClick={() => this.handleEntryDoubleClicked(entry)}>
                        {entry?.isDirectory && <Icon icon="folder-close" />}
                        <span className="cell-text">{entry?.filename}</span>
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private renderTypes = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        if (!entry) {
            return <Cell loading={true} />;
        }
        return (
            <Cell tooltip={entry.typeInfo?.description}>
                <React.Fragment>
                    <div onClick={event => this.handleEntryClicked(event, entry, rowIndex)} onDoubleClick={() => this.handleEntryDoubleClicked(entry)}>
                        {entry.typeInfo?.type}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private renderSizes = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        if (!entry) {
            return <Cell loading={true} />;
        }

        return (
            <Cell>
                <React.Fragment>
                    <div onClick={event => this.handleEntryClicked(event, entry, rowIndex)} onDoubleClick={() => this.handleEntryDoubleClicked(entry)}>
                        {entry.isFile && entry.size !== undefined && isFinite(entry.size) && FileListTableComponent.getFileSizeDisplay(entry.size, entry.sizeIsUpperBound)}
                        {!entry.isFile && entry.itemCount !== undefined && isFinite(entry.itemCount) && `${entry.itemCount} items`}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private renderDates = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        if (!entry) {
            return <Cell loading={true} />;
        }

        const unixDate = entry.date;
        let dateString = "";
        if (unixDate !== undefined && unixDate > 0) {
            const t = moment.unix(unixDate);
            const isToday = moment(0, "HH").diff(t) <= 0;
            if (isToday) {
                dateString = t.format("HH:mm");
            } else {
                dateString = t.format("D MMM YYYY");
            }
        }

        return (
            <Cell className="time-cell">
                <React.Fragment>
                    <div onClick={event => this.handleEntryClicked(event, entry, rowIndex)} onDoubleClick={() => this.handleEntryDoubleClicked(entry)}>
                        {dateString}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private handleEntryDoubleClicked = (entry: FileEntry) => {
        if (!entry.isFile) {
            return;
        }
        this.props.onFileDoubleClicked(entry);
    };

    @action private handleEntryClicked = (event: React.MouseEvent, entry: FileEntry, index: number) => {
        if (entry) {
            const isCtrlPressed = event.ctrlKey || event.metaKey;
            if (isCtrlPressed && this.selectedRegions.length) {
                const currentRow = Regions.row(index);
                const rowIndex = Regions.findMatchingRegion(this.selectedRegions, currentRow);
                if (rowIndex === -1) {
                    this.selectedRegions.push(currentRow);
                    // Generate new array in order to trigger re-render
                    this.selectedRegions = this.selectedRegions.slice();
                } else {
                    this.selectedRegions = this.selectedRegions.filter(r => r !== this.selectedRegions[rowIndex]);
                    // Prevent deselection of all files
                    if (!this.selectedRegions.length) {
                        this.selectedRegions = [Regions.row(index)];
                    }
                }
            } else if (event.shiftKey && this.selectedRegions.length) {
                const range = Regions.row(this.rowPivotIndex, index);
                this.selectedRegions = [];
                if (range.rows?.length === 2) {
                    for (let i = range.rows[0]; i <= range.rows[1]; i++) {
                        this.selectedRegions.push(Regions.row(i));
                    }
                }
            } else {
                this.selectedRegions = [Regions.row(index)];
                this.rowPivotIndex = index;
            }

            if (!entry.isFile) {
                this.props.onFolderClicked(entry.filename);
            } else if (this.selectedRegions?.length === 1 && this.selectedRegions[0].rows?.length === 2) {
                const rows = this.selectedRegions[0].rows;
                this.props.onFileClicked(this.tableEntries[rows[0]]);
            }
        }
        this.props.onSelectionChanged(this.selectedFiles);
    };

    render() {
        const fileList = this.props.fileList;

        const classes = ["browser-table"];
        if (this.props.darkTheme) {
            classes.push(Classes.DARK);
        }

        const entryCount = this.tableEntries.length;
        const unfilteredEntryCount = (fileList?.files?.length || 0) + (fileList?.subdirectories?.length || 0);

        let nonIdealState: React.ReactNode;

        // Show loading spinner if we've been loading for more than 500 ms, or if there are no existing files in the list
        if (this.props.extendedLoading || (!unfilteredEntryCount && this.props.loading)) {
            let description = "Loading file list";
            let progress = 0;

            const fileProgress = this.props.fileProgress;
            if (fileProgress && fileProgress.total && fileProgress.total > 0) {
                description = `Loading ${fileProgress.checked || 0} / ${fileProgress.total}`;
                progress = (fileProgress.checked || 0) / fileProgress.total;
            }

            nonIdealState = (
                <NonIdealState icon={<Spinner value={progress} intent="primary" />} title={"Loading file list"} description={description}>
                    <Button intent="warning" onClick={this.props.onListCancelled}>
                        Cancel
                    </Button>
                </NonIdealState>
            );
        } else if (!unfilteredEntryCount) {
            nonIdealState = <NonIdealState icon="folder-open" title="Empty folder" description="There are no files or subdirectories in this folder" />;
        } else if (!entryCount) {
            nonIdealState = <NonIdealState icon="search" title="No results" description="There are no files or subdirectories matching the filter expression" />;
        }

        const table = (
            <Table
                ref={ref => {
                    this.tableRef = ref;
                }}
                className={classes.join(" ")}
                enableRowReordering={false}
                renderMode={RenderMode.NONE}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={false}
                columnWidths={this.columnWidths}
                minColumnWidth={80}
                enableMultipleSelection={true}
                enableRowResizing={false}
                defaultRowHeight={FileListTableComponent.RowHeight}
                onColumnWidthChanged={this.handleColumnWidthChanged}
                selectedRegions={this.selectedRegions}
                enableRowHeader={false}
                numRows={this.tableEntries.length}
                loadingOptions={this.props.loading ? [TableLoadingOption.CELLS] : []}
                cellRendererDependencies={[this.tableEntries, this.props.sortingString, this.props.filterString]} // trigger re-render on sorting change
                getCellClipboardData={undefined}
            >
                <Column name="Filename" columnHeaderCellRenderer={() => this.renderColumnHeader("Filename")} cellRenderer={this.renderFilenames} />
                <Column name="Type" columnHeaderCellRenderer={() => this.renderColumnHeader("Type")} cellRenderer={this.renderTypes} />
                <Column name="Size" columnHeaderCellRenderer={() => this.renderColumnHeader("Size")} cellRenderer={this.renderSizes} />
                <Column name="Date" columnHeaderCellRenderer={() => this.renderColumnHeader("Date")} cellRenderer={this.renderDates} />
            </Table>
        );

        return (
            <div className="file-table-container">
                {nonIdealState}
                {table}
            </div>
        );
    }
}

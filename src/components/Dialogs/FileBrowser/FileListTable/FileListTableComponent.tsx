import * as React from "react";
import {action, autorun, computed, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";
import {Cell, Column, ColumnHeaderCell2, Regions, Region, RenderMode, SelectionModes, Table2, TableLoadingOption} from "@blueprintjs/table";
import {Button, Icon, Label, NonIdealState, Spinner} from "@blueprintjs/core";
import globToRegExp from "glob-to-regexp";
import moment from "moment";
import FuzzySearch from "fuzzy-search";
import {CARTA} from "carta-protobuf";
import {BrowserMode, FileFilteringType, ISelectedFile} from "stores";
import {toFixed} from "utilities";
import "./FileListTableComponent.scss";

interface FileEntry extends ISelectedFile {
    filename: string;
    typeInfo?: {type: string; description: string};
    isDirectory?: boolean;
    size?: number;
    date?: number;
    fileInfo?: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    hdu?: string;
}

export interface FileListTableComponentProps {
    darkTheme: boolean;
    loading?: boolean;
    extendedLoading?: boolean;
    fileProgress?: {total: number; checked: number};
    listResponse: CARTA.IFileListResponse | CARTA.ICatalogListResponse;
    selectedFile: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
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
    @observable selectedRegions: Region[];
    @observable columnWidths = [350, 80, 90, 95];

    private static readonly RowHeight = 22;
    private tableRef: Table2;
    private cachedFilterString: string;
    private cachedSortingString: string;
    private cachedFileResponse: CARTA.IFileListResponse | CARTA.ICatalogListResponse;
    private rowPivotIndex: number = -1;

    private static readonly FileTypeMap = new Map<CARTA.FileType, {type: string; description: string}>([
        [CARTA.FileType.CASA, {type: "CASA", description: "CASA Image"}],
        [CARTA.FileType.CRTF, {type: "CRTF", description: "CASA Region Text Format"}],
        [CARTA.FileType.DS9_REG, {type: "DS9", description: "DS9 Region Format"}],
        [CARTA.FileType.FITS, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.FileType.HDF5, {type: "HDF5", description: "HDF5 File (IDIA Schema)"}],
        [CARTA.FileType.MIRIAD, {type: "Miriad", description: "Miriad Image"}]
    ]);

    private static readonly CatalogFileTypeMap = new Map<CARTA.CatalogFileType, {type: string; description: string}>([
        [CARTA.CatalogFileType.FITSTable, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.CatalogFileType.VOTable, {type: "VOTable", description: "XML-Based Table Format"}]
    ]);

    private static GetFileTypeDisplay(type: CARTA.FileType) {
        return FileListTableComponent.FileTypeMap.get(type) || {type: "Unknown", description: "An unknown file format"};
    }

    private static GeCatalogFileTypeDisplay(type: CARTA.CatalogFileType) {
        return FileListTableComponent.CatalogFileTypeMap.get(type) || {type: "Unknown", description: "An unknown file format"};
    }

    private static GetFileSizeDisplay(sizeInBytes: number): string {
        if (sizeInBytes >= 1e12) {
            return `${toFixed(sizeInBytes / 1e12, 2)} TB`;
        } else if (sizeInBytes >= 1e9) {
            return `${toFixed(sizeInBytes / 1e9, 1)} GB`;
        } else if (sizeInBytes >= 1e6) {
            return `${toFixed(sizeInBytes / 1e6, 1)} MB`;
        } else if (sizeInBytes >= 1e3) {
            return `${toFixed(sizeInBytes / 1e3, 1)} kB`;
        } else {
            return `${sizeInBytes} B`;
        }
    }

    @computed get tableEntries(): FileEntry[] {
        const fileResponse = this.props.listResponse;
        if (!fileResponse) {
            return [];
        }

        const fileBrowserMode = this.props.fileBrowserMode;

        let filteredSubdirectories = fileResponse?.subdirectories?.slice();
        let filteredFiles = fileResponse?.files?.slice();

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
                    filteredSubdirectories = filteredSubdirectories?.filter(info => info.name.toLowerCase().match(regex));
                    // @ts-ignore
                    filteredFiles = filteredFiles?.filter(file => file.name.toLowerCase().match(regex));
                } else {
                    // Strict regex search is case-sensitive
                    regex = RegExp(filterString);
                    filteredSubdirectories = filteredSubdirectories?.filter(info => info.name.match(regex));
                    // @ts-ignore
                    filteredFiles = filteredFiles?.filter(file => file.name.match(regex));
                }
            } catch (e) {
                if (e.name !== "SyntaxError") {
                    console.log(e);
                }
            }
        }

        const entries: FileEntry[] = [];
        const sortingConfig = {direction: this.props.sortingString.startsWith("+") ? 1 : -1, columnName: this.props.sortingString.substring(1).toLowerCase()};
        if (filteredSubdirectories && filteredSubdirectories.length) {
            switch (sortingConfig?.columnName) {
                case "filename":
                    filteredSubdirectories.sort((a, b) => sortingConfig.direction * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                    break;
                case "size":
                    filteredSubdirectories.sort((a, b) => sortingConfig.direction * (a.itemCount < b.itemCount ? -1 : 1));
                    break;
                case "date":
                    filteredSubdirectories.sort((a, b) => sortingConfig.direction * (a.date < b.date ? -1 : 1));
                    break;
                default:
                    break;
            }

            for (const directory of filteredSubdirectories) {
                entries.push({
                    filename: directory.name,
                    size: directory.itemCount > 0 ? directory.itemCount : undefined,
                    date: directory.date as number,
                    isDirectory: true
                });
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
                for (const file of filteredFiles as CARTA.ICatalogFileInfo[]) {
                    entries.push({
                        filename: file.name,
                        typeInfo: FileListTableComponent.GeCatalogFileTypeDisplay(file.type),
                        size: file.fileSize as number,
                        date: file.date as number,
                        fileInfo: file
                    });
                }
            } else if (fileBrowserMode === BrowserMode.File) {
                for (const file of filteredFiles as CARTA.IFileInfo[]) {
                    for (const hdu of file.HDUList) {
                        const filename = file.HDUList.length > 1 ? `${file.name}: HDU ${hdu}` : file.name;
                        entries.push({
                            filename,
                            typeInfo: FileListTableComponent.GetFileTypeDisplay(file.type),
                            size: file.size as number,
                            date: file.date as number,
                            fileInfo: file,
                            hdu
                        });
                    }
                }
            } else {
                for (const file of filteredFiles as CARTA.IFileInfo[]) {
                    entries.push({
                        filename: file.name,
                        typeInfo: FileListTableComponent.GetFileTypeDisplay(file.type),
                        size: file.size as number,
                        date: file.date as number,
                        fileInfo: file
                    });
                }
            }
        }
        return entries;
    }

    @computed get selectedFiles(): ISelectedFile[] {
        if (!this.tableEntries?.length || !this.selectedRegions?.length) {
            return [];
        }
        const files = [];
        for (const selection of this.selectedRegions) {
            for (let i = selection.rows[0]; i <= selection.rows[1]; i++) {
                if (i >= 0 && i < this.tableEntries.length) {
                    const f = this.tableEntries[i];
                    files.push(f);
                }
            }
        }
        return files;
    }

    constructor(props: FileListTableComponentProps) {
        super(props);
        makeObservable(this);

        // Automatically scroll to the top of the table when a new file response is received, or when filtering/sorting changes
        autorun(() => {
            const fileResponse = this.props.listResponse;
            const sortingString = this.props.sortingString;
            const filterString = this.props.filterString;

            if (fileResponse !== this.cachedFileResponse || sortingString !== this.cachedSortingString || filterString !== this.cachedFilterString) {
                this.cachedSortingString = sortingString;
                this.cachedFilterString = filterString;
                this.cachedFileResponse = fileResponse;
                runInAction(() => (this.selectedRegions = []));
                this.rowPivotIndex = -1;
                this.props.onSelectionChanged([]);

                setTimeout(() => this.tableRef?.scrollToRegion(Regions.row(0, 0)), 20);
            }
        });
    }

    @action selectEntry = (entry: FileEntry, index) => {
        if (entry) {
            if (entry.isDirectory) {
                this.props.onFolderClicked(entry.filename);
                this.selectedRegions = undefined;
                this.rowPivotIndex = -1;
                this.props.onSelectionChanged([]);
            } else {
                this.props.onFileClicked(entry);
                this.selectedRegions = [Regions.row(index)];
                this.rowPivotIndex = index;
                this.props.onSelectionChanged(this.selectedFiles);
            }
        }
    };

    @action handleColumnWidthChanged = (index: number, size: number) => {
        if (index >= 0 && index < this.columnWidths.length) {
            this.columnWidths[index] = size;
        }
    };

    private renderColumnHeader = (name: string, _index?: number) => {
        const sortingConfig = {direction: this.props.sortingString.startsWith("+") ? 1 : -1, columnName: this.props.sortingString.substring(1).toLowerCase()};
        const sortColumn = name.toLowerCase() === sortingConfig?.columnName;
        const sortDesc = sortingConfig?.direction < 0;

        const nameRenderer = () => {
            if (sortColumn) {
                return (
                    <div className="sort-label" onClick={() => this.props.onSortingChanged(name, -sortingConfig.direction)}>
                        <Label className="bp4-inline label">
                            <Icon className="sort-icon" icon={sortDesc ? "sort-desc" : "sort-asc"} />
                            {name}
                        </Label>
                    </div>
                );
            } else {
                return (
                    <div className="sort-label" onClick={() => this.props.onSortingChanged(name, 1)}>
                        <Label className="bp4-inline label">
                            <Icon className="sort-icon inactive" icon="sort" />
                            {name}
                        </Label>
                    </div>
                );
            }
        };
        return <ColumnHeaderCell2 className={"column-name"} nameRenderer={nameRenderer} />;
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
        const sizeInBytes = entry?.size;
        return (
            <Cell>
                <React.Fragment>
                    <div onClick={event => this.handleEntryClicked(event, entry, rowIndex)} onDoubleClick={() => this.handleEntryDoubleClicked(entry)}>
                        {isFinite(sizeInBytes) && !entry.isDirectory && FileListTableComponent.GetFileSizeDisplay(sizeInBytes)}
                        {isFinite(sizeInBytes) && entry.isDirectory && `${sizeInBytes} items`}
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
        let dateString: string;
        if (unixDate > 0) {
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
        if (entry?.isDirectory) {
            return;
        }
        this.props.onFileDoubleClicked(entry);
    };

    @action private handleEntryClicked = (event: React.MouseEvent, entry: FileEntry, index: number) => {
        if (entry) {
            if (entry.isDirectory) {
                this.props.onFolderClicked(entry.filename);
                this.selectedRegions = [];
                this.rowPivotIndex = -1;
            } else {
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
                    for (let i = range.rows[0]; i <= range.rows[1]; i++) {
                        this.selectedRegions.push(Regions.row(i));
                    }
                } else {
                    this.selectedRegions = [Regions.row(index)];
                    this.rowPivotIndex = index;
                }
                if (this.selectedRegions?.length === 1) {
                    this.props.onFileClicked(this.tableEntries[this.selectedRegions[0].rows[0]]);
                }
            }
        }
        this.props.onSelectionChanged(this.selectedFiles);
    };

    render() {
        const fileResponse = this.props.listResponse;

        const classes = ["browser-table"];
        if (this.props.darkTheme) {
            classes.push("bp4-dark");
        }

        const entryCount = this.tableEntries.length;
        const unfilteredEntryCount = (fileResponse?.files?.length || 0) + (fileResponse?.subdirectories?.length || 0);

        let nonIdealState: React.ReactNode;

        // Show loading spinner if we've been loading for more than 500 ms, or if there are no existing files in the list
        if (this.props.extendedLoading || (!unfilteredEntryCount && this.props.loading)) {
            let description: string;
            let progress: number;

            const fileProgress = this.props.fileProgress;
            if (fileProgress?.total > 0) {
                description = `Loading ${fileProgress.checked} / ${fileProgress.total}`;
                progress = fileProgress.checked / fileProgress.total;
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
            <Table2
                ref={ref => (this.tableRef = ref)}
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
                cellRendererDependencies={[this.props.sortingString]} // trigger re-render on sorting change
            >
                <Column name="Filename" columnHeaderCellRenderer={() => this.renderColumnHeader("Filename")} cellRenderer={this.renderFilenames} />
                <Column name="Type" columnHeaderCellRenderer={() => this.renderColumnHeader("Type")} cellRenderer={this.renderTypes} />
                <Column name="Size" columnHeaderCellRenderer={() => this.renderColumnHeader("Size")} cellRenderer={this.renderSizes} />
                <Column name="Date" columnHeaderCellRenderer={() => this.renderColumnHeader("Date")} cellRenderer={this.renderDates} />
            </Table2>
        );

        return (
            <div className="file-table-container">
                {nonIdealState}
                {table}
            </div>
        );
    }
}

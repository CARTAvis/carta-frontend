import * as React from "react";
import {action, autorun, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Cell, Column, ColumnHeaderCell, Regions, RenderMode, SelectionModes, Table} from "@blueprintjs/table";
import {IRegion} from "@blueprintjs/table/src/regions";
import {Icon, Label, Menu, MenuItem} from "@blueprintjs/core";
import globToRegExp from "glob-to-regexp";
import * as moment from "moment";
import {CARTA} from "carta-protobuf";
import {BrowserMode} from "stores";
import {toFixed} from "utilities";
import "./FileListTableComponent.css";

interface FileEntry {
    filename: string;
    typeInfo?: { type: string, description: string };
    isDirectory?: boolean;
    size?: number;
    date?: number;
    file?: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    hdu?: string;
}

export interface FileListTableComponentProps {
    darkTheme: boolean;
    listResponse: CARTA.IFileListResponse | CARTA.ICatalogListResponse;
    selectedFile: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    selectedHDU: string;
    filterString?: string;
    fileBrowserMode: BrowserMode;
    onFileClicked: (file: CARTA.IFileInfo | CARTA.ICatalogFileInfo, hdu?: string) => void;
    onFileDoubleClicked: (file: CARTA.IFileInfo | CARTA.ICatalogFileInfo, hdu?: string) => void;
    onFolderClicked: (folder: string) => void;
}

@observer
export class FileListTableComponent extends React.Component<FileListTableComponentProps> {
    @observable sortColumn: string = "Filename";
    @observable sortDirection: number = 1;
    @observable selectedRegion: IRegion[];
    @observable columnWidths = [300, 90, 90, 90];

    private static readonly RowHeight = 22;
    private tableRef: Table;
    private cachedFilterString: string;
    private cachedSortString: string;
    private cachedFileResponse: CARTA.IFileListResponse | CARTA.ICatalogListResponse;

    private static readonly FileTypeMap = new Map<CARTA.FileType, { type: string, description: string }>([
        [CARTA.FileType.FITS, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.FileType.CASA, {type: "CASA", description: "CASA Image"}],
        [CARTA.FileType.MIRIAD, {type: "Miriad", description: "Miriad Image"}],
        [CARTA.FileType.HDF5, {type: "HDF5", description: "HDF5 File (IDIA Schema)"}],
        [CARTA.FileType.CRTF, {type: "CRTF", description: "CASA Region Text Format"}],
        [CARTA.FileType.REG, {type: "DS9", description: "DS9 Region Format"}],
    ]);

    private static readonly CatalogFileTypeMap = new Map<CARTA.CatalogFileType, { type: string, description: string }>([
        [CARTA.CatalogFileType.VOTable, {type: "VOTable", description: "XML-Based Table Format"}],
        [CARTA.CatalogFileType.FITSTable, {type: "FITS", description: "Flexible Image Transport System"}],
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
        if (filterString) {
            try {
                let regex: RegExp;
                if (filterString.startsWith("/") && filterString.endsWith("/")) {
                    // Strict regex search is case-sensitive
                    regex = RegExp(filterString.substring(1, filterString.length - 1));
                    filteredSubdirectories = filteredSubdirectories?.filter(value => value.match(regex));
                    // @ts-ignore
                    filteredFiles = filteredFiles?.filter(file => file.name.match(regex));
                } else {
                    // glob search case-insensitive
                    regex = RegExp(globToRegExp(filterString.toLowerCase()));
                    filteredSubdirectories = filteredSubdirectories?.filter(value => value.toLowerCase().match(regex));
                    // @ts-ignore
                    filteredFiles = filteredFiles?.filter(file => file.name.toLowerCase().match(regex));
                }
            } catch (e) {
                if (e.name !== "SyntaxError") {
                    console.log(e);
                }
            }
        }

        const entries: FileEntry[] = [];

        if (filteredSubdirectories && filteredSubdirectories.length) {
            if (this.sortColumn === "Filename") {
                filteredSubdirectories.sort((a, b) => this.sortDirection * (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
            }
            for (const directory of filteredSubdirectories) {
                entries.push({
                    filename: directory,
                    isDirectory: true
                });
            }
        }

        if (filteredFiles && filteredFiles.length) {
            switch (this.sortColumn) {
                case "Filename":
                    filteredFiles.sort((a, b) => this.sortDirection * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                    break;
                case "Type":
                    filteredFiles.sort((a, b) => this.sortDirection * (a.type > b.type ? -1 : 1));
                    break;
                case "Size":
                    filteredFiles.sort((a, b) => this.sortDirection * (a.size < b.size ? -1 : 1));
                    break;
                case "Date":
                    filteredFiles.sort((a, b) => this.sortDirection * (a.date < b.date ? -1 : 1));
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
                        file
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
                            file,
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
                        file
                    });
                }
            }
        }
        return entries;
    }

    constructor(props: FileListTableComponentProps) {
        super(props);

        // Automatically scroll to the top of the table when a new file response is received, or when filtering/sorting changes
        autorun(() => {
            const fileResponse = this.props.listResponse;
            const sortString = `${this.sortColumn} - ${this.sortDirection}`;
            const filterString = this.props.filterString;

            if (fileResponse !== this.cachedFileResponse || sortString !== this.cachedSortString || filterString !== this.cachedFilterString) {
                this.cachedSortString = sortString;
                this.cachedFilterString = filterString;
                this.cachedFileResponse = fileResponse;
                this.tableRef?.scrollToRegion(Regions.row(0, 0));
            }
        });
    }

    @action setSorting = (columnName: string, direction: number) => {
        this.sortColumn = columnName;
        this.sortDirection = Math.sign(direction);
    };

    @action clearSorting = () => {
        this.sortColumn = undefined;
        this.sortDirection = 0;
    };

    @action selectEntry = (entry: FileEntry, index) => {
        if (entry) {
            if (entry.isDirectory) {
                this.props.onFolderClicked(entry.filename);
                this.selectedRegion = undefined;
            } else {
                this.props.onFileClicked(entry.file, entry.hdu);
                this.selectedRegion = [Regions.row(index)];
            }
        }
    };

    @action handleColumnWidthChanged = (index: number, size: number) => {
        if (index >= 0 && index < this.columnWidths.length) {
            this.columnWidths[index] = size;
        }
    };

    private renderColumnHeader = (name: string, index?: number) => {
        const sortColumn = name === this.sortColumn;
        const sortDesc = this.sortDirection < 0;

        const menuRenderer = () => {
            return (
                <Menu className="catalog-sort-menu-item">
                    <MenuItem icon="sort-asc" active={this.sortDirection > 0} onClick={() => this.setSorting(name, 1)} text="Sort Asc"/>
                    <MenuItem icon="sort-desc" active={this.sortDirection < 0} onClick={() => this.setSorting(name, -1)} text="Sort Desc"/>
                    <MenuItem icon="cross" onClick={this.clearSorting} text="Clear Sort"/>
                </Menu>
            );
        };

        const nameRenderer = () => {
            if (sortColumn) {
                return (
                    <Label className="bp3-inline label">
                        <Icon className="sort-icon" icon={sortDesc ? "sort-desc" : "sort-asc"}/>
                        {name}
                    </Label>
                );
            } else {
                return (
                    <Label className="bp3-inline label">
                        {name}
                    </Label>
                );
            }
        };
        return <ColumnHeaderCell className={"column-name"} nameRenderer={nameRenderer} menuRenderer={menuRenderer}/>;
    };

    private renderFilenames = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        return (
            <Cell className="filename-cell" tooltip={entry?.filename}>
                <React.Fragment>
                    <div
                        onClick={() => this.handleEntryClicked(entry, rowIndex)}
                        onDoubleClick={() => this.handleEntryDoubleClicked(entry)}
                    >
                        {entry?.isDirectory && <Icon icon="folder-close"/>}
                        {entry?.filename}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private renderTypes = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        return (
            <Cell tooltip={entry.typeInfo?.description}>
                <React.Fragment>
                    <div
                        onClick={() => this.handleEntryClicked(entry, rowIndex)}
                        onDoubleClick={() => this.handleEntryDoubleClicked(entry)}
                    >
                        {entry.typeInfo?.type}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private renderSizes = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        const sizeInBytes = entry?.size;
        return (
            <Cell>
                <React.Fragment>
                    <div
                        onClick={() => this.handleEntryClicked(entry, rowIndex)}
                        onDoubleClick={() => this.handleEntryDoubleClicked(entry)}
                    >
                        {isFinite(sizeInBytes) && FileListTableComponent.GetFileSizeDisplay(sizeInBytes)}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private renderDates = (rowIndex: number) => {
        const entry = this.tableEntries[rowIndex];
        const unixDate = entry?.date;

        let dateString: string;
        if (unixDate > 0) {
            const t = moment.unix(unixDate);
            const isToday = moment(0, "HH").diff(t, "days") === 0;
            if (isToday) {
                dateString = t.format("HH:mm");
            } else {
                dateString = t.format("D MMM YYYY");
            }
        }

        return (
            <Cell className="time-cell">
                <React.Fragment>
                    <div
                        onClick={() => this.handleEntryClicked(entry, rowIndex)}
                        onDoubleClick={() => this.handleEntryDoubleClicked(entry)}
                    >
                        {dateString}
                    </div>
                </React.Fragment>
            </Cell>
        );
    };

    private handleEntryDoubleClicked = (entry: FileEntry) => {
        if (entry.isDirectory) {
            return;
        }
        this.props.onFileDoubleClicked(entry.file, entry.hdu);
    };

    private handleEntryClicked = (entry: FileEntry, index) => {
        if (entry) {
            if (entry.isDirectory) {
                this.props.onFolderClicked(entry.filename);
                this.selectedRegion = [];
            } else {
                this.props.onFileClicked(entry.file, entry.hdu);
                this.selectedRegion = [Regions.row(index)];
            }
        }
    };

    render() {
        const fileResponse = this.props.listResponse;
        const sorting = `${this.sortColumn} - ${this.sortDirection}`;

        const classes = ["browser-table"];
        if (this.props.darkTheme) {
            classes.push("bp3-dark");
        }

        return (
            <Table
                ref={ref => this.tableRef = ref}
                className={classes.join(" ")}
                enableRowReordering={false}
                renderMode={RenderMode.NONE}
                selectionModes={SelectionModes.NONE}
                enableGhostCells={false}
                columnWidths={this.columnWidths}
                minColumnWidth={80}
                enableMultipleSelection={false}
                enableRowResizing={false}
                defaultRowHeight={FileListTableComponent.RowHeight}
                onColumnWidthChanged={this.handleColumnWidthChanged}
                selectedRegions={this.selectedRegion}
                enableRowHeader={false}
                numRows={this.tableEntries.length}
            >
                <Column name="Filename" columnHeaderCellRenderer={() => this.renderColumnHeader("Filename")} cellRenderer={this.renderFilenames}/>
                <Column name="Type" columnHeaderCellRenderer={() => this.renderColumnHeader("Type")} cellRenderer={this.renderTypes}/>
                <Column name="Size" columnHeaderCellRenderer={() => this.renderColumnHeader("Size")} cellRenderer={this.renderSizes}/>
                <Column name="Date" columnHeaderCellRenderer={() => this.renderColumnHeader("Date")} cellRenderer={this.renderDates}/>
            </Table>
        );
    }
}
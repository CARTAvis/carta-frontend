import * as React from "react";
import {action, computed, observable} from "mobx";
import {observer} from "mobx-react";
import {Cell, Column, ColumnHeaderCell, RenderMode, SelectionModes, Table, Regions} from "@blueprintjs/table";
import {IRegion} from "@blueprintjs/table/src/regions";
import {Icon, Label, Menu, MenuItem} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {BrowserMode} from "stores";
import "./FileListTableComponent.css";
import {toFixed} from "utilities";

interface FileEntry {
    filename: string;
    typeInfo?: { type: string, description: string };
    isDirectory?: boolean;
    size?: number;
    file?: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    hdu?: string;
}

export interface FileListTableComponentProps {
    darkTheme: boolean;
    listResponse: CARTA.IFileListResponse | CARTA.ICatalogListResponse;
    selectedFile: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    selectedHDU: string;
    fileBrowserMode: BrowserMode;
    onFileClicked: (file: CARTA.IFileInfo | CARTA.ICatalogFileInfo, hdu?: string) => void;
    onFileDoubleClicked: (file: CARTA.FileInfo | CARTA.CatalogFileInfo, hdu?: string) => void;
    onFolderClicked: (folder: string, absolute: boolean) => void;
}

@observer
export class FileListTableComponent extends React.Component<FileListTableComponentProps> {
    @observable sortColumn: string = "Filename";
    @observable sortDirection: number = 1;
    @observable selectedRegion: IRegion[];

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
        const fileBrowserMode = this.props.fileBrowserMode;

        const entries: FileEntry[] = [];

        let sortedDirectories = [];
        if (fileResponse.subdirectories && fileResponse.subdirectories.length) {
            sortedDirectories = fileResponse.subdirectories.slice();
            if (this.sortColumn === "Filename") {
                sortedDirectories.sort((a, b) => this.sortDirection * (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
            }
        }

        for (const directory of sortedDirectories) {
            entries.push({
                filename: directory,
                isDirectory: true
            });
        }

        let sortedFiles = [];
        if (fileResponse.files && fileResponse.files.length) {
            sortedFiles = fileResponse.files.slice();
            switch (this.sortColumn) {
                case "Filename":
                    sortedFiles.sort((a, b) => this.sortDirection * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                    break;
                case "Type":
                    sortedFiles.sort((a, b) => this.sortDirection * (a.type > b.type ? -1 : 1));
                    break;
                case "Size":
                    sortedFiles.sort((a, b) => this.sortDirection * (a.size < b.size ? -1 : 1));
                    break;
                default:
                    break;
            }
        }

        if (fileBrowserMode === BrowserMode.Catalog) {
            for (const file of sortedFiles) {
                entries.push({
                    filename: file.name,
                    typeInfo: FileListTableComponent.GeCatalogFileTypeDisplay(file.type),
                    file
                });
            }
        } else if (fileBrowserMode === BrowserMode.File) {
            for (const file of sortedFiles) {
                for (const hdu of file.HDUList) {
                    const filename = file.HDUList.length > 1 ? `${file.name}: HDU ${hdu}` : file.name;
                    entries.push({
                        filename,
                        typeInfo: FileListTableComponent.GetFileTypeDisplay(file.type),
                        size: file.size as number,
                        file,
                        hdu
                    });
                }
            }
        } else {
            for (const file of sortedFiles) {
                entries.push({
                    filename: file.name,
                    typeInfo: FileListTableComponent.GetFileTypeDisplay(file.type),
                    size: file.size as number,
                    file
                });
            }
        }

        return entries;
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
                this.props.onFolderClicked(entry.filename, false);
                this.selectedRegion = undefined;
            } else {
                this.props.onFileClicked(entry.file, entry.hdu);
                this.selectedRegion = [Regions.row(index)];
            }
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
        return <Cell>{entry.filename}</Cell>;
    };

    private renderTypes = (rowIndex: number) => {
        return <Cell>{this.tableEntries[rowIndex].typeInfo?.type}</Cell>;
    };

    private renderSizes = (rowIndex: number) => {
        const sizeInBytes = this.tableEntries[rowIndex].size;
        if (isFinite(sizeInBytes)) {
            return <Cell>{FileListTableComponent.GetFileSizeDisplay(sizeInBytes)}</Cell>;
        } else {
            return <Cell/>;
        }
    };

    private onSelection = (selectedRegions: IRegion[]) => {
        if (!selectedRegions?.length || !selectedRegions[0].rows?.length) {
            return;
        }
        const index = selectedRegions[0].rows[0];

        const entry = this.tableEntries[index];
        if (entry) {
            if (entry.isDirectory) {
                this.props.onFolderClicked(entry.filename, false);
                this.selectedRegion = [];
            } else {
                this.props.onFileClicked(entry.file, entry.hdu);
                this.selectedRegion = selectedRegions;
            }
        }
    };

    render() {
        const fileResponse = this.props.listResponse;

        if (!fileResponse?.files) {
            return null;
        }

        const sorting = `${this.sortColumn} - ${this.sortDirection}`;
        return (
            <Table
                className={"column-filter"}
                enableRowReordering={false}
                selectionModes={SelectionModes.ROWS_AND_CELLS}
                enableGhostCells={true}
                enableMultipleSelection={false}
                enableRowResizing={false}
                defaultRowHeight={24}
                onSelection={this.onSelection}
                selectedRegions={this.selectedRegion}
                enableRowHeader={false}
                numRows={this.tableEntries.length}
            >
                <Column name="Filename" columnHeaderCellRenderer={() => this.renderColumnHeader("Filename")} cellRenderer={this.renderFilenames}/>
                <Column name="Type" columnHeaderCellRenderer={() => this.renderColumnHeader("Type")} cellRenderer={this.renderTypes}/>
                <Column name="Size" columnHeaderCellRenderer={() => this.renderColumnHeader("Size")} cellRenderer={this.renderSizes}/>
            </Table>
        );
    }
}
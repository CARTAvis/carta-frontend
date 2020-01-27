import * as React from "react";
import {Icon, NonIdealState, Spinner, HTMLTable, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {toFixed} from "utilities";
import "./FileListComponent.css";

export class FileListComponent extends React.Component<{
    darkTheme: boolean,
    files: CARTA.IFileListResponse,
    selectedFile: CARTA.IFileInfo,
    selectedHDU: string,
    onFileClicked: (file: CARTA.FileInfo, hdu: string) => void,
    onFileDoubleClicked: (file: CARTA.FileInfo, hdu: string) => void,
    onFolderClicked: (folder: string, absolute: boolean) => void
}, { sortColumn: string, sortDirection: number }> {

    private static readonly FileTypeMap = new Map<CARTA.FileType, { type: string, description: string }>([
        [CARTA.FileType.FITS, {type: "FITS", description: "Flexible Image Transport System"}],
        [CARTA.FileType.CASA, {type: "CASA", description: "CASA Image"}],
        [CARTA.FileType.MIRIAD, {type: "Miriad", description: "ATNF Miriad Image"}],
        [CARTA.FileType.HDF5, {type: "HDF5", description: "HDF5 File (IDIA Schema)"}],
        [CARTA.FileType.CRTF, {type: "CRTF", description: "CASA Region Text Format"}],
        [CARTA.FileType.REG, {type: "DS9", description: "DS9 Region Format"}],
    ]);

    constructor(props: any) {
        super(props);
        this.state = {sortColumn: "name", sortDirection: 1};
    }

    public render() {
        const fileEntries = [];
        const fileList = this.props.files;
        if (fileList) {
            let sortedDirectories = [];
            if (fileList.subdirectories && fileList.subdirectories.length) {
                sortedDirectories = fileList.subdirectories.slice();
                if (this.state.sortColumn === "name") {
                    sortedDirectories.sort((a, b) => this.state.sortDirection * (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
                } else {
                    sortedDirectories.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
                }
            }

            fileEntries.push(sortedDirectories.map(dir => {
                return (
                    <tr key={dir} onClick={() => this.props.onFolderClicked(dir, false)} className="file-table-entry">
                        <td><Icon icon="folder-close"/></td>
                        <td>{dir}</td>
                        <td/>
                        <td/>
                    </tr>
                );
            }));

            let sortedFiles = [];
            if (fileList.files && fileList.files.length) {
                sortedFiles = fileList.files.slice();
                switch (this.state.sortColumn) {
                    case "name":
                        sortedFiles.sort((a, b) => this.state.sortDirection * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                        break;
                    case "type":
                        sortedFiles.sort((a, b) => this.state.sortDirection * (a.type > b.type ? -1 : 1));
                        break;
                    case "size":
                    default:
                        sortedFiles.sort((a, b) => this.state.sortDirection * (a.size < b.size ? -1 : 1));
                        break;
                }
            }

            fileEntries.push(sortedFiles.map((file: CARTA.FileInfo) => {
                return file.HDUList.map(hdu => {
                    let className = "file-table-entry";
                    if (file === this.props.selectedFile && hdu === this.props.selectedHDU) {
                        className += " file-table-entry-selected";
                    }

                    const typeInfo = this.getFileTypeDisplay(file.type);
                    const fileName = file.HDUList.length > 1 ? `${file.name}: HDU ${hdu}` : file.name;
                    return (
                        <tr key={`${file.name}:${hdu}`} onDoubleClick={() => this.props.onFileDoubleClicked(file, hdu)} onClick={() => this.props.onFileClicked(file, hdu)} className={className}>
                            <td><Icon icon="document"/></td>
                            <td><Tooltip hoverOpenDelay={1000} content={fileName}>{fileName}</Tooltip></td>
                            <td><Tooltip hoverOpenDelay={1000} content={typeInfo.description}>{typeInfo.type}</Tooltip></td>
                            <td style={{whiteSpace: "nowrap"}}>{this.getFileSizeDisplay(file.size as number)}</td>
                        </tr>
                    );
                });
            }));
        }

        if (fileList) {
            return (
                <React.Fragment>
                    <HTMLTable small={true} className="file-table">
                        <thead>
                        <tr>
                            <th id="file-header-icon" className={this.props.darkTheme ? "dark-theme" : ""}/>
                            <th onClick={() => this.setSortColumn("name")} id="file-header-name" className={this.props.darkTheme ? "dark-theme" : ""}>
                                File Name
                                {this.state.sortColumn === "name" &&
                                <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                }
                            </th>
                            <th onClick={() => this.setSortColumn("type")} id="file-header-type" className={this.props.darkTheme ? "dark-theme" : ""}>
                                Type
                                {this.state.sortColumn === "type" &&
                                <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                }
                            </th>
                            <th onClick={() => this.setSortColumn("size")} id="file-header-size" className={this.props.darkTheme ? "dark-theme" : ""}>
                                Size
                                {this.state.sortColumn === "size" &&
                                <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                }
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {fileEntries}
                        </tbody>
                    </HTMLTable>
                </React.Fragment>
            );
        } else {
            return <NonIdealState icon={<Spinner className="fileBrowserLoadingSpinner"/>} title={"Loading files"}/>;
        }
    }

    private setSortColumn(column: string) {
        if (this.state.sortColumn === column) {
            this.setState({sortDirection: this.state.sortDirection * -1});
        } else {
            this.setState({sortDirection: 1, sortColumn: column});
        }
    }

    private getFileSizeDisplay(sizeInBytes: number): string {
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

    private getFileTypeDisplay(type: CARTA.FileType) {
        return FileListComponent.FileTypeMap.get(type) || {type: "Unknown", description: "An unknown file format"};
    }
}
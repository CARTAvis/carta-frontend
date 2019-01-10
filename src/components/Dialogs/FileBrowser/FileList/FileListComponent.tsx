import * as React from "react";
import {Icon, NonIdealState, Spinner, HTMLTable} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import "./FileListComponent.css";

export class FileListComponent extends React.Component<{
    files: CARTA.FileListResponse,
    selectedFile: CARTA.FileInfo,
    selectedHDU: string,
    onFileClicked: (file: CARTA.FileInfo, hdu: string) => void,
    onFileDoubleClicked: (file: CARTA.FileInfo, hdu: string) => void,
    onFolderClicked: (folder: string) => void
}, { sortColumn: string, sortDirection: number }> {

    constructor(props: any) {
        super(props);
        this.state = {sortColumn: "name", sortDirection: 1};
    }

    public render() {
        const fileEntries = [];
        const fileList = this.props.files;
        if (fileList) {
            if (fileList.parent) {
                fileEntries.push(
                    <tr key="parent" onClick={() => this.props.onFolderClicked("..")} className="file-table-entry">
                        <td><Icon icon="folder-close"/></td>
                        <td>..</td>
                        <td/>
                        <td/>
                    </tr>
                );
            }

            let sortedDirectories: string[];
            switch (this.state.sortColumn) {
                case "name":
                    sortedDirectories = fileList.subdirectories.sort((a, b) => this.state.sortDirection * (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
                    break;
                default:
                    sortedDirectories = fileList.subdirectories.sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
                    break;
            }

            fileEntries.push(sortedDirectories.map(dir => {
                return (
                    <tr key={dir} onClick={() => this.props.onFolderClicked(dir)} className="file-table-entry">
                        <td><Icon icon="folder-close"/></td>
                        <td>{dir}</td>
                        <td/>
                        <td/>
                    </tr>
                );
            }));

            let sortedFiles;
            switch (this.state.sortColumn) {
                case "name":
                    sortedFiles = fileList.files.sort((a, b) => this.state.sortDirection * (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
                    break;
                case "type":
                    sortedFiles = fileList.files.sort((a, b) => this.state.sortDirection * (a.type > b.type ? -1 : 1));
                    break;
                case "size":
                default:
                    sortedFiles = fileList.files.sort((a, b) => this.state.sortDirection * (a.size < b.size ? -1 : 1));
                    break;
            }
            fileEntries.push(sortedFiles.map((file: CARTA.FileInfo) => {
                return file.HDUList.map(hdu => {
                    let className = "file-table-entry";
                    if (file === this.props.selectedFile && hdu === this.props.selectedHDU) {
                        className += " file-table-entry-selected";
                    }
                    return (
                        <tr key={`${file.name}:${hdu}`} onDoubleClick={() => this.props.onFileDoubleClicked(file, hdu)} onClick={() => this.props.onFileClicked(file, hdu)} className={className}>
                            <td><Icon icon="document"/></td>
                            <td>{file.HDUList.length > 1 ? `${file.name}: HDU ${hdu}` : file.name}</td>
                            <td>{this.getFileTypeDisplay(file.type)}</td>
                            <td>{this.getFileSizeDisplay(file.size as number)}</td>
                        </tr>
                    );
                });
            }));
        }

        if (fileList) {
            return (
                <HTMLTable small={true} className="file-table">
                    <thead>
                    <tr>
                        <th id="file-header-icon"/>
                        <th onClick={() => this.setSortColumn("name")} id="file-header-name">
                            File Name
                            {this.state.sortColumn === "name" &&
                            <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                            }
                        </th>
                        <th onClick={() => this.setSortColumn("type")} id="file-header-type">
                            Type
                            {this.state.sortColumn === "type" &&
                            <Icon icon={this.state.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                            }
                        </th>
                        <th onClick={() => this.setSortColumn("size")} id="file-header-size">
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
        if (sizeInBytes >= 1e9) {
            return `${(sizeInBytes / 1e9).toFixed(1)} GB`;
        } else if (sizeInBytes >= 1e6) {
            return `${(sizeInBytes / 1e6).toFixed(1)} MB`;
        } else if (sizeInBytes >= 1e3) {
            return `${(sizeInBytes / 1e3).toFixed(1)} kB`;
        } else {
            return `${sizeInBytes} B`;
        }
    }

    private getFileTypeDisplay(type: CARTA.FileType) {
        switch (type) {
            case CARTA.FileType.FITS:
                return "FITS";
            case CARTA.FileType.MIRIAD:
                return "Miriad";
            case CARTA.FileType.CASA:
                return "CASA";
            case CARTA.FileType.HDF5:
                return "HDF5";
            default:
                return "Unknown";
        }
    }
}
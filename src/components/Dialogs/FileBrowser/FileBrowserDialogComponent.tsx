import * as React from "react";
import {observer} from "mobx-react";
import {Button, Dialog, Icon, Intent, NonIdealState, Spinner, Tooltip} from "@blueprintjs/core";
import "./FileBrowserDialogComponent.css";
import {FileBrowserState} from "../../../states/FileBrowserState";
import {CARTA} from "carta-protobuf";
import FileInfo = CARTA.FileInfo;

@observer
export class FileBrowserDialogComponent extends React.Component<{ fileBrowserState: FileBrowserState }> {
    public render() {
        const fileBrowserState = this.props.fileBrowserState;
        const fileEntries = [];

        if (fileBrowserState.fileList) {
            if (fileBrowserState.fileList.parent) {
                fileEntries.push(
                    <tr key="parent" onClick={fileBrowserState.selectParent} className="file-table-entry">
                        <td><Icon icon="folder-close"/></td>
                        <td>..</td>
                        <td/>
                        <td/>
                    </tr>
                );
            }
            fileEntries.push(fileBrowserState.fileList.subdirectories.map(dir => {
                return (
                    <tr key={dir} onClick={() => fileBrowserState.selectFolder(dir)} className="file-table-entry">
                        <td><Icon icon="folder-close"/></td>
                        <td>{dir}</td>
                        <td/>
                        <td/>
                    </tr>
                );
            }));

            let sortedFiles;
            switch (fileBrowserState.sortColumn) {
                case "name":
                    sortedFiles = fileBrowserState.fileList.files.sort((a, b) => fileBrowserState.sortDirection * (a.name > b.name ? -1 : 1));
                    break;
                case "type":
                    sortedFiles = fileBrowserState.fileList.files.sort((a, b) => fileBrowserState.sortDirection * (a.type > b.type ? -1 : 1));
                    break;
                case "size":
                default:
                    sortedFiles = fileBrowserState.fileList.files.sort((a, b) => fileBrowserState.sortDirection * (a.size > b.size ? -1 : 1));
                    break;
            }
            fileEntries.push(sortedFiles.map((file: FileInfo) => {
                return file.HDUList.map(hdu => {
                    const isSelected = file === fileBrowserState.selectedFile && hdu === fileBrowserState.selectedHDU;
                    return (
                        <tr key={`${file.name}:${hdu}`} onClick={() => fileBrowserState.selectFile(file, hdu)} className={isSelected ? "file-table-entry-selected" : "file-table-entry"}>
                            <td><Icon icon="document"/></td>
                            <td>{file.HDUList.length > 1 ? `${file.name}: HDU ${hdu}` : file.name}</td>
                            <td>{this.getFileTypeDisplay(file.type)}</td>
                            <td>{this.getFileSizeDisplay(file.size as number)}</td>
                        </tr>
                    );
                });
            }));
        }

        let infoHeader = "";
        if (fileBrowserState.fileInfoExtended) {
            fileBrowserState.fileInfoExtended.headerEntries.forEach(header => {
                infoHeader += `${header.name}: ${header.value}\n`;
            });
        }

        return (
            <Dialog
                icon={"folder-open"}
                className="file-browser-dialog"
                backdropClassName="file-browser-dialog-backdrop"
                canOutsideClickClose={false}
                lazy={true}
                isOpen={fileBrowserState.fileBrowserDialogVisible}
                onClose={fileBrowserState.hideFileBrowser}
                title="File Browser"
            >
                <div className="pt-dialog-body">
                    {!fileBrowserState.fileList &&
                    <NonIdealState visual={<Spinner className="fileBrowserLoadingSpinner"/>} title={"Loading files"}/>
                    }
                    {fileBrowserState.fileList &&
                    <div style={{display: "flex"}}>
                        <table className="pt-html-table pt-small file-table">
                            <thead>
                            <tr>
                                <th colSpan={2} onClick={() => fileBrowserState.setSortColumn("name")}>
                                    File Name
                                    {fileBrowserState.sortColumn === "name" &&
                                    <Icon icon={fileBrowserState.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                    }
                                </th>
                                <th onClick={() => fileBrowserState.setSortColumn("type")}>
                                    Type
                                    {fileBrowserState.sortColumn === "type" &&
                                    <Icon icon={fileBrowserState.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                    }
                                </th>
                                <th onClick={() => fileBrowserState.setSortColumn("size")}>
                                    Size
                                    {fileBrowserState.sortColumn === "size" &&
                                    <Icon icon={fileBrowserState.sortDirection === 1 ? "symbol-triangle-down" : "symbol-triangle-up"}/>
                                    }
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {fileEntries}
                            </tbody>
                        </table>
                        <div style={{width: "50%"}}>
                            <h4>File Information</h4>
                            {!fileBrowserState.fileInfoExtended &&
                            <div className="pt-non-ideal-state">
                                <div className="pt-non-ideal-state-visual pt-non-ideal-state-icon">
                                    <span className="pt-icon pt-icon-document"/>
                                </div>
                                <h4 className="pt-non-ideal-state-title">No file selected</h4>
                                <div className="pt-non-ideal-state-description">
                                    Select a file from the list on the left.
                                </div>
                            </div>
                            }
                            {fileBrowserState.fileInfoExtended &&
                            <pre className="file-info-pre">
                                {infoHeader}
                            </pre>
                            }
                        </div>
                    </div>
                    }
                </div>
                <div className="pt-dialog-footer">
                    <div className="pt-dialog-footer-actions">
                        <Button intent={Intent.NONE} onClick={fileBrowserState.hideFileBrowser} text="Close"/>
                        <Tooltip content={"Load file to the current frame"}>
                            <Button intent={Intent.PRIMARY} disabled={!fileBrowserState.selectedFile} text="Load"/>
                        </Tooltip>
                        <Tooltip content={"Load file to a new frame"}>
                            <Button intent={Intent.PRIMARY} disabled={!fileBrowserState.selectedFile} text="Load as frame"/>
                        </Tooltip>
                    </div>
                </div>
            </Dialog>
        );
    }

    private getFileSizeDisplay(sizeInBytes: number): string {
        if (sizeInBytes >= 1e9) {
            return `${(sizeInBytes / 1e9).toFixed(1)} GB`;
        }
        else if (sizeInBytes >= 1e6) {
            return `${(sizeInBytes / 1e6).toFixed(1)} MB`;
        }
        else if (sizeInBytes >= 1e3) {
            return `${(sizeInBytes / 1e3).toFixed(1)} kB`;
        }
        else {
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
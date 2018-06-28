import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, Dialog, Intent, Tooltip} from "@blueprintjs/core";
import "./FileBrowserDialogComponent.css";
import {FileBrowserState} from "../../../states/FileBrowserState";
import {CARTA} from "carta-protobuf";
import FileInfo = CARTA.FileInfo;
import {FileListComponent} from "./FileList/FileListComponent";
import {AppState} from "../../../states/AppState";

@observer
export class FileBrowserDialogComponent extends React.Component<{ appState: AppState }> {
    public render() {
        const fileBrowserState = this.props.appState.fileBrowserState;
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
                backdropClassName="minimal-dialog-backdrop"
                canOutsideClickClose={false}
                lazy={true}
                isOpen={fileBrowserState.fileBrowserDialogVisible}
                onClose={fileBrowserState.hideFileBrowser}
                title="File Browser"
            >
                <div className="pt-dialog-body" style={{display: "flex"}}>
                    <div className="file-list-pane">
                        <FileListComponent
                            files={fileBrowserState.fileList}
                            selectedFile={fileBrowserState.selectedFile}
                            selectedHDU={fileBrowserState.selectedHDU}
                            onFileClicked={(file: FileInfo, hdu: string) => fileBrowserState.selectFile(file, hdu)}
                            onFileDoubleClicked={(file: FileInfo, hdu: string) => this.loadFile(file.name, hdu)}
                            onFolderClicked={(folder: string) => fileBrowserState.selectFolder(folder)}
                        />
                    </div>
                    <div className="file-info-pane">
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
                <div className="pt-dialog-footer">
                    <div className="pt-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserState.hideFileBrowser} text="Close"/>
                        {fileBrowserState.appendingFrame ? (
                            <Tooltip content={"Append this file as a new frame"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserState.selectedFile} onClick={this.loadSelectedFile} text="Load as frame"/>
                            </Tooltip>
                        ) : (
                            <Tooltip content={"Close any existing frames and load this file"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserState.selectedFile} onClick={this.loadSelectedFile} text="Load"/>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </Dialog>
        );
    }

    loadSelectedFile = () => {
        const fileBrowserState = this.props.appState.fileBrowserState;
        this.loadFile(fileBrowserState.selectedFile.name, fileBrowserState.selectedHDU);
    };

    loadFile(file: string, hdu: string) {
        const fileBrowserState = this.props.appState.fileBrowserState;
        this.props.appState.loadFile(fileBrowserState.fileList.directory, file, hdu);
    }
}
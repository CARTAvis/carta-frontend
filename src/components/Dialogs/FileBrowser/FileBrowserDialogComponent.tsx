import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, H6, IDialogProps, Intent, NonIdealState, Pre, Tooltip} from "@blueprintjs/core";
import "./FileBrowserDialogComponent.css";
import {CARTA} from "carta-protobuf";
import FileInfo = CARTA.FileInfo;
import {FileListComponent} from "./FileList/FileListComponent";
import {AppStore} from "../../../stores/AppStore";
import {DraggableDialogComponent} from "../DraggableDialog/DraggableDialogComponent";

@observer
export class FileBrowserDialogComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        let infoHeader = "";
        if (fileBrowserStore.fileInfoExtended) {
            fileBrowserStore.fileInfoExtended.headerEntries.forEach(header => {
                infoHeader += `${header.name}: ${header.value}\n`;
            });
        }

        let className = "file-browser-dialog";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "folder-open",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: fileBrowserStore.fileBrowserDialogVisible,
            onClose: fileBrowserStore.hideFileBrowser,
            title: "File Browser",
        };

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={600} defaultHeight={450} enableResizing={true}>
                <div className="bp3-dialog-body" style={{display: "flex"}}>
                    <div className="file-list-pane">
                        <FileListComponent
                            files={fileBrowserStore.fileList}
                            selectedFile={fileBrowserStore.selectedFile}
                            selectedHDU={fileBrowserStore.selectedHDU}
                            onFileClicked={(file: FileInfo, hdu: string) => fileBrowserStore.selectFile(file, hdu)}
                            onFileDoubleClicked={(file: FileInfo, hdu: string) => this.loadFile(file.name, hdu)}
                            onFolderClicked={(folder: string) => fileBrowserStore.selectFolder(folder)}
                        />
                    </div>
                    <div className="file-info-pane">
                        <H6>File Information</H6>
                        {!fileBrowserStore.fileInfoExtended &&
                        <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected" description="Select a file from the list on the left"/>
                        }
                        {fileBrowserStore.fileInfoExtended &&
                        <Pre className="file-info-pre">{infoHeader}</Pre>
                        }
                    </div>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserStore.hideFileBrowser} text="Close"/>
                        {fileBrowserStore.appendingFrame ? (
                            <Tooltip content={"Append this file as a new frame"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserStore.selectedFile} onClick={this.loadSelectedFile} text="Load as frame"/>
                            </Tooltip>
                        ) : (
                            <Tooltip content={"Close any existing frames and load this file"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserStore.selectedFile} onClick={this.loadSelectedFile} text="Load"/>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    loadSelectedFile = () => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        this.loadFile(fileBrowserStore.selectedFile.name, fileBrowserStore.selectedHDU);
    };

    loadFile(file: string, hdu: string) {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        const frames = this.props.appStore.frames;
        if (!fileBrowserStore.appendingFrame || !frames.length) {
            this.props.appStore.openFile(fileBrowserStore.fileList.directory, file, hdu);
        }
        else {
            this.props.appStore.appendFile(fileBrowserStore.fileList.directory, file, hdu);
        }
    }
}
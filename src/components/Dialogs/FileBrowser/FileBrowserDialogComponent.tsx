import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, IDialogProps, Intent, NonIdealState, Pre, Tooltip, Tabs, Tab, TabId, Spinner} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FileListComponent} from "./FileList/FileListComponent";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore} from "stores";
import "./FileBrowserDialogComponent.css";

@observer
export class FileBrowserDialogComponent extends React.Component<{ appStore: AppStore }> {
    public render() {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        let fileInfo = "";
        let headers = "";
        if (fileBrowserStore.fileInfoExtended) {
            fileBrowserStore.fileInfoExtended.computedEntries.forEach(header => {
                fileInfo += `${header.name} = ${header.value}\n`;
            });
            fileBrowserStore.fileInfoExtended.headerEntries.forEach(header => {
                if (header.name === "END") {
                    headers += `${header.name}\n`;
                } else {
                    headers += `${header.name} = ${header.value}\n`;
                }
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

        let infoPanel;
        if (fileBrowserStore.selectedFile) { // select a file
            if (fileBrowserStore.loadingInfo) { // loading the file
                infoPanel = <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner"/>} title="Loading file info..."/>;
            } else { // file loaded
                if (fileBrowserStore.fileInfoResp) { // fileInfoResp return success
                    if ("fileInfo" === fileBrowserStore.selectedTab) {
                        infoPanel = <Pre className="file-info-pre">{fileInfo}</Pre>;
                    } else if ("header" === fileBrowserStore.selectedTab) {
                        infoPanel = <Pre className="file-info-pre">{headers}</Pre>;
                    } // probably more tabs will be added in the future
                } else { // fileInfoResp return failed
                    infoPanel = <NonIdealState className="non-ideal-state-file" icon="document" title="Cannot open file!" description={fileBrowserStore.respErrmsg + " Select another file from the list on the left"}/>;
                }
            }
        } else { // no file selected
            infoPanel = <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected" description="Select a file from the list on the left"/>;
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={1200} defaultHeight={600} enableResizing={true}>
                <div className="bp3-dialog-body" style={{display: "flex"}}>
                    <div className="file-list-pane">
                        <FileListComponent
                            files={fileBrowserStore.fileList}
                            selectedFile={fileBrowserStore.selectedFile}
                            selectedHDU={fileBrowserStore.selectedHDU}
                            onFileClicked={(file: CARTA.FileInfo, hdu: string) => fileBrowserStore.selectFile(file, hdu)}
                            onFileDoubleClicked={(file: CARTA.FileInfo, hdu: string) => this.loadFile(file.name, hdu)}
                            onFolderClicked={(folder: string) => fileBrowserStore.selectFolder(folder)}
                        />
                    </div>
                    <div className="file-info-pane">
                        <Tabs id="info-tabs" onChange={this.handleTabChange} selectedTabId={fileBrowserStore.selectedTab}>
                            <Tab id="fileInfo" title="File Information"/>
                            <Tab id="header" title="Header"/>
                        </Tabs>
                        {infoPanel}
                    </div>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserStore.hideFileBrowser} text="Close"/>
                        {fileBrowserStore.appendingFrame ? (
                            <Tooltip content={"Append this file as a new frame"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo} onClick={this.loadSelectedFile} text="Append"/>
                            </Tooltip>
                        ) : (
                            <Tooltip content={"Close any existing frames and load this file"}>
                                <AnchorButton intent={Intent.PRIMARY} disabled={!fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo} onClick={this.loadSelectedFile} text="Load"/>
                            </Tooltip>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    handleTabChange = (newId: TabId) => {
        this.props.appStore.fileBrowserStore.setSelectedTab(newId);
    };

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

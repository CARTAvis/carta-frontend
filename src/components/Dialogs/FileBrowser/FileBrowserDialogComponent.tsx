import * as React from "react";
import {observer} from "mobx-react";
import {AnchorButton, IDialogProps, Intent, NonIdealState, Pre, Spinner, Tab, TabId, Tabs, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FileListComponent} from "./FileList/FileListComponent";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, BrowserMode, FileInfoTabs} from "stores";
import "./FileBrowserDialogComponent.css";

@observer
export class FileBrowserDialogComponent extends React.Component<{ appStore: AppStore }> {
    private handleTabChange = (newId: TabId) => {
        this.props.appStore.fileBrowserStore.setSelectedTab(newId);
    };

    private loadSelectedFile = () => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        this.loadFile(fileBrowserStore.selectedFile, fileBrowserStore.selectedHDU);
    };

    private loadFile = (fileInfo: CARTA.IFileInfo, hdu: string) => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            const frames = this.props.appStore.frames;
            if (!fileBrowserStore.appendingFrame || !frames.length) {
                this.props.appStore.openFile(fileBrowserStore.fileList.directory, fileInfo.name, hdu);
            } else {
                this.props.appStore.appendFile(fileBrowserStore.fileList.directory, fileInfo.name, hdu);
            }
        } else {
            this.props.appStore.importRegion(fileBrowserStore.fileList.directory, fileInfo.name, fileInfo.type);
        }

        fileBrowserStore.saveStartingDirectory();
    };

    private loadInfoPanel = () => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        if (fileBrowserStore.selectedFile) {
            if (fileBrowserStore.loadingInfo) {
                return <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner"/>} title="Loading file info..."/>;
            } else {
                if (fileBrowserStore.browserMode === BrowserMode.File && fileBrowserStore.fileInfoResp) {
                    if (fileBrowserStore.selectedTab === FileInfoTabs.INFO) {
                        return <Pre className="file-info-pre">{fileBrowserStore.fileInfo}</Pre>;
                    } else if (fileBrowserStore.selectedTab === FileInfoTabs.HEADER) {
                        return <Pre className="file-info-pre">{fileBrowserStore.headers}</Pre>;
                    } // probably more tabs will be added in the future
                } else if (fileBrowserStore.browserMode === BrowserMode.Region && fileBrowserStore.regionFileInfo) {
                    return <Pre className="file-info-pre">{fileBrowserStore.regionFileInfo.join("\n")}</Pre>;
                } else {
                    return <NonIdealState className="non-ideal-state-file" icon="document" title="Cannot open file!" description={fileBrowserStore.respErrmsg + " Select another file from the list on the left"}/>;
                }
            }
        }
        return <NonIdealState className="non-ideal-state-file" icon="document" title="No file selected" description="Select a file from the list on the left"/>;
    };

    public render() {
        let className = "file-browser-dialog";
        if (this.props.appStore.darkTheme) {
            className += " bp3-dark";
        }

        const fileBrowserStore = this.props.appStore.fileBrowserStore;
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

        let loadButton: React.ReactNode;

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            if (fileBrowserStore.appendingFrame) {
                loadButton = (
                    <Tooltip content={"Append this file as a new frame"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={this.props.appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={this.loadSelectedFile}
                            text="Append"
                        />
                    </Tooltip>);
            } else {
                loadButton = (
                    <Tooltip content={"Close any existing frames and load this file"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={this.props.appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={this.loadSelectedFile}
                            text="Load"
                        />
                    </Tooltip>
                );
            }
        } else {
            loadButton = (
                <Tooltip content={"Load a region file for the currently active frame"}>
                    <AnchorButton
                        intent={Intent.PRIMARY}
                        disabled={this.props.appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !this.props.appStore.activeFrame}
                        onClick={this.loadSelectedFile}
                        text="Load Region"
                    />
                </Tooltip>
            );
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={300} defaultWidth={1200} defaultHeight={600} enableResizing={true}>
                <div className="bp3-dialog-body" style={{display: "flex"}}>
                    <div className="file-list-pane">
                        <FileListComponent
                            darkTheme={this.props.appStore.darkTheme}
                            files={fileBrowserStore.fileList}
                            selectedFile={fileBrowserStore.selectedFile}
                            selectedHDU={fileBrowserStore.selectedHDU}
                            onFileClicked={fileBrowserStore.selectFile}
                            onFileDoubleClicked={this.loadFile}
                            onFolderClicked={fileBrowserStore.selectFolder}
                        />
                    </div>
                    <div className="file-info-pane">
                        <Tabs id="info-tabs" onChange={this.handleTabChange} selectedTabId={fileBrowserStore.selectedTab}>
                            <Tab id={FileInfoTabs.INFO} title="File Information"/>
                            {fileBrowserStore.browserMode === BrowserMode.File &&
                            <Tab id={FileInfoTabs.HEADER} title="Header"/>
                            }
                        </Tabs>
                        {this.loadInfoPanel()}
                    </div>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserStore.hideFileBrowser} disabled={this.props.appStore.fileLoading} text="Close"/>
                        {loadButton}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }
}

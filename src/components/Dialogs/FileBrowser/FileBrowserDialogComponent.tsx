import * as React from "react";
import {observer} from "mobx-react";
import {Icon, AnchorButton, IDialogProps, Intent, NonIdealState, Pre, Tooltip, Tabs, Tab, TabId, Spinner, IBreadcrumbProps, Breadcrumbs, Breadcrumb} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FileListComponent} from "./FileList/FileListComponent";
import {DraggableDialogComponent} from "components/Dialogs";
import {AppStore, FileInfoTabs} from "stores";
import "./FileBrowserDialogComponent.css";

@observer
export class FileBrowserDialogComponent extends React.Component<{ appStore: AppStore }> {
    private handleTabChange = (newId: TabId) => {
        this.props.appStore.fileBrowserStore.setSelectedTab(newId);
    };

    private loadSelectedFile = () => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        this.loadFile(fileBrowserStore.selectedFile.name, fileBrowserStore.selectedHDU);
    };

    private loadFile = (file: string, hdu: string) => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        const frames = this.props.appStore.frames;
        if (!fileBrowserStore.appendingFrame || !frames.length) {
            this.props.appStore.openFile(fileBrowserStore.fileList.directory, file, hdu);
        } else {
            this.props.appStore.appendFile(fileBrowserStore.fileList.directory, file, hdu);
        }

        fileBrowserStore.saveStartingDirectory();
    };

    private loadInfoPanel = () => {
        const fileBrowserStore = this.props.appStore.fileBrowserStore;
        if (fileBrowserStore.selectedFile) {
            if (fileBrowserStore.loadingInfo) {
                return <NonIdealState className="non-ideal-state-file" icon={<Spinner className="astLoadingSpinner"/>} title="Loading file info..."/>;
            } else {
                if (fileBrowserStore.fileInfoResp) {
                    if (fileBrowserStore.selectedTab === FileInfoTabs.INFO) {
                        return <Pre className="file-info-pre">{fileBrowserStore.fileInfo}</Pre>;
                    } else if (fileBrowserStore.selectedTab === FileInfoTabs.HEADER) {
                        return <Pre className="file-info-pre">{fileBrowserStore.headers}</Pre>;
                    } // probably more tabs will be added in the future
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

        let pathItems: IBreadcrumbProps[] = [{icon: "desktop", target: "."}];
        if (fileBrowserStore.fileList) {
            const path = fileBrowserStore.fileList.directory;
            if (path !== ".") {
                const dirNames = path.split("/");
                let parentPath = "";
                if (dirNames.length) {
                    for (const dirName of dirNames) {
                        if (!dirName) {
                            continue;
                        }
                        parentPath += `/${dirName}`;
                        pathItems.push({
                            text: dirName,
                            target: parentPath
                        });
                    }
                }
            }
        }

        return (
            <DraggableDialogComponent dialogProps={dialogProps} minWidth={300} minHeight={400} defaultWidth={800} defaultHeight={600} enableResizing={true}>
                <div className="file-path">
                    {pathItems &&
                    <Breadcrumbs
                        breadcrumbRenderer={this.renderBreadcrumb}
                        items={pathItems}
                    />
                    }
                </div>
                <div className="bp3-dialog-body">
                    <div className="file-list">
                        <FileListComponent
                            darkTheme={this.props.appStore.darkTheme}
                            files={fileBrowserStore.fileList}
                            selectedFile={fileBrowserStore.selectedFile}
                            selectedHDU={fileBrowserStore.selectedHDU}
                            onFileClicked={(file: CARTA.FileInfo, hdu: string) => fileBrowserStore.selectFile(file, hdu)}
                            onFileDoubleClicked={(file: CARTA.FileInfo, hdu: string) => this.loadFile(file.name, hdu)}
                            onFolderClicked={fileBrowserStore.selectFolder}
                        />
                    </div>
                    <div className="file-info-pane">
                        <Tabs id="info-tabs" onChange={this.handleTabChange} selectedTabId={fileBrowserStore.selectedTab}>
                            <Tab id={FileInfoTabs.INFO} title="File Information"/>
                            <Tab id={FileInfoTabs.HEADER} title="Header"/>
                        </Tabs>
                        {this.loadInfoPanel()}
                    </div>
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserStore.hideFileBrowser} disabled={this.props.appStore.fileLoading} text="Close"/>
                        {fileBrowserStore.appendingFrame ? (
                            <Tooltip content={"Append this file as a new frame"}>
                                <AnchorButton
                                    intent={Intent.PRIMARY}
                                    disabled={this.props.appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                                    onClick={this.loadSelectedFile}
                                    text="Append"
                                />
                            </Tooltip>
                        ) : (
                            <Tooltip content={"Close any existing frames and load this file"}>
                                <AnchorButton
                                    intent={Intent.PRIMARY}
                                    disabled={this.props.appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                                    onClick={this.loadSelectedFile}
                                    text="Load"
                                />
                            </Tooltip>
                        )}
                    </div>
                </div>
            </DraggableDialogComponent>
        );
    }

    private renderBreadcrumb = (props: IBreadcrumbProps) => {
        return (
            <Breadcrumb onClick={() => this.props.appStore.fileBrowserStore.selectFolder(props.target, true)}>
                {props.icon &&
                <Icon icon={props.icon}/>
                }
                {props.text}
            </Breadcrumb>
        );
    };
}

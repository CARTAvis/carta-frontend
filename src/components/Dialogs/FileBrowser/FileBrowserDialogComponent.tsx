import * as React from "react";
import {observer} from "mobx-react";
import {action, computed, observable} from "mobx";
import {Alert, AnchorButton, Breadcrumb, Breadcrumbs, Button, IBreadcrumbProps, Icon, IDialogProps, InputGroup, Intent, Menu, MenuItem, NonIdealState, Popover, Position, Pre, Spinner, Tab, TabId, Tabs, Tooltip, Text, Switch} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {FileListComponent} from "./FileList/FileListComponent";
import {FileInfoComponent, FileInfoType} from "components/FileInfo/FileInfoComponent";
import {DraggableDialogComponent} from "components/Dialogs";
import {TableComponentProps, TableType} from "components/Shared";
import {AppStore, BrowserMode, DialogStore, FileBrowserStore, HelpType} from "stores";
import {CatalogOverlayWidgetStore} from "stores/widgets";
import "./FileBrowserDialogComponent.css";

@observer
export class FileBrowserDialogComponent extends React.Component {
    @observable overwriteExistingFileAlertVisible: boolean;

    private handleTabChange = (newId: TabId) => {
        FileBrowserStore.Instance.setSelectedTab(newId);
    };

    private loadSelectedFile = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        this.loadFile(fileBrowserStore.selectedFile, fileBrowserStore.selectedHDU);
    };

    private loadFile = (fileInfo: CARTA.IFileInfo | CARTA.ICatalogFileInfo, hdu?: string) => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        // Ignore load if in export mode
        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            return;
        }

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            const frames = appStore.frames;
            if (!fileBrowserStore.appendingFrame || !frames.length) {
                appStore.openFile(fileBrowserStore.fileList.directory, fileInfo.name, hdu);
            } else {
                appStore.appendFile(fileBrowserStore.fileList.directory, fileInfo.name, hdu);
            }
        } else if (fileBrowserStore.browserMode === BrowserMode.Catalog) {
            appStore.appendCatalog(fileBrowserStore.catalogFileList.directory, fileInfo.name, CatalogOverlayWidgetStore.InitTableRows, CARTA.CatalogFileType.VOTable);
        } else {
            appStore.importRegion(fileBrowserStore.fileList.directory, fileInfo.name, fileInfo.type);
        }

        fileBrowserStore.saveStartingDirectory();
    };

    private handleExportRegionsClicked = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        const filename = fileBrowserStore.exportFilename.trim();
        if (fileBrowserStore.fileList && fileBrowserStore.fileList.files && fileBrowserStore.fileList.files.find(f => f.name.trim() === filename)) {
            // Existing file being replaced. Alert the user
            this.overwriteExistingFileAlertVisible = true;
        } else {
            this.exportRegion(fileBrowserStore.fileList.directory, filename);
        }
    };

    private exportRegion(directory: string, filename: string) {
        if (!filename || !directory) {
            return;
        }

        filename = filename.trim();
        const appStore = AppStore.Instance;
        const fileBrowserStore = FileBrowserStore.Instance;
        appStore.exportRegions(directory, filename, fileBrowserStore.exportCoordinateType, fileBrowserStore.exportFileType);
        console.log(`Exporting all regions to ${directory}/${filename}`);
    }

    private handleOverwriteAlertConfirmed = () => {
        this.overwriteExistingFileAlertVisible = false;
        const fileBrowserStore = FileBrowserStore.Instance;
        const filename = fileBrowserStore.exportFilename.trim();
        this.exportRegion(fileBrowserStore.fileList.directory, filename);
    };

    private handleOverwriteAlertDismissed = () => {
        this.overwriteExistingFileAlertVisible = false;
    };

    private handleExportInputChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        fileBrowserStore.setExportFilename(ev.target.value);
    };

    private static ValidateFilename(filename: string) {
        const forbiddenRegex = /(\.\.)|(\\)+/gm;
        return (filename && filename.length && !filename.match(forbiddenRegex));
    }

    private renderActionButton(browserMode: BrowserMode, appending: boolean) {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        if (browserMode === BrowserMode.File) {
            if (appending) {
                return (
                    <Tooltip content={"Append this file as a new frame"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={this.loadSelectedFile}
                            text="Append"
                        />
                    </Tooltip>);
            } else {
                return (
                    <Tooltip content={"Close any existing frames and load this file"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={this.loadSelectedFile}
                            text="Load"
                        />
                    </Tooltip>
                );
            }
        } else if (browserMode === BrowserMode.RegionImport) {
            return (
                <Tooltip content={"Load a region file for the currently active frame"}>
                    <AnchorButton
                        intent={Intent.PRIMARY}
                        disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !appStore.activeFrame}
                        onClick={this.loadSelectedFile}
                        text="Load Region"
                    />
                </Tooltip>
            );
        } else if (browserMode === BrowserMode.Catalog) {
            return (
                <Tooltip content={"Load a catalog file for the currently active frame"}>
                    <AnchorButton
                        intent={Intent.PRIMARY}
                        disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !appStore.activeFrame}
                        onClick={this.loadSelectedFile}
                        text="Load Catalog"
                    />
                </Tooltip>
            );
        } else {
            const frame = appStore.activeFrame;
            return (
                <Tooltip content={"Export all regions for the currently active frame"}>
                    <AnchorButton
                        intent={Intent.PRIMARY}
                        disabled={!FileBrowserDialogComponent.ValidateFilename(fileBrowserStore.exportFilename) || !frame || frame.regionSet.regions.length <= 1}
                        onClick={this.handleExportRegionsClicked}
                        text="Export Regions"
                    />
                </Tooltip>
            );
        }
    }

    private renderExportFilenameInput() {
        const fileBrowserStore = FileBrowserStore.Instance;

        const coordinateTypeMenu = (
            <Popover
                content={
                    <Menu>
                        <MenuItem text="World Coordinates" onClick={() => fileBrowserStore.setExportCoordinateType(CARTA.CoordinateType.WORLD)}/>
                        <MenuItem text="Pixel Coordinates" onClick={() => fileBrowserStore.setExportCoordinateType(CARTA.CoordinateType.PIXEL)}/>
                    </Menu>
                }
                position={Position.BOTTOM_RIGHT}
            >
                <Button minimal={true} rightIcon="caret-down">
                    {fileBrowserStore.exportCoordinateType === CARTA.CoordinateType.WORLD ? "World" : "Pixel"}
                </Button>
            </Popover>
        );

        const fileTypeMenu = (
            <Popover
                content={
                    <Menu>
                        <MenuItem text="CRTF Region File" onClick={() => fileBrowserStore.setExportFileType(CARTA.FileType.CRTF)}/>
                        <MenuItem text="DS9 Region File" onClick={() => fileBrowserStore.setExportFileType(CARTA.FileType.REG)}/>
                    </Menu>
                }
                position={Position.BOTTOM_RIGHT}
            >
                <Button minimal={true} rightIcon="caret-down">
                    {fileBrowserStore.exportFileType === CARTA.FileType.CRTF ? "CRTF" : "DS9"}
                </Button>
            </Popover>
        );

        let sideMenu = (
            <div>
                {fileTypeMenu}
                {coordinateTypeMenu}
            </div>
        );
        return <InputGroup autoFocus={true} placeholder="Enter file name" value={fileBrowserStore.exportFilename} onChange={this.handleExportInputChanged} rightElement={sideMenu}/>;
    }

    // Refresh file list to trigger the Breadcrumb re-rendering
    @action
    private refreshFileList() {
        const fileBrowserStore = FileBrowserStore.Instance;
        switch (fileBrowserStore.browserMode) {
            case BrowserMode.Catalog:
                fileBrowserStore.catalogFileList = {...fileBrowserStore.catalogFileList};
                break;
            default:
                fileBrowserStore.fileList = {...fileBrowserStore.fileList};
                break;
        }
    }

    public render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        let className = "file-browser-dialog";
        if (appStore.darkTheme) {
            className += " bp3-dark";
        }

        const dialogProps: IDialogProps = {
            icon: "folder-open",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.fileBrowserDialogVisible,
            onClose: fileBrowserStore.hideFileBrowser,
            onOpened: () => this.refreshFileList(),
            title: "File Browser",
        };

        const actionButton = this.renderActionButton(fileBrowserStore.browserMode, fileBrowserStore.appendingFrame);

        let exportFileInput: React.ReactNode;
        let paneClassName = "file-panes";

        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            exportFileInput = this.renderExportFilenameInput();
        } else {
            paneClassName += " extended";
        }

        let tableProps: TableComponentProps = null;
        if (fileBrowserStore.browserMode === BrowserMode.Catalog && fileBrowserStore.catalogHeaders && fileBrowserStore.catalogHeaders.length) {
            const table = fileBrowserStore.catalogHeaderDataset;
            tableProps = {
                type: TableType.Normal,
                dataset: table.columnsData,
                columnHeaders: table.columnHeaders,
                numVisibleRows: fileBrowserStore.catalogHeaders.length
            };
        }

        const fileList = fileBrowserStore.getfileListByMode;

        return (
            <DraggableDialogComponent dialogProps={dialogProps} helpType={HelpType.FILE_Browser} minWidth={400} minHeight={400} defaultWidth={1200} defaultHeight={600} enableResizing={true}>
                <div className="file-path">
                    {this.pathItems &&
                    <React.Fragment>
                        <Tooltip content={"Refresh current directory"}>
                            <Button
                                icon="repeat"
                                onClick={() => fileBrowserStore.selectFolder(fileList.directory, true)}
                                minimal={true}
                                style={{marginRight: "10px"}}
                            />
                        </Tooltip>
                        <Breadcrumbs
                            breadcrumbRenderer={this.renderBreadcrumb}
                            items={this.pathItems}
                        />
                    </React.Fragment>
                    }
                </div>
                <div className="bp3-dialog-body">
                    <div className={paneClassName}>
                        <div className="file-list">
                            <FileListComponent
                                darkTheme={appStore.darkTheme}
                                files={fileBrowserStore.getfileListByMode}
                                fileBrowserMode={fileBrowserStore.browserMode}
                                selectedFile={fileBrowserStore.selectedFile}
                                selectedHDU={fileBrowserStore.selectedHDU}
                                onFileClicked={fileBrowserStore.selectFile}
                                onFileDoubleClicked={this.loadFile}
                                onFolderClicked={fileBrowserStore.selectFolder}
                            />
                        </div>
                        <div className="file-info-pane">
                            <FileInfoComponent
                                infoTypes={this.getFileInfoTypes(fileBrowserStore.browserMode)}
                                fileInfoExtended={fileBrowserStore.fileInfoExtended}
                                regionFileInfo={fileBrowserStore.regionFileInfo ? fileBrowserStore.regionFileInfo.join("\n") : ""}
                                catalogFileInfo={fileBrowserStore.catalogFileInfo}
                                selectedTab={fileBrowserStore.selectedTab as FileInfoType}
                                handleTabChange={this.handleTabChange}
                                isLoading={fileBrowserStore.loadingInfo}
                                errorMessage={fileBrowserStore.responseErrorMessage}
                                catalogHeaderTable={tableProps}
                            />
                        </div>
                    </div>
                    {exportFileInput}
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={fileBrowserStore.hideFileBrowser} disabled={appStore.fileLoading} text="Close"/>
                        {actionButton}
                    </div>
                </div>
                <Alert
                    isOpen={this.overwriteExistingFileAlertVisible}
                    confirmButtonText="Yes"
                    cancelButtonText="Cancel"
                    intent={Intent.DANGER}
                    onConfirm={this.handleOverwriteAlertConfirmed}
                    onCancel={this.handleOverwriteAlertDismissed}
                    canEscapeKeyCancel={true}
                >
                    This file exists. Are you sure to overwrite it?
                </Alert>
            </DraggableDialogComponent>
        );
    }

    private renderBreadcrumb = (props: IBreadcrumbProps) => {
        return (
            <Breadcrumb onClick={props.onClick}>
                {props.icon &&
                <Icon icon={props.icon}/>
                }
                {props.text}
            </Breadcrumb>
        );
    };

    private getFileInfoTypes(fileBrowserMode: BrowserMode): Array<FileInfoType> {
        switch (fileBrowserMode) {
            case BrowserMode.File:
                return [FileInfoType.IMAGE_FILE, FileInfoType.IMAGE_HEADER];
            case BrowserMode.Catalog:
                return [FileInfoType.CATALOG_FILE, FileInfoType.CATALOG_HEADER];
            default:
                return [FileInfoType.REGION_FILE];
        }
    }

    @computed get pathItems() {
        const fileBrowserStore = FileBrowserStore.Instance;
        let pathItems: IBreadcrumbProps[] = [{icon: "desktop", onClick: () => fileBrowserStore.selectFolder(".", true)}];
        const fileList = fileBrowserStore.getfileListByMode;
        if (fileList) {
            const path = fileList.directory;
            if (path && path !== ".") {
                const dirNames = path.split("/");
                let parentPath = "";
                if (dirNames.length) {
                    for (const dirName of dirNames) {
                        if (!dirName) {
                            continue;
                        }
                        parentPath += `/${dirName}`;
                        const targetPath = parentPath;
                        pathItems.push({
                            text: dirName,
                            onClick: () => fileBrowserStore.selectFolder(targetPath, true)
                        });
                    }
                }
            }
        }
        return pathItems;
    }
}

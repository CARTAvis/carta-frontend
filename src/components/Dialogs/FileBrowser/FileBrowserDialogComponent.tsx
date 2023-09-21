import * as React from "react";
import {Alert, AnchorButton, Breadcrumb, BreadcrumbProps, Breadcrumbs, Button, ButtonGroup, Icon, IDialogProps, InputGroup, Intent, Menu, MenuItem, Position, TabId} from "@blueprintjs/core";
import {Popover2, Tooltip2} from "@blueprintjs/popover2";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import * as _ from "lodash";
import {action, computed, flow, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent, TaskProgressDialogComponent} from "components/Dialogs";
import {FileInfoComponent, FileInfoType} from "components/FileInfo/FileInfoComponent";
import {SimpleTableComponentProps} from "components/Shared";
import {AppStore, BrowserMode, CatalogProfileStore, FileBrowserStore, FileFilteringType, HelpType, ISelectedFile, PreferenceKeys, PreferenceStore} from "stores";
import {FrameStore} from "stores/Frame";

import {FileListTableComponent} from "./FileListTable/FileListTableComponent";

import "./FileBrowserDialogComponent.scss";

@observer
export class FileBrowserDialogComponent extends React.Component {
    @observable overwriteExistingFileAlertVisible: boolean;
    @observable fileFilterString: string = "";
    @observable debouncedFilterString: string = "";
    @observable defaultWidth: number;
    @observable defaultHeight: number;
    @observable enableImageArithmetic: boolean = false;
    @observable imageArithmeticString: string = "";
    @observable inputPathString: string = "";
    @observable enableEditPath: boolean = false;
    private readonly imageArithmeticInputRef: React.RefObject<HTMLInputElement>;

    constructor(props: any) {
        super(props);
        makeObservable(this);
        this.defaultWidth = 1200;
        this.defaultHeight = 600;
        this.imageArithmeticInputRef = React.createRef<HTMLInputElement>();
    }

    private handleTabChange = (newId: TabId) => {
        FileBrowserStore.Instance.setSelectedTab(newId);
    };

    @action private handleFileClicked = (file: ISelectedFile) => {
        FileBrowserStore.Instance.selectFile(file);
        if (this.enableImageArithmetic) {
            // Check if the existing string has a trailing quote or not
            const quoteRegex = /(["'])+/gm;
            const quoteCount = this.imageArithmeticString.match(quoteRegex)?.length;
            const trailingQuote = quoteCount % 2 !== 0;

            const operatorRegex = /([+\-*/(,])\s*$/gm;
            const trailingOperator = this.imageArithmeticString.match(operatorRegex)?.length > 0;

            // Append the file name if there's a trailing operator or quote, otherwise just replace
            if (trailingOperator) {
                this.imageArithmeticString += `"${file.fileInfo.name}"`;
            } else if (this.imageArithmeticString?.endsWith('"') && trailingQuote) {
                this.imageArithmeticString += `${file.fileInfo.name}"`;
            } else if (this.imageArithmeticString?.endsWith("'") && trailingQuote) {
                this.imageArithmeticString += `${file.fileInfo.name}'`;
            } else {
                this.imageArithmeticString = `"${file.fileInfo.name}"`;
            }
            this.imageArithmeticInputRef.current?.focus();
        }
    };

    private loadSelectedFiles = async () => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        if (fileBrowserStore.selectedFiles.length > 1) {
            appStore.setLoadingMultipleFiles(true);
            for (let i = 0; i < fileBrowserStore.selectedFiles.length; i++) {
                try {
                    await this.loadFile(fileBrowserStore.selectedFiles[i], i > 0);
                } catch (err) {
                    console.log(err);
                }
            }
            appStore.setLoadingMultipleFiles(false);
        } else {
            await this.loadFile({fileInfo: fileBrowserStore.selectedFile, hdu: fileBrowserStore.selectedHDU});
        }
    };

    @flow.bound private *loadExpression() {
        const appStore = AppStore.Instance;
        const frames = appStore.frames;
        const fileBrowserStore = appStore.fileBrowserStore;
        let frame: FrameStore;

        if (!fileBrowserStore.appendingFrame || !frames.length) {
            frame = yield appStore.openFile(fileBrowserStore.fileList.directory, this.imageArithmeticString, "", true);
        } else {
            frame = yield appStore.appendFile(fileBrowserStore.fileList.directory, this.imageArithmeticString, "", true);
        }
        fileBrowserStore.saveStartingDirectory();
        this.clearArithmeticString();
        this.setEnableImageArithmetic(false);
        return frame;
    }

    @flow.bound private *loadComplexImage(filename: string, expression: string) {
        const imageArithmeticString = `${expression}("${filename}")`;
        const appStore = AppStore.Instance;
        const frames = appStore.frames;
        const fileBrowserStore = appStore.fileBrowserStore;
        let frame: FrameStore;

        if (!fileBrowserStore.appendingFrame || !frames.length) {
            frame = yield appStore.openFile(fileBrowserStore.fileList.directory, imageArithmeticString, "", true);
        } else {
            frame = yield appStore.appendFile(fileBrowserStore.fileList.directory, imageArithmeticString, "", true);
        }
        fileBrowserStore.saveStartingDirectory();
        return frame;
    }

    @flow.bound private *loadFile(file: ISelectedFile, forceAppend: boolean = false) {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        let frame: FrameStore;

        // Ignore load
        switch (fileBrowserStore.browserMode) {
            case BrowserMode.RegionExport:
            case BrowserMode.SaveFile:
                return undefined;
            default:
                break;
        }

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            const frames = appStore.frames;
            if (!(forceAppend || fileBrowserStore.appendingFrame) || !frames.length) {
                frame = yield appStore.openFile(fileBrowserStore.fileList.directory, file.fileInfo.name, file.hdu);
            } else {
                frame = yield appStore.appendFile(fileBrowserStore.fileList.directory, file.fileInfo.name, file.hdu);
            }
        } else if (fileBrowserStore.browserMode === BrowserMode.Catalog) {
            yield appStore.appendCatalog(fileBrowserStore.catalogFileList.directory, file.fileInfo.name, CatalogProfileStore.InitTableRows, CARTA.CatalogFileType.VOTable);
        } else {
            fileBrowserStore.setImportingRegions(true);
            fileBrowserStore.showLoadingDialog();
            yield appStore.importRegion(fileBrowserStore.fileList.directory, file.fileInfo.name, file.fileInfo.type);
            fileBrowserStore.resetLoadingStates();
        }

        fileBrowserStore.saveStartingDirectory();
        return frame;
    }

    /// Prepare parameters for send saveFile
    private handleSaveFile = async () => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = FileBrowserStore.Instance;
        const activeFrame = appStore.activeFrame;
        const filename = fileBrowserStore.saveFilename.trim();

        const nonStandardSpecSysIsChannel = activeFrame.spectralSystemsSupported.length === 0 && !fileBrowserStore.saveIsNativeValue;
        const channelStart = fileBrowserStore.saveSpectralStart ? (nonStandardSpecSysIsChannel ? fileBrowserStore.saveSpectralStart : activeFrame.findChannelIndexByValue(fileBrowserStore.saveSpectralStart)) : 0;
        const channelEnd = fileBrowserStore.saveSpectralEnd ? (nonStandardSpecSysIsChannel ? fileBrowserStore.saveSpectralEnd : activeFrame.findChannelIndexByValue(fileBrowserStore.saveSpectralEnd)) : activeFrame.numChannels - 1;

        const saveChannelStart = Math.min(channelStart, channelEnd);
        const saveChannelEnd = Math.max(channelStart, channelEnd);
        let saveChannels = [];
        if (activeFrame.numChannels > 1) {
            saveChannels = [Math.max(saveChannelStart, 0), Math.min(saveChannelEnd, activeFrame.numChannels - 1), fileBrowserStore.saveSpectralStride];
        }
        const saveStokes = fileBrowserStore.saveStokesRange;

        const restFreq = activeFrame.headerRestFreq === fileBrowserStore.saveRestFreqInHz ? NaN : fileBrowserStore.saveRestFreqInHz;
        await appStore.saveFile(fileBrowserStore.fileList.directory, filename, fileBrowserStore.saveFileType, fileBrowserStore.saveRegionId, saveChannels, saveStokes, fileBrowserStore.shouldDropDegenerateAxes, restFreq);
    };

    private handleSaveFileClicked = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        const filename = fileBrowserStore.saveFilename.trim();
        if (fileBrowserStore.fileList && fileBrowserStore.fileList.files && fileBrowserStore.fileList.files.find(f => f.name.trim() === filename)) {
            this.overwriteExistingFileAlertVisible = true;
        } else {
            this.handleSaveFile();
        }
    };

    private handleSaveFileNameChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        fileBrowserStore.setSaveFilename(ev.target.value);
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

    private exportRegion = (directory: string, filename: string) => {
        if (!filename || !directory) {
            return;
        }

        filename = filename.trim();
        const appStore = AppStore.Instance;
        const fileBrowserStore = FileBrowserStore.Instance;
        appStore.exportRegions(directory, filename, fileBrowserStore.exportCoordinateType, fileBrowserStore.exportFileType, fileBrowserStore.exportRegionIndexes);
        console.log(`Exporting regions to ${directory}/${filename}`);
    };

    private handleOverwriteAlertConfirmed = () => {
        this.overwriteExistingFileAlertVisible = false;
        const fileBrowserStore = FileBrowserStore.Instance;
        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            const filename = fileBrowserStore.exportFilename.trim();
            this.exportRegion(fileBrowserStore.fileList.directory, filename);
        } else if (fileBrowserStore.browserMode === BrowserMode.SaveFile) {
            this.handleSaveFile();
        }
    };

    private handleOverwriteAlertDismissed = () => {
        this.overwriteExistingFileAlertVisible = false;
    };

    private handleExportInputChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        fileBrowserStore.setExportFilename(ev.target.value);
    };

    private handleFileListRequestCancelled = () => {
        const fileBrowserStore = FileBrowserStore.Instance;
        fileBrowserStore.cancelRequestingFileList();
        fileBrowserStore.resetLoadingStates();
    };

    @action handleFilterStringInputChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.fileFilterString = ev.target.value;
        this.setFilterString(this.fileFilterString);
    };

    @action handleImageArithmeticStringChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.imageArithmeticString = ev.target.value;
    };

    setFilterString = _.debounce(
        (filterString: string) =>
            runInAction(() => {
                this.debouncedFilterString = filterString;
            }),
        500
    );

    @action clearFilterString = () => {
        this.fileFilterString = "";
        this.debouncedFilterString = "";
    };

    @action clearArithmeticString = () => {
        this.imageArithmeticString = "";
    };

    @action handleFolderClicked = (folderName: string) => {
        this.clearFilterString();
        AppStore.Instance.fileBrowserStore.selectFolder(folderName);
    };

    @action handleBreadcrumbClicked = (path: string) => {
        this.clearFilterString();
        AppStore.Instance.fileBrowserStore.selectFolder(path, true);
    };

    private static ValidateFilename(filename: string) {
        const forbiddenRegex = /(\.\.)|(\\)+/gm;
        return filename && filename.length && !filename.match(forbiddenRegex);
    }

    private renderActionButton(browserMode: BrowserMode, appending: boolean) {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        switch (browserMode) {
            case BrowserMode.File:
                let actionDisabled: boolean;
                let actionFunction: () => void;
                if (this.enableImageArithmetic) {
                    actionDisabled = appStore.fileLoading || !this.imageArithmeticString;
                    actionFunction = this.loadExpression;
                } else {
                    actionDisabled = appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo;
                    actionFunction = this.loadSelectedFiles;
                }
                if (appending) {
                    let actionText: string;
                    if (this.enableImageArithmetic) {
                        actionText = "Append expression";
                    } else if (fileBrowserStore.selectedFiles?.length > 1) {
                        actionText = "Append selected";
                    } else {
                        actionText = "Append";
                    }

                    if (fileBrowserStore.isComplexImage && fileBrowserStore.selectedFiles?.length === 1) {
                        const loadMenuItems = (
                            <Menu>
                                <MenuItem text="Amplitude" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "AMPLITUDE")} />
                                <MenuItem text="Phase" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "PHASE")} />
                                <MenuItem text="Real" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "REAL")} />
                                <MenuItem text="Imaginary" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "IMAG")} />
                            </Menu>
                        );
                        return (
                            <div>
                                <Popover2 content={loadMenuItems} placement="right-end">
                                    <AnchorButton intent={Intent.PRIMARY} disabled={actionDisabled} text="Append as" />
                                </Popover2>
                            </div>
                        );
                    } else {
                        return (
                            <div>
                                <Tooltip2 content={"Append this image while keeping other images open"}>
                                    <AnchorButton intent={Intent.PRIMARY} disabled={actionDisabled} onClick={actionFunction} text={actionText} />
                                </Tooltip2>
                                {!this.enableImageArithmetic && fileBrowserStore.selectedFiles?.length > 1 && fileBrowserStore.selectedFiles?.length < 5 && (
                                    <Tooltip2 content={"Append this image while keeping other images open"}>
                                        <AnchorButton intent={Intent.PRIMARY} disabled={actionDisabled} onClick={appStore.dialogStore.showStokesDialog} text={"Load as hypercube"} />
                                    </Tooltip2>
                                )}
                            </div>
                        );
                    }
                } else {
                    let actionText: string;
                    if (this.enableImageArithmetic) {
                        actionText = "Load expression";
                    } else if (fileBrowserStore.selectedFiles?.length > 1) {
                        actionText = "Load selected";
                    } else {
                        actionText = "Load";
                    }
                    if (fileBrowserStore.isComplexImage && fileBrowserStore.selectedFiles?.length === 1) {
                        const loadMenuItems = (
                            <Menu>
                                <MenuItem text="Amplitude" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "AMPLITUDE")} />
                                <MenuItem text="Phase" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "PHASE")} />
                                <MenuItem text="Real" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "REAL")} />
                                <MenuItem text="Imaginary" intent={Intent.PRIMARY} disabled={actionDisabled} onClick={() => this.loadComplexImage(fileBrowserStore.selectedFile.name, "IMAG")} />
                            </Menu>
                        );

                        return (
                            <div>
                                <Popover2 content={loadMenuItems} placement="right-end">
                                    <AnchorButton intent={Intent.PRIMARY} disabled={actionDisabled} text="Load as" />
                                </Popover2>
                            </div>
                        );
                    } else {
                        return (
                            <div>
                                <Tooltip2 content={"Close any existing images and load this image"}>
                                    <AnchorButton intent={Intent.PRIMARY} disabled={actionDisabled} onClick={actionFunction} text={actionText} />
                                </Tooltip2>
                                {!this.enableImageArithmetic && fileBrowserStore.selectedFiles?.length > 1 && fileBrowserStore.selectedFiles?.length < 5 && (
                                    <Tooltip2 content={"Close any existing images and load this image"}>
                                        <AnchorButton intent={Intent.PRIMARY} disabled={actionDisabled} onClick={appStore.dialogStore.showStokesDialog} text={"Load as hypercube"} />
                                    </Tooltip2>
                                )}
                            </div>
                        );
                    }
                }
            case BrowserMode.SaveFile:
                return (
                    <Tooltip2 content={"Save this file"}>
                        <AnchorButton intent={Intent.PRIMARY} disabled={appStore.fileLoading || fileBrowserStore.loadingInfo || appStore.fileSaving} onClick={this.handleSaveFileClicked} text="Save" />
                    </Tooltip2>
                );
            case BrowserMode.RegionImport:
                return (
                    <Tooltip2 content={"Load a region file for the currently active image"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo}
                            onClick={this.loadSelectedFiles}
                            text="Load region"
                        />
                    </Tooltip2>
                );
            case BrowserMode.Catalog:
                return (
                    <Tooltip2 content={"Load a catalog file for the currently active image"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.fileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.fileInfoResp || fileBrowserStore.loadingInfo || !appStore.activeFrame}
                            onClick={this.loadSelectedFiles}
                            text="Load catalog"
                        />
                    </Tooltip2>
                );
            case BrowserMode.RegionExport:
                const frame = appStore.activeFrame;
                return (
                    <Tooltip2 content={"Export regions for the currently active image"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={!FileBrowserDialogComponent.ValidateFilename(fileBrowserStore.exportFilename) || !frame || frame.regionSet.regions.length <= 1 || fileBrowserStore.exportRegionNum < 1}
                            onClick={this.handleExportRegionsClicked}
                            text="Export regions"
                        />
                    </Tooltip2>
                );
            default:
                return "";
        }
    }

    private renderExportFilenameInput() {
        const fileBrowserStore = FileBrowserStore.Instance;

        const coordinateTypeMenu = (
            <Popover2
                minimal={true}
                content={
                    <Menu>
                        <MenuItem text="World coordinates" onClick={() => fileBrowserStore.setExportCoordinateType(CARTA.CoordinateType.WORLD)} />
                        <MenuItem text="Pixel coordinates" onClick={() => fileBrowserStore.setExportCoordinateType(CARTA.CoordinateType.PIXEL)} />
                    </Menu>
                }
                position={Position.BOTTOM_RIGHT}
            >
                <Button minimal={true} rightIcon="caret-down">
                    {fileBrowserStore.exportCoordinateType === CARTA.CoordinateType.WORLD ? "World" : "Pixel"}
                </Button>
            </Popover2>
        );

        const fileTypeMenu = (
            <Popover2
                minimal={true}
                content={
                    <Menu>
                        <MenuItem text="CRTF region file" onClick={() => fileBrowserStore.setExportFileType(CARTA.FileType.CRTF)} />
                        <MenuItem text="DS9 region file" onClick={() => fileBrowserStore.setExportFileType(CARTA.FileType.DS9_REG)} />
                    </Menu>
                }
                position={Position.BOTTOM_RIGHT}
            >
                <Button minimal={true} rightIcon="caret-down">
                    {fileBrowserStore.exportFileType === CARTA.FileType.CRTF ? "CRTF" : "DS9"}
                </Button>
            </Popover2>
        );

        let sideMenu = (
            <div>
                {fileTypeMenu}
                {coordinateTypeMenu}
            </div>
        );
        return <InputGroup autoFocus={true} placeholder="Enter file name" value={fileBrowserStore.exportFilename} onChange={this.handleExportInputChanged} rightElement={sideMenu} />;
    }

    private renderSaveFilenameInput() {
        const fileBrowserStore = FileBrowserStore.Instance;

        const fileTypeMenu = (
            <Popover2
                minimal={true}
                content={
                    <Menu>
                        <MenuItem text="CASA" onClick={() => fileBrowserStore.setSaveFileType(CARTA.FileType.CASA)} />
                        <MenuItem text="FITS" onClick={() => fileBrowserStore.setSaveFileType(CARTA.FileType.FITS)} />
                    </Menu>
                }
                position={Position.BOTTOM_RIGHT}
            >
                <Button minimal={true} rightIcon="caret-down">
                    {fileBrowserStore.saveFileType === CARTA.FileType.CASA ? "CASA" : "FITS"}
                </Button>
            </Popover2>
        );

        return <InputGroup autoFocus={true} placeholder="Enter file name" value={fileBrowserStore.saveFilename} onChange={this.handleSaveFileNameChanged} rightElement={fileTypeMenu} />;
    }

    private renderOpenFilenameInput(browserMode: BrowserMode) {
        const preferenceStore = PreferenceStore.Instance;

        let filterName: string;
        let filterDescription: string;

        switch (preferenceStore.fileFilteringType) {
            case FileFilteringType.Fuzzy:
                filterName = "Fuzzy search";
                filterDescription = "Filter by filename with fuzzy search";
                break;
            case FileFilteringType.Unix:
                filterName = "Unix pattern";
                filterDescription = "Filter by filename using unix-style pattern";
                break;
            case FileFilteringType.Regex:
                filterName = "Regular expression";
                filterDescription = "Filter by filename using regular expression";
                break;
            default:
                break;
        }

        const filterTypeMenu = (
            <Popover2
                minimal={true}
                content={
                    <Menu>
                        <MenuItem text="Fuzzy search" onClick={() => this.setFilterType(FileFilteringType.Fuzzy)} />
                        <MenuItem text="Unix pattern" onClick={() => this.setFilterType(FileFilteringType.Unix)} />
                        <MenuItem text="Regular expression" onClick={() => this.setFilterType(FileFilteringType.Regex)} />
                    </Menu>
                }
                placement="bottom-end"
            >
                <Button minimal={true} icon="filter" rightIcon="caret-down">
                    {filterName}
                </Button>
            </Popover2>
        );

        if (browserMode === BrowserMode.File) {
            const inputTypeMenu = (
                <Popover2
                    minimal={true}
                    content={
                        <Menu>
                            <MenuItem text="List filtering" onClick={() => this.setEnableImageArithmetic(false)} />
                            <MenuItem text="Image arithmetic" onClick={() => this.setEnableImageArithmetic(true)} />
                        </Menu>
                    }
                    placement="bottom-start"
                >
                    <Button minimal={true} icon={this.enableImageArithmetic ? "calculator" : "search"} rightIcon="caret-down">
                        {this.enableImageArithmetic ? "Image arithmetic" : "Filter"}
                    </Button>
                </Popover2>
            );
            if (this.enableImageArithmetic) {
                return (
                    <InputGroup
                        className="arithmetic-input"
                        inputRef={this.imageArithmeticInputRef}
                        autoFocus={true}
                        placeholder="Enter an image arithmetic expression"
                        value={this.imageArithmeticString}
                        onChange={this.handleImageArithmeticStringChanged}
                        leftElement={inputTypeMenu}
                        onKeyDown={this.handleImageArithmeticKeyDown}
                    />
                );
            } else {
                return <InputGroup autoFocus={false} placeholder={filterDescription} value={this.fileFilterString} onChange={this.handleFilterStringInputChanged} leftElement={inputTypeMenu} rightElement={filterTypeMenu} />;
            }
        } else {
            return <InputGroup autoFocus={false} placeholder={filterDescription} value={this.fileFilterString} onChange={this.handleFilterStringInputChanged} leftIcon="search" rightElement={filterTypeMenu} />;
        }
    }

    @action setFilterType = (type: FileFilteringType) => {
        this.clearFilterString();
        PreferenceStore.Instance.setPreference(PreferenceKeys.SILENT_FILE_FILTERING_TYPE, type);
    };

    @action setEnableImageArithmetic = (val: boolean) => {
        this.enableImageArithmetic = val;
        if (val) {
            this.clearFilterString();
        }
    };

    private handleImageArithmeticKeyDown = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        if (ev.key === "Enter") {
            this.loadExpression();
        }
    };

    // Refresh file list to trigger the Breadcrumb re-rendering
    @action refreshFileList = () => {
        this.clearFilterString();
        const fileBrowserStore = FileBrowserStore.Instance;
        switch (fileBrowserStore.browserMode) {
            case BrowserMode.Catalog:
                fileBrowserStore.catalogFileList = {...fileBrowserStore.catalogFileList};
                break;
            default:
                fileBrowserStore.fileList = {...fileBrowserStore.fileList};
                break;
        }
    };

    @action private updateDefaultSize = (newWidth: number, newHeight: number) => {
        this.defaultWidth = newWidth;
        this.defaultHeight = newHeight;
    };

    public render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        const className = classNames("file-browser-dialog", {"bp3-dark": appStore.darkTheme});

        const dialogProps: IDialogProps = {
            icon: "folder-open",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.fileBrowserDialogVisible,
            onClose: this.closeFileBrowser,
            onOpened: this.refreshFileList,
            title: "File Browser"
        };

        const actionButton = this.renderActionButton(fileBrowserStore.browserMode, fileBrowserStore.appendingFrame);

        let fileInput: React.ReactNode;
        let paneClassName = "file-panes";

        if (fileBrowserStore.browserMode === BrowserMode.SaveFile) {
            fileInput = this.renderSaveFilenameInput();
        } else if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            fileInput = this.renderExportFilenameInput();
        } else {
            fileInput = this.renderOpenFilenameInput(fileBrowserStore.browserMode);
        }

        let tableProps: SimpleTableComponentProps = null;
        if (fileBrowserStore.browserMode === BrowserMode.Catalog && fileBrowserStore.catalogHeaders && fileBrowserStore.catalogHeaders.length) {
            const table = fileBrowserStore.catalogHeaderDataset;
            tableProps = {
                dataset: table.columnsData,
                columnHeaders: table.columnHeaders,
                numVisibleRows: fileBrowserStore.catalogHeaders.length
            };
        }

        let fileProgress;

        if (fileBrowserStore.loadingProgress) {
            fileProgress = {
                total: fileBrowserStore.loadingTotalCount,
                checked: fileBrowserStore.loadingCheckedCount
            };
        }

        const fileList = fileBrowserStore.getfileListByMode;

        return (
            <DraggableDialogComponent
                dialogProps={dialogProps}
                helpType={HelpType.FILE_BROWSER}
                minWidth={400}
                minHeight={400}
                defaultWidth={this.defaultWidth}
                defaultHeight={this.defaultHeight}
                enableResizing={true}
                onResizeStop={this.updateDefaultSize}
            >
                <div className="file-path">
                    {this.pathItems && (
                        <React.Fragment>
                            <ButtonGroup>
                                <Tooltip2 content={"Refresh current directory"}>
                                    <AnchorButton icon="repeat" onClick={() => fileBrowserStore.selectFolder(fileList.directory, true)} minimal={true} />
                                </Tooltip2>
                                <Tooltip2 content={"Input directory path"} disabled={this.enableEditPath}>
                                    <AnchorButton className="edit-path-button" icon="edit" minimal={true} onClick={this.switchEditPathMode} />
                                </Tooltip2>
                            </ButtonGroup>
                            {this.enableEditPath ? (
                                <InputGroup
                                    className="directory-path-input"
                                    autoFocus={true}
                                    placeholder={"Input directory path with respect to the top level folder"}
                                    onChange={this.handleInputPathChanged}
                                    onKeyDown={ev => this.submitInputPath(ev)}
                                    defaultValue={"/" + fileBrowserStore.getfileListByMode.directory}
                                />
                            ) : (
                                <Breadcrumbs className="path-breadcrumbs" breadcrumbRenderer={this.renderBreadcrumb} items={this.pathItems} />
                            )}
                        </React.Fragment>
                    )}
                </div>
                <div className="bp3-dialog-body">
                    <div className={paneClassName}>
                        <div className="file-list">
                            <FileListTableComponent
                                darkTheme={appStore.darkTheme}
                                loading={fileBrowserStore.loadingList}
                                extendedLoading={fileBrowserStore.extendedLoading}
                                fileProgress={fileProgress}
                                listResponse={fileBrowserStore.getfileListByMode}
                                fileBrowserMode={fileBrowserStore.browserMode}
                                selectedFile={fileBrowserStore.selectedFile}
                                selectedHDU={fileBrowserStore.selectedHDU}
                                filterString={this.debouncedFilterString}
                                filterType={appStore.preferenceStore.fileFilteringType}
                                sortingString={appStore.preferenceStore.fileSortingString}
                                onSortingChanged={fileBrowserStore.setSortingConfig}
                                onFileClicked={this.handleFileClicked}
                                onSelectionChanged={fileBrowserStore.setSelectedFiles}
                                onFileDoubleClicked={this.loadFile}
                                onFolderClicked={this.handleFolderClicked}
                                onListCancelled={this.handleFileListRequestCancelled}
                            />
                        </div>
                        <div className="file-info-pane">
                            <FileInfoComponent
                                infoTypes={FileBrowserDialogComponent.GetFileInfoTypes(fileBrowserStore.browserMode)}
                                HDUOptions={{HDUList: fileBrowserStore.HDUList, handleSelectedHDUChange: fileBrowserStore.selectHDU}}
                                fileInfoExtended={fileBrowserStore.fileInfoExtended}
                                regionFileInfo={fileBrowserStore.regionFileInfo ? fileBrowserStore.regionFileInfo.join("\n") : ""}
                                catalogFileInfo={fileBrowserStore.catalogFileInfo}
                                selectedTab={fileBrowserStore.selectedTab as FileInfoType}
                                handleTabChange={this.handleTabChange}
                                isLoading={fileBrowserStore.loadingInfo}
                                errorMessage={fileBrowserStore.responseErrorMessage}
                                catalogHeaderTable={tableProps}
                                selectedFile={fileBrowserStore.selectedFile}
                            />
                        </div>
                    </div>
                    {fileInput}
                </div>
                <div className="bp3-dialog-footer">
                    <div className="bp3-dialog-footer-actions">
                        <AnchorButton intent={Intent.NONE} onClick={this.closeFileBrowser} disabled={appStore.fileLoading} text="Close" />
                        {actionButton}
                    </div>
                </div>
                <Alert
                    className={appStore.darkTheme ? "bp3-dark" : ""}
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
                <TaskProgressDialogComponent
                    isOpen={fileBrowserStore.isImportingRegions && fileBrowserStore.isLoadingDialogOpen && fileBrowserStore.loadingProgress < 1}
                    progress={fileBrowserStore.loadingProgress}
                    timeRemaining={appStore.estimatedTaskRemainingTime}
                    cancellable={false}
                    text={"Importing regions"}
                    contentText={`loading ${fileBrowserStore.loadingCheckedCount} / ${fileBrowserStore.loadingTotalCount}`}
                />
            </DraggableDialogComponent>
        );
    }

    private closeFileBrowser = () => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        if (appStore.dialogStore.stokesDialogVisible) {
            appStore.dialogStore.hideStokesDialog();
        }
        fileBrowserStore.hideFileBrowser();
    };

    private renderBreadcrumb = (props: BreadcrumbProps) => {
        return (
            <Breadcrumb onClick={props.onClick} className="folder-breadcrumb">
                {props.icon && <Icon iconSize={14} icon={props.icon} />}
                {props.text}
            </Breadcrumb>
        );
    };

    private static GetFileInfoTypes(fileBrowserMode: BrowserMode): Array<FileInfoType> {
        switch (fileBrowserMode) {
            case BrowserMode.File:
                return [FileInfoType.IMAGE_FILE, FileInfoType.IMAGE_HEADER];
            case BrowserMode.SaveFile:
                return [FileInfoType.SAVE_IMAGE, FileInfoType.IMAGE_FILE, FileInfoType.IMAGE_HEADER];
            case BrowserMode.Catalog:
                return [FileInfoType.CATALOG_FILE, FileInfoType.CATALOG_HEADER];
            case BrowserMode.RegionExport:
                return [FileInfoType.SELECT_REGION, FileInfoType.REGION_FILE];
            default:
                return [FileInfoType.REGION_FILE];
        }
    }

    @computed get pathItems() {
        const fileBrowserStore = FileBrowserStore.Instance;
        let pathItems: BreadcrumbProps[] = [
            {
                icon: "desktop",
                onClick: () => this.handleBreadcrumbClicked("")
            }
        ];

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
                            onClick: () => this.handleBreadcrumbClicked(targetPath)
                        });
                    }
                }
            }
        }
        return pathItems;
    }

    private handleInputPathChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        this.setInputPathString(ev.target.value);
    };

    private submitInputPath = (keyEvent?) => {
        if (keyEvent && keyEvent?.keyCode === 13 && this.inputPathString !== "") {
            this.handleBreadcrumbClicked(this.inputPathString);
            this.switchEditPathMode();
        }
    };

    @action setInputPathString = (inputPathString: string) => {
        this.inputPathString = inputPathString.replace("\b", "");
        if (this.inputPathString.length === 1 && this.inputPathString === ".") {
            this.inputPathString = "";
        }
        if (this.inputPathString.length > 1 && this.inputPathString.slice(-1) === "/") {
            this.inputPathString = this.inputPathString.slice(0, -1);
        }
    };

    @action switchEditPathMode = () => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        this.inputPathString = "/" + fileBrowserStore.getfileListByMode.directory;
        this.enableEditPath = !this.enableEditPath;
    };
}

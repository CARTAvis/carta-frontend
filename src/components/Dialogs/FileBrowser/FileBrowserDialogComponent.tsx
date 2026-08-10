import * as React from "react";
import {Alert, AnchorButton, Breadcrumb, type BreadcrumbProps, Breadcrumbs, Button, ButtonGroup, Classes, type DialogProps, Icon, InputGroup, Intent, Menu, MenuItem, PopoverNext, type TabId, Tooltip} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import classNames from "classnames";
import * as _ from "lodash";
import {action, computed, flow, makeObservable, observable, runInAction} from "mobx";
import {observer} from "mobx-react";

import {DraggableDialogComponent, TaskProgressDialogComponent} from "components/Dialogs";
import {FileInfoComponent} from "components/FileInfo/FileInfoComponent";
import {AppToaster, ErrorToast, type SimpleTableComponentProps} from "components/Shared";
import {BrowserMode, ColormapSet, DialogId, FileFilteringType, FileInfoType, HelpType, ImageType, PreferenceKeys} from "enums";
import {AppStore, CatalogProfileStore, FileBrowserStore, type ISelectedFile, PreferenceStore} from "stores";
import {type FrameStore} from "stores/Frame";

import {FileListTableComponent} from "./FileListTable/FileListTableComponent";

import "./FileBrowserDialogComponent.scss";

@observer
export class FileBrowserDialogComponent extends React.Component {
    @observable isOverwriteExistingFileAlertVisible: boolean = false;
    @observable fileFilterString: string = "";
    @observable debouncedFilterString: string = "";
    @observable isImageArithmeticEnabled: boolean = false;
    @observable imageArithmeticString: string = "";
    @observable inputPathString: string = "";
    @observable isEditPathEnabled: boolean = false;
    private readonly imageArithmeticInputRef: React.RefObject<HTMLInputElement | null>;

    private static readonly DefaultWidth = 1200;
    private static readonly DefaultHeight = 600;
    private static readonly MinWidth = 800;
    private static readonly MinHeight = 400;

    constructor(props: any) {
        super(props);
        this.imageArithmeticInputRef = React.createRef<HTMLInputElement>();
        makeObservable(this);
    }

    private handleTabChange = (newId: TabId) => {
        FileBrowserStore.Instance.setSelectedTab(newId);
    };

    @action private handleFileClicked = (file: ISelectedFile) => {
        FileBrowserStore.Instance.selectFile(file);
        if (this.isImageArithmeticEnabled) {
            if (file.fileInfo?.name) {
                // Check if the existing string has a trailing quote or not
                const quoteRegex = /(["'])+/gm;
                const quoteMatches = this.imageArithmeticString.match(quoteRegex);
                const quoteCount = quoteMatches?.length || 0;
                const hasTrailingQuote = quoteCount % 2 !== 0;

                const operatorRegex = /([+\-*/(,])\s*$/gm;
                const operatorMatches = this.imageArithmeticString.match(operatorRegex);
                const hasTrailingOperator = (operatorMatches?.length || 0) > 0;

                // Append the file name if there's a trailing operator or quote, otherwise just replace
                if (hasTrailingOperator) {
                    this.imageArithmeticString += `"${file.fileInfo.name}"`;
                } else if (this.imageArithmeticString?.endsWith('"') && hasTrailingQuote) {
                    this.imageArithmeticString += `${file.fileInfo.name}"`;
                } else if (this.imageArithmeticString?.endsWith("'") && hasTrailingQuote) {
                    this.imageArithmeticString += `${file.fileInfo.name}'`;
                } else {
                    this.imageArithmeticString = `"${file.fileInfo.name}"`;
                }
            }
            this.imageArithmeticInputRef.current?.focus();
        }
    };

    private loadWithColorBlending = async () => {
        try {
            await this.loadSelectedFiles();

            const appStore = AppStore.Instance;
            appStore.frames.forEach(f => appStore.setSpatialMatchingEnabled(f, true));
            appStore.frames.forEach(f => appStore.setRasterScalingMatchingEnabled(f, false));
            appStore.frames.forEach(f => f.renderConfig.setPercentileRank(appStore.preferenceStore.percentile));
            const colorBlendingStore = appStore.imageViewConfigStore.createColorBlending();

            colorBlendingStore?.applyColormapSet(appStore.fileBrowserStore.selectedFiles?.length <= 3 ? ColormapSet.RGB : ColormapSet.Rainbow);
        } catch (err) {
            console.error(err);
        }
    };

    private loadSelectedFiles = async () => {
        const appStore = AppStore.Instance;
        const {fileBrowserStore, layoutStore, dynamicLayoutStore} = appStore;

        if (PreferenceStore.Instance.isDynamicLayoutEnabled && dynamicLayoutStore.dynamicLayoutName && layoutStore.layoutExists(dynamicLayoutStore.dynamicLayoutName)) {
            await layoutStore.applyLayout(dynamicLayoutStore.dynamicLayoutName);
        }

        if (fileBrowserStore.selectedFiles.length > 1) {
            appStore.setLoadingMultipleFiles(true);
            for (let i = 0; i < fileBrowserStore.selectedFiles.length; i++) {
                try {
                    await this.loadFile(fileBrowserStore.selectedFiles[i], i > 0);
                } catch (err) {
                    console.error(err);
                }
            }
            appStore.setLoadingMultipleFiles(false);
        } else {
            await this.loadFile({fileInfo: fileBrowserStore.selectedFile || undefined, hdu: fileBrowserStore.selectedHDU || undefined});
        }
    };

    @flow.bound private *loadExpression() {
        const appStore = AppStore.Instance;
        const frames = appStore.frames;
        const fileBrowserStore = appStore.fileBrowserStore;
        let frame: FrameStore;

        const directory = fileBrowserStore.fileList?.directory;
        if (!directory) {
            throw new Error("No directory selected");
        }

        if (!fileBrowserStore.isAppendingFrame || !frames.length) {
            frame = yield appStore.openFile(directory, this.imageArithmeticString, "", true);
        } else {
            frame = yield appStore.appendFile(directory, this.imageArithmeticString, "", true);
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

        const directory = fileBrowserStore.fileList?.directory;
        if (!directory) {
            throw new Error("No directory selected");
        }

        if (!fileBrowserStore.isAppendingFrame || !frames.length) {
            frame = yield appStore.openFile(directory, imageArithmeticString, "", true);
        } else {
            frame = yield appStore.appendFile(directory, imageArithmeticString, "", true);
        }
        fileBrowserStore.saveStartingDirectory();
        return frame;
    }

    @flow.bound private *loadFile(file: ISelectedFile, shouldForceAppend: boolean = false) {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        let frame: FrameStore | undefined;

        // Ignore load
        switch (fileBrowserStore.browserMode) {
            case BrowserMode.RegionExport:
            case BrowserMode.SaveFile:
                return undefined;
            default:
                break;
        }

        if (!file.fileInfo?.name) {
            throw new Error("No file selected");
        }

        if (fileBrowserStore.browserMode === BrowserMode.File) {
            const frames = appStore.frames;
            const directory = fileBrowserStore.fileList?.directory;
            if (!directory) {
                throw new Error("No directory selected");
            }

            if (!(shouldForceAppend || fileBrowserStore.isAppendingFrame) || !frames.length) {
                frame = yield appStore.openFile(directory, file.fileInfo.name, file.hdu);
            } else {
                frame = yield appStore.appendFile(directory, file.fileInfo.name, file.hdu);
            }
        } else if (fileBrowserStore.browserMode === BrowserMode.Catalog) {
            const directory = fileBrowserStore.catalogFileList?.directory;
            if (!directory) {
                throw new Error("No catalog directory selected");
            }
            yield appStore.appendCatalog(directory, file.fileInfo.name, CatalogProfileStore.INIT_TABLE_ROWS);
        } else {
            const directory = fileBrowserStore.fileList?.directory;
            if (!directory) {
                throw new Error("No directory selected");
            }
            fileBrowserStore.setImportingRegions(true);
            fileBrowserStore.showLoadingDialog();
            if (file.fileInfo.type) {
                yield appStore.importRegion(directory, file.fileInfo.name, file.fileInfo.type);
            }
            fileBrowserStore.resetLoadingStates();
        }

        fileBrowserStore.saveStartingDirectory();
        return frame;
    }

    /// Prepare parameters for send saveFile
    private handleSaveFile = async (shouldOverwrite: boolean = false) => {
        const appStore = AppStore.Instance;
        const fileBrowserStore = FileBrowserStore.Instance;
        const activeFrame = appStore.activeFrame;

        if (!activeFrame) {
            throw new Error("No active frame");
        }

        const saveFilename = fileBrowserStore.saveFilename;
        if (!saveFilename) {
            throw new Error("No save filename specified");
        }
        const filename = saveFilename.trim();

        const channelStart = fileBrowserStore.saveSpectralStart ? activeFrame.findChannelIndexByValue(fileBrowserStore.saveSpectralStart) : 0;
        const channelEnd = fileBrowserStore.saveSpectralEnd ? activeFrame.findChannelIndexByValue(fileBrowserStore.saveSpectralEnd) : activeFrame.numChannels - 1;

        const saveChannelStart = Math.min(channelStart || 0, channelEnd || 0);
        const saveChannelEnd = Math.max(channelStart || 0, channelEnd || 0);
        let saveChannels: number[] = [];
        if (activeFrame.numChannels > 1) {
            saveChannels = [Math.max(saveChannelStart, 0), Math.min(saveChannelEnd, activeFrame.numChannels - 1), fileBrowserStore.saveSpectralStride];
        }
        const saveStokes = fileBrowserStore.saveStokesRange;

        const restFreq = activeFrame.headerRestFreq === fileBrowserStore.saveRestFreqInHz ? NaN : fileBrowserStore.saveRestFreqInHz;

        const directory = fileBrowserStore.fileList?.directory;
        if (!directory) {
            throw new Error("No directory selected");
        }

        await appStore.saveFile(directory, filename, fileBrowserStore.saveFileType, fileBrowserStore.saveRegionId, saveChannels, saveStokes, fileBrowserStore.shouldDropDegenerateAxes, restFreq, shouldOverwrite);
    };

    private handleSaveFileClicked = async () => {
        try {
            await this.handleSaveFile();
        } catch (err) {
            if (err.overwriteConfirmationRequired) {
                this.isOverwriteExistingFileAlertVisible = true;
            } else {
                console.error(err.message);
                AppToaster.show({icon: "warning-sign", message: err.message, intent: "danger", timeout: 3000});
            }
        }
    };

    private handleSaveFileNameChanged = (ev: React.ChangeEvent<HTMLInputElement>) => {
        const fileBrowserStore = FileBrowserStore.Instance;
        fileBrowserStore.setSaveFilename(ev.target.value);
    };

    private handleExportRegionsClicked = async () => {
        try {
            const fileBrowserStore = FileBrowserStore.Instance;
            const exportFilename = fileBrowserStore.exportFilename;
            if (!exportFilename) {
                throw new Error("No export filename specified");
            }
            const filename = exportFilename.trim();
            const directory = fileBrowserStore.fileList?.directory;
            if (!directory) {
                throw new Error("No directory selected");
            }
            await this.exportRegion(directory, filename);
        } catch (err) {
            if (err.overwriteConfirmationRequired) {
                this.isOverwriteExistingFileAlertVisible = true;
            } else {
                console.error(err.message);
                AppToaster.show(ErrorToast(err.message));
            }
        }
    };

    private exportRegion = async (directory: string, filename: string, shouldOverwrite: boolean = false) => {
        if (!filename) {
            return;
        }

        filename = filename.trim();
        const appStore = AppStore.Instance;
        const fileBrowserStore = FileBrowserStore.Instance;
        console.log(`Exporting regions to ${directory}/${filename}`);
        await appStore.exportRegions(directory, filename, fileBrowserStore.exportCoordinateType, fileBrowserStore.exportFileType, fileBrowserStore.exportRegionIndexes, shouldOverwrite);
    };

    private handleOverwriteAlertConfirmed = async () => {
        this.isOverwriteExistingFileAlertVisible = false;
        const fileBrowserStore = FileBrowserStore.Instance;
        if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            try {
                const exportFilename = fileBrowserStore.exportFilename;
                if (!exportFilename) {
                    throw new Error("No export filename specified");
                }
                const filename = exportFilename.trim();
                const directory = fileBrowserStore.fileList?.directory;
                if (!directory) {
                    throw new Error("No directory selected");
                }
                await this.exportRegion(directory, filename, true);
            } catch (err) {
                console.error(err.message);
                AppToaster.show(ErrorToast(err.message));
            }
        } else if (fileBrowserStore.browserMode === BrowserMode.SaveFile) {
            try {
                await this.handleSaveFile(true);
            } catch (err) {
                console.error(err.message);
                AppToaster.show({icon: "warning-sign", message: err.message, intent: "danger", timeout: 3000});
            }
        }
    };

    private handleOverwriteAlertDismissed = () => {
        this.isOverwriteExistingFileAlertVisible = false;
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

    private static validateFilename(filename: string) {
        const forbiddenRegex = /(\.\.)|(\\)+/gm;
        return filename && filename.length && !filename.match(forbiddenRegex);
    }

    private renderActionButton(browserMode: BrowserMode, isAppending: boolean) {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;

        switch (browserMode) {
            case BrowserMode.File:
                let isActionDisabled: boolean;
                let actionFunction: () => void;
                if (this.isImageArithmeticEnabled) {
                    isActionDisabled = appStore.isFileLoading || !this.imageArithmeticString;
                    actionFunction = this.loadExpression;
                } else {
                    const isFolderSelected = fileBrowserStore.selectedFiles && !fileBrowserStore.selectedFiles.every(file => file.isFile);
                    isActionDisabled = appStore.isFileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.isFileInfoResp || fileBrowserStore.isLoadingInfo || isFolderSelected;
                    actionFunction = this.loadSelectedFiles;
                }
                if (isAppending) {
                    let actionText: string;
                    if (this.isImageArithmeticEnabled) {
                        actionText = "Append expression";
                    } else if (fileBrowserStore.selectedFiles?.length > 1) {
                        actionText = "Append selected";
                    } else {
                        actionText = "Append";
                    }

                    if (fileBrowserStore.isComplexImage && fileBrowserStore.selectedFiles?.length === 1) {
                        const loadMenuItems = (
                            <Menu>
                                <MenuItem
                                    text="Amplitude"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "AMPLITUDE");
                                        }
                                    }}
                                />
                                <MenuItem
                                    text="Phase"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "PHASE");
                                        }
                                    }}
                                />
                                <MenuItem
                                    text="Real"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "REAL");
                                        }
                                    }}
                                />
                                <MenuItem
                                    text="Imaginary"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "IMAG");
                                        }
                                    }}
                                />
                            </Menu>
                        );
                        return (
                            <div>
                                <PopoverNext content={loadMenuItems} placement="right-end" shouldReturnFocusOnClose={false}>
                                    <AnchorButton intent={Intent.PRIMARY} disabled={isActionDisabled} text="Append as" />
                                </PopoverNext>
                            </div>
                        );
                    } else {
                        return (
                            <div>
                                <Tooltip content={"Append this image while keeping other images open"}>
                                    <AnchorButton intent={Intent.PRIMARY} disabled={isActionDisabled} onClick={actionFunction} text={actionText} />
                                </Tooltip>
                                {!this.isImageArithmeticEnabled && fileBrowserStore.selectedFiles?.length > 1 && fileBrowserStore.selectedFiles?.length < 5 && (
                                    <Tooltip content={"Append this image while keeping other images open"}>
                                        <AnchorButton intent={Intent.PRIMARY} disabled={isActionDisabled} onClick={() => appStore.dialogStore.showDialog(DialogId.Stokes)} text={"Load as hypercube"} />
                                    </Tooltip>
                                )}
                            </div>
                        );
                    }
                } else {
                    let actionText: string;
                    if (this.isImageArithmeticEnabled) {
                        actionText = "Load expression";
                    } else if (fileBrowserStore.selectedFiles?.length > 1) {
                        actionText = "Load selected";
                    } else {
                        actionText = "Load";
                    }
                    if (fileBrowserStore.isComplexImage && fileBrowserStore.selectedFiles?.length === 1) {
                        const loadMenuItems = (
                            <Menu>
                                <MenuItem
                                    text="Amplitude"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "AMPLITUDE");
                                        }
                                    }}
                                />
                                <MenuItem
                                    text="Phase"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "PHASE");
                                        }
                                    }}
                                />
                                <MenuItem
                                    text="Real"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "REAL");
                                        }
                                    }}
                                />
                                <MenuItem
                                    text="Imaginary"
                                    intent={Intent.PRIMARY}
                                    disabled={isActionDisabled}
                                    onClick={() => {
                                        const selectedFile = fileBrowserStore.selectedFile;
                                        if (selectedFile?.name) {
                                            this.loadComplexImage(selectedFile.name, "IMAG");
                                        }
                                    }}
                                />
                            </Menu>
                        );

                        return (
                            <div>
                                <PopoverNext content={loadMenuItems} placement="right-end" shouldReturnFocusOnClose={false}>
                                    <AnchorButton intent={Intent.PRIMARY} disabled={isActionDisabled} text="Load as" />
                                </PopoverNext>
                            </div>
                        );
                    } else {
                        return (
                            <div>
                                <Tooltip content={"Close any existing images and load this image"}>
                                    <AnchorButton intent={Intent.PRIMARY} disabled={isActionDisabled} onClick={actionFunction} text={actionText} />
                                </Tooltip>
                                {!this.isImageArithmeticEnabled && fileBrowserStore.selectedFiles?.length > 1 && fileBrowserStore.selectedFiles?.length < 5 && (
                                    <Tooltip content={"Close any existing images and load this image"}>
                                        <AnchorButton intent={Intent.PRIMARY} disabled={isActionDisabled} onClick={() => appStore.dialogStore.showDialog(DialogId.Stokes)} text={"Load as hypercube"} />
                                    </Tooltip>
                                )}
                                {fileBrowserStore.selectedFiles?.length > 1 && (
                                    <Tooltip content={"Close any existing images and load the images"}>
                                        <AnchorButton
                                            intent={Intent.PRIMARY}
                                            disabled={isActionDisabled}
                                            onClick={this.loadWithColorBlending}
                                            text={fileBrowserStore.selectedFiles?.length <= 3 ? "Load with RGB blending" : "Load with multi-color blending"}
                                        />
                                    </Tooltip>
                                )}
                            </div>
                        );
                    }
                }
            case BrowserMode.SaveFile:
                return (
                    <Tooltip
                        content={
                            appStore.activeImage?.type !== ImageType.FRAME ? (
                                <span>
                                    Color-blending and PV preview images cannot be saved.
                                    <br />
                                    <small>To save color-blending images, please save as a workspace via the File menu.</small>
                                </span>
                            ) : (
                                "Save this file"
                            )
                        }
                    >
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={
                                appStore.isFileLoading ||
                                fileBrowserStore.isLoadingInfo ||
                                appStore.isFileSaving ||
                                appStore.activeImage?.type !== ImageType.FRAME ||
                                !fileBrowserStore.saveFilename ||
                                fileBrowserStore.saveFilename.length === 0
                            }
                            onClick={this.handleSaveFileClicked}
                            text="Save"
                        />
                    </Tooltip>
                );
            case BrowserMode.RegionImport:
                return (
                    <Tooltip content={"Load a region file for the currently active image"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.isFileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.isFileInfoResp || fileBrowserStore.isLoadingInfo}
                            onClick={this.loadSelectedFiles}
                            text="Load region"
                        />
                    </Tooltip>
                );
            case BrowserMode.Catalog:
                return (
                    <Tooltip content={"Load a catalog file for the currently active image"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={appStore.isFileLoading || !fileBrowserStore.selectedFile || !fileBrowserStore.isFileInfoResp || fileBrowserStore.isLoadingInfo || !appStore.activeFrame}
                            onClick={this.loadSelectedFiles}
                            text="Load catalog"
                        />
                    </Tooltip>
                );
            case BrowserMode.RegionExport:
                const frame = appStore.activeFrame;
                return (
                    <Tooltip content={"Export regions for the currently active image"}>
                        <AnchorButton
                            intent={Intent.PRIMARY}
                            disabled={
                                !fileBrowserStore.exportFilename || !FileBrowserDialogComponent.validateFilename(fileBrowserStore.exportFilename) || !frame || frame.regionSet.regions.length <= 1 || fileBrowserStore.exportRegionNum < 1
                            }
                            onClick={this.handleExportRegionsClicked}
                            text="Export regions"
                        />
                    </Tooltip>
                );
            default:
                return "";
        }
    }

    private renderExportFilenameInput() {
        const fileBrowserStore = FileBrowserStore.Instance;

        const coordinateTypeMenu = (
            <PopoverNext
                animation="minimal"
                arrow={false}
                shouldReturnFocusOnClose={false}
                content={
                    <Menu>
                        <MenuItem text="World coordinates" onClick={() => fileBrowserStore.setExportCoordinateType(CARTA.CoordinateType.WORLD)} />
                        <MenuItem text="Pixel coordinates" onClick={() => fileBrowserStore.setExportCoordinateType(CARTA.CoordinateType.PIXEL)} />
                    </Menu>
                }
                placement="bottom-end"
            >
                <Button variant="minimal" endIcon="caret-down">
                    {fileBrowserStore.exportCoordinateType === CARTA.CoordinateType.WORLD ? "World" : "Pixel"}
                </Button>
            </PopoverNext>
        );

        const fileTypeMenu = (
            <PopoverNext
                animation="minimal"
                arrow={false}
                shouldReturnFocusOnClose={false}
                content={
                    <Menu>
                        <MenuItem text="CRTF region file" onClick={() => fileBrowserStore.setExportFileType(CARTA.FileType.CRTF)} />
                        <MenuItem text="DS9 region file" onClick={() => fileBrowserStore.setExportFileType(CARTA.FileType.DS9_REG)} />
                    </Menu>
                }
                placement="bottom-end"
            >
                <Button variant="minimal" endIcon="caret-down" data-testid="export-region-file-type-dropdown">
                    {fileBrowserStore.exportFileType === CARTA.FileType.CRTF ? "CRTF" : "DS9"}
                </Button>
            </PopoverNext>
        );

        const sideMenu = (
            <div>
                {fileTypeMenu}
                {coordinateTypeMenu}
            </div>
        );
        return <InputGroup autoFocus={true} placeholder="Enter file name" value={fileBrowserStore.exportFilename || ""} onChange={this.handleExportInputChanged} rightElement={sideMenu} />;
    }

    private renderSaveFilenameInput() {
        const fileBrowserStore = FileBrowserStore.Instance;

        const fileTypeMenu = (
            <PopoverNext
                animation="minimal"
                arrow={false}
                shouldReturnFocusOnClose={false}
                content={
                    <Menu>
                        <MenuItem text="CASA" onClick={() => fileBrowserStore.setSaveFileType(CARTA.FileType.CASA)} />
                        <MenuItem text="FITS" onClick={() => fileBrowserStore.setSaveFileType(CARTA.FileType.FITS)} />
                    </Menu>
                }
                placement="bottom-end"
            >
                <Button variant="minimal" endIcon="caret-down">
                    {fileBrowserStore.saveFileType === CARTA.FileType.CASA ? "CASA" : "FITS"}
                </Button>
            </PopoverNext>
        );

        return <InputGroup autoFocus={true} placeholder="Enter file name" value={fileBrowserStore.saveFilename || ""} onChange={this.handleSaveFileNameChanged} rightElement={fileTypeMenu} />;
    }

    private renderOpenFilenameInput(browserMode: BrowserMode) {
        const preferenceStore = PreferenceStore.Instance;

        let filterName: string = "Unknown";
        let filterDescription: string = "Filter by filename";

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
            <PopoverNext
                animation="minimal"
                arrow={false}
                shouldReturnFocusOnClose={false}
                content={
                    <Menu>
                        <MenuItem text="Fuzzy search" onClick={() => this.setFilterType(FileFilteringType.Fuzzy)} />
                        <MenuItem text="Unix pattern" onClick={() => this.setFilterType(FileFilteringType.Unix)} />
                        <MenuItem text="Regular expression" onClick={() => this.setFilterType(FileFilteringType.Regex)} />
                    </Menu>
                }
                placement="bottom-end"
            >
                <Button variant="minimal" icon="filter" endIcon="caret-down">
                    {filterName}
                </Button>
            </PopoverNext>
        );

        if (browserMode === BrowserMode.File) {
            const inputTypeMenu = (
                <PopoverNext
                    animation="minimal"
                    arrow={false}
                    shouldReturnFocusOnClose={false}
                    content={
                        <Menu>
                            <MenuItem text="List filtering" onClick={() => this.setEnableImageArithmetic(false)} />
                            <MenuItem text="Image arithmetic" onClick={() => this.setEnableImageArithmetic(true)} />
                        </Menu>
                    }
                    placement="bottom-start"
                >
                    <Button variant="minimal" icon={this.isImageArithmeticEnabled ? "calculator" : "search"} endIcon="caret-down">
                        {this.isImageArithmeticEnabled ? "Image arithmetic" : "Filter"}
                    </Button>
                </PopoverNext>
            );
            if (this.isImageArithmeticEnabled) {
                return (
                    <InputGroup
                        className="arithmetic-input"
                        inputRef={this.imageArithmeticInputRef as React.Ref<HTMLInputElement>}
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

    @action setEnableImageArithmetic = (isEnabled: boolean) => {
        this.isImageArithmeticEnabled = isEnabled;
        if (isEnabled) {
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
                if (fileBrowserStore.catalogFileList) {
                    fileBrowserStore.catalogFileList = {...fileBrowserStore.catalogFileList};
                }
                break;
            default:
                if (fileBrowserStore.fileList) {
                    fileBrowserStore.fileList = {...fileBrowserStore.fileList};
                }
                break;
        }
    };

    public render() {
        const appStore = AppStore.Instance;
        const fileBrowserStore = appStore.fileBrowserStore;
        const className = classNames("file-browser-dialog", {[Classes.DARK]: appStore.isDarkTheme});

        const dialogProps: DialogProps = {
            icon: "folder-open",
            className: className,
            backdropClassName: "minimal-dialog-backdrop",
            canOutsideClickClose: false,
            lazy: true,
            isOpen: appStore.dialogStore.dialogVisible.get(DialogId.FileBrowser) || false,
            onClose: this.closeFileBrowser,
            onOpened: this.refreshFileList,
            title: "File Browser"
        };

        const actionButton = this.renderActionButton(fileBrowserStore.browserMode, fileBrowserStore.isAppendingFrame);

        let fileInput: React.ReactNode;
        const paneClassName = "file-panes";

        if (fileBrowserStore.browserMode === BrowserMode.SaveFile) {
            fileInput = this.renderSaveFilenameInput();
        } else if (fileBrowserStore.browserMode === BrowserMode.RegionExport) {
            fileInput = this.renderExportFilenameInput();
        } else {
            fileInput = this.renderOpenFilenameInput(fileBrowserStore.browserMode);
        }

        let tableProps: SimpleTableComponentProps | undefined;
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
                minWidth={FileBrowserDialogComponent.MinWidth}
                minHeight={FileBrowserDialogComponent.MinHeight}
                defaultWidth={FileBrowserDialogComponent.DefaultWidth}
                defaultHeight={FileBrowserDialogComponent.DefaultHeight}
                isResizingEnabled={true}
                dialogId={DialogId.FileBrowser}
            >
                <div className="file-path">
                    {this.pathItems && (
                        <React.Fragment>
                            <ButtonGroup>
                                <Tooltip content={"Refresh current directory"}>
                                    <AnchorButton
                                        icon="repeat"
                                        onClick={() => {
                                            if (fileList?.directory) {
                                                fileBrowserStore.selectFolder(fileList.directory, true);
                                            }
                                        }}
                                        variant="minimal"
                                    />
                                </Tooltip>
                                <Tooltip content={"Input directory path"} disabled={this.isEditPathEnabled}>
                                    <AnchorButton className="edit-path-button" icon="edit" variant="minimal" onClick={this.switchEditPathMode} />
                                </Tooltip>
                            </ButtonGroup>
                            {this.isEditPathEnabled ? (
                                <InputGroup
                                    className="directory-path-input"
                                    autoFocus={true}
                                    placeholder={"Input directory path with respect to the top level folder"}
                                    onChange={this.handleInputPathChanged}
                                    onKeyDown={ev => this.submitInputPath(ev)}
                                    defaultValue={"/" + (fileBrowserStore.getfileListByMode?.directory || "")}
                                />
                            ) : (
                                <Breadcrumbs className="path-breadcrumbs" breadcrumbRenderer={this.renderBreadcrumb} items={this.pathItems} />
                            )}
                        </React.Fragment>
                    )}
                </div>
                <div className={Classes.DIALOG_BODY}>
                    <div className={paneClassName}>
                        <div className="file-list" data-testid="file-list">
                            <FileListTableComponent
                                darkTheme={appStore.isDarkTheme}
                                loading={fileBrowserStore.isLoadingList}
                                extendedLoading={fileBrowserStore.isExtendedLoading}
                                fileProgress={fileProgress}
                                fileList={fileBrowserStore.getfileListByMode}
                                fileBrowserMode={fileBrowserStore.browserMode}
                                selectedFile={fileBrowserStore.selectedFile}
                                selectedHDU={fileBrowserStore.selectedHDU || ""}
                                filterString={this.debouncedFilterString}
                                filterType={appStore.preferenceStore.fileFilteringType}
                                sortingString={appStore.preferenceStore.fileSortingString}
                                onSortingChanged={fileBrowserStore.setSortingConfig}
                                onFileClicked={this.handleFileClicked}
                                onSelectionChanged={fileBrowserStore.setSelectedFiles}
                                onFileDoubleClicked={this.loadSelectedFiles}
                                onFolderClicked={this.handleFolderClicked}
                                onListCancelled={this.handleFileListRequestCancelled}
                            />
                        </div>
                        <div className="file-info-pane">
                            <FileInfoComponent
                                infoTypes={FileBrowserDialogComponent.getFileInfoTypes(fileBrowserStore.browserMode)}
                                HDUOptions={{HDUList: fileBrowserStore.HDUList || [], handleSelectedHDUChange: fileBrowserStore.selectHDU}}
                                fileInfoExtended={fileBrowserStore.fileInfoExtended}
                                regionFileInfo={fileBrowserStore.regionFileInfo ? fileBrowserStore.regionFileInfo.join("\n") : ""}
                                catalogFileInfo={fileBrowserStore.catalogFileInfo}
                                selectedTab={fileBrowserStore.selectedTab as FileInfoType}
                                handleTabChange={this.handleTabChange}
                                isLoading={fileBrowserStore.isLoadingInfo}
                                errorMessage={fileBrowserStore.responseErrorMessage}
                                catalogHeaderTable={tableProps}
                                selectedFile={fileBrowserStore.selectedFile || undefined}
                            />
                        </div>
                    </div>
                    {fileInput}
                </div>
                <div className={Classes.DIALOG_FOOTER}>
                    <div className={Classes.DIALOG_FOOTER_ACTIONS}>{actionButton}</div>
                </div>
                <Alert
                    className={classNames({[Classes.DARK]: appStore.isDarkTheme})}
                    isOpen={this.isOverwriteExistingFileAlertVisible}
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
                    timeRemaining={appStore.estimatedTaskRemainingTime || 0}
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
        if (appStore.dialogStore.dialogVisible.get(DialogId.Stokes)) {
            appStore.dialogStore.hideDialog(DialogId.Stokes);
        }
        fileBrowserStore.hideFileBrowser();
    };

    private renderBreadcrumb = (props: BreadcrumbProps) => {
        return (
            <Breadcrumb onClick={props.onClick} className="folder-breadcrumb">
                {props.icon && <Icon size={14} icon={props.icon} />}
                {props.text}
            </Breadcrumb>
        );
    };

    private static getFileInfoTypes(fileBrowserMode: BrowserMode): Array<FileInfoType> {
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
        const pathItems: BreadcrumbProps[] = [
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
        if (keyEvent && keyEvent.key === "Enter" && this.inputPathString !== "") {
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
        this.inputPathString = "/" + (fileBrowserStore.getfileListByMode?.directory || "");
        this.isEditPathEnabled = !this.isEditPathEnabled;
    };
}

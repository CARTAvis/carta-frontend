import {action, computed, observable, makeObservable, autorun, flow} from "mobx";
import {IOptionProps, TabId} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {BackendService} from "services";
import {AppStore, DialogStore, PreferenceKeys, PreferenceStore} from "stores";
import {RegionStore} from "stores/Frame";
import {RegionId} from "stores/widgets";
import {AppToaster, ErrorToast} from "components/Shared";
import {FileInfoType} from "components";
import {Freq, FrequencyUnit, LineOption, ToFileListFilterMode} from "models";
import {getDataTypeString, ProcessedColumnData} from "utilities";

export enum BrowserMode {
    File,
    SaveFile,
    RegionImport,
    RegionExport,
    Catalog
}

export enum FileFilteringType {
    Fuzzy = "fuzzy",
    Unix = "unix",
    Regex = "regex"
}

export type RegionFileType = CARTA.FileType.CRTF | CARTA.FileType.DS9_REG;
export type ImageFileType = CARTA.FileType.CASA | CARTA.FileType.FITS | CARTA.FileType.HDF5 | CARTA.FileType.MIRIAD;
export type CatalogFileType = CARTA.CatalogFileType.VOTable | CARTA.CatalogFileType.FITSTable;

export interface ISelectedFile {
    fileInfo?: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    hdu?: string;
}

export class FileBrowserStore {
    private static staticInstance: FileBrowserStore;

    static get Instance() {
        if (!FileBrowserStore.staticInstance) {
            FileBrowserStore.staticInstance = new FileBrowserStore();
        }
        return FileBrowserStore.staticInstance;
    }

    private static readonly ExtendedLoadingDelay = 500;

    @observable browserMode: BrowserMode = BrowserMode.File;
    @observable appendingFrame = false;
    @observable fileList: CARTA.IFileListResponse;
    @observable selectedFile: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    @observable selectedHDU: string;
    @observable HDUfileInfoExtended: {[k: string]: CARTA.IFileInfoExtended};
    @observable regionFileInfo: string[];
    @observable selectedTab: TabId = FileInfoType.IMAGE_FILE;
    @observable loadingList = false;
    @observable isImportingRegions = false;
    @observable extendedLoading = false;
    @observable loadingInfo = false;
    @observable fileInfoResp = false;
    @observable responseErrorMessage: string = "";
    @observable startingDirectory: string = "$BASE";
    @observable exportFilename: string;
    @observable exportCoordinateType: CARTA.CoordinateType;
    @observable exportFileType: RegionFileType;
    @observable exportRegionIndexes: number[] = [];

    @observable catalogFileList: CARTA.ICatalogListResponse;
    @observable selectedCatalogFile: CARTA.ICatalogFileInfo;
    @observable catalogFileInfo: CARTA.ICatalogFileInfo;
    @observable catalogHeaders: Array<CARTA.ICatalogHeader>;

    // Save image
    @observable saveFilename: string = "";
    @observable saveFileType: CARTA.FileType = CARTA.FileType.CASA;
    @observable saveSpectralRange: string[] = ["0", "0"];
    @observable saveStokesOption: number;
    @observable saveRegionId: number;
    @observable saveRestFreq: Freq = {value: 0, unit: FrequencyUnit.MHZ};
    @observable shouldDropDegenerateAxes: boolean;

    private extendedDelayHandle: any;

    constructor() {
        makeObservable(this);
        this.exportCoordinateType = CARTA.CoordinateType.WORLD;
        this.exportFileType = CARTA.FileType.CRTF;

        autorun(() => {
            const activeFrame = AppStore.Instance.activeFrame;
            if (activeFrame) {
                // Update channelValueBounds for save image
                FileBrowserStore.Instance.initialSaveSpectralRange();
                this.setSaveFileType(activeFrame.frameInfo?.fileInfo.type === CARTA.FileType.CASA ? CARTA.FileType.CASA : CARTA.FileType.FITS);

                // update regions
                this.resetExportRegionIndexes();

                // update rest freq
                this.setSaveRestFreq(Object.assign({}, activeFrame.restFreqStore.customRestFreq));
            }
        });
    }

    @observable selectedFiles: ISelectedFile[];

    @observable isLoadingDialogOpen: boolean;
    @observable loadingProgress: number;
    @observable loadingCheckedCount: number;
    @observable loadingTotalCount: number;

    @action setImportingRegions = (isImportingRegions: boolean) => {
        this.isImportingRegions = isImportingRegions;
    };

    @action showFileBrowser = (mode: BrowserMode, append = false) => {
        switch (mode) {
            case BrowserMode.SaveFile:
                if (AppStore.Instance.appendFileDisabled || AppStore.Instance.backendService?.serverFeatureFlags === CARTA.ServerFeatureFlags.READ_ONLY) {
                    return;
                }
                break;
            case BrowserMode.File:
                if (!append && AppStore.Instance.openFileDisabled) {
                    return;
                } else if (append && AppStore.Instance.appendFileDisabled) {
                    return;
                }
                break;
            case BrowserMode.Catalog:
            default:
                if (AppStore.Instance.appendFileDisabled) {
                    return;
                }
        }
        this.appendingFrame = append;
        this.browserMode = mode;
        DialogStore.Instance.showFileBrowserDialog();
        this.fileList = null;
        this.selectedTab = this.getBrowserMode;
        this.responseErrorMessage = "";
        this.exportFilename = "";
        this.catalogFileList = null;
        this.getFileList(this.startingDirectory);
        if (AppStore.Instance.activeFrame && mode === BrowserMode.SaveFile) {
            this.saveFilename = AppStore.Instance.activeFrame.frameInfo.fileInfo.name;
        }
        this.initialSaveSpectralRange();
        this.saveRegionId = 0;
        this.shouldDropDegenerateAxes = false;
    };

    @action hideFileBrowser = () => {
        DialogStore.Instance.hideFileBrowserDialog();
    };

    @action setFileList = (list: CARTA.IFileListResponse) => {
        this.fileList = list;
    };

    @action setCatalogFileList = (list: CARTA.ICatalogListResponse) => {
        this.catalogFileList = list;
    };

    private setExtendedDelayTimer() {
        this.clearExtendedDelayTimer();
        this.extendedDelayHandle = setTimeout(() => this.setExtendedLoading(true), FileBrowserStore.ExtendedLoadingDelay);
    }

    private clearExtendedDelayTimer(resetState: boolean = false) {
        if (this.extendedDelayHandle) {
            clearTimeout(this.extendedDelayHandle);
            this.extendedDelayHandle = null;
        }
        if (resetState) {
            this.setExtendedLoading(false);
        }
    }

    @action private setExtendedLoading = (val: boolean) => {
        this.extendedLoading = val;
    };

    @flow.bound
    *getFileList(directory: string = "") {
        const appStore = AppStore.Instance;

        this.loadingList = true;
        this.setExtendedDelayTimer();

        this.selectedFile = null;
        this.selectedHDU = null;
        this.HDUfileInfoExtended = null;
        this.regionFileInfo = null;
        this.catalogFileInfo = null;
        const filterMode = ToFileListFilterMode(appStore.preferenceStore.fileFilterMode);
        AppStore.Instance.restartTaskProgress();

        try {
            if (this.browserMode === BrowserMode.File || this.browserMode === BrowserMode.SaveFile) {
                const list = yield appStore.backendService.getFileList(directory, filterMode);
                this.setFileList(list);
            } else if (this.browserMode === BrowserMode.Catalog) {
                const list = yield appStore.backendService.getCatalogList(directory, filterMode);
                this.setCatalogFileList(list);
            } else {
                const list = yield appStore.backendService.getRegionList(directory, filterMode);
                this.setFileList(list);
            }
        } catch (err) {
            console.log(err);
            AppToaster.show(ErrorToast(`Error loading file list for directory ${directory}`));
        }
        this.loadingList = false;
        this.resetLoadingStates();
    }

    @flow.bound
    *getFileInfo(directory: string, file: string, hdu: string) {
        const backendService = BackendService.Instance;
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.HDUfileInfoExtended = null;
        this.responseErrorMessage = "";

        try {
            const res = yield backendService.getFileInfo(directory, file, hdu);
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.HDUfileInfoExtended = res.fileInfoExtended;
                const HDUList = Object.keys(this.HDUfileInfoExtended);
                if (HDUList?.length >= 1) {
                    this.selectedHDU = HDUList[0];
                }
                this.loadingInfo = false;
            }
            this.fileInfoResp = true;
        } catch (err) {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.HDUfileInfoExtended = null;
            this.loadingInfo = false;
        }
    }

    @flow.bound
    *getRegionFileInfo(directory: string, file: string) {
        const backendService = BackendService.Instance;
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.regionFileInfo = null;
        this.responseErrorMessage = "";

        try {
            const res = yield backendService.getRegionFileInfo(directory, file);
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.loadingInfo = false;
                this.regionFileInfo = res.contents;
            }
            this.fileInfoResp = true;
        } catch (err) {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.regionFileInfo = null;
            this.loadingInfo = false;
        }
    }

    @flow.bound *getCatalogFileInfo(directory: string, filename: string) {
        const backendService = BackendService.Instance;
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.catalogFileInfo = null;
        this.catalogHeaders = [];
        this.responseErrorMessage = "";

        try {
            const res = yield backendService.getCatalogFileInfo(directory, filename);
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.loadingInfo = false;
                this.catalogFileInfo = res.fileInfo;
                this.catalogHeaders = res.headers.sort((a, b) => {
                    return a.columnIndex - b.columnIndex;
                });
            }
            this.fileInfoResp = true;
        } catch (err) {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.catalogFileInfo = null;
            this.loadingInfo = false;
        }
    }

    /// Update the spectral range for save image file
    @action initialSaveSpectralRange = () => {
        const activeFrame = AppStore.Instance.activeFrame;
        if (activeFrame && activeFrame.numChannels > 1) {
            const min = Math.min(activeFrame.channelValueBounds.max, activeFrame.channelValueBounds.min);
            const max = Math.max(activeFrame.channelValueBounds.max, activeFrame.channelValueBounds.min);
            const delta = (max - min) / (activeFrame.numChannels - 1);
            this.saveSpectralRange = [min.toString(), max.toString(), delta.toString()];
        }
    };

    getConcatFilesHeader = async (directory: string, file: string, hdu: string): Promise<{file: string; info: CARTA.IFileInfoExtended}> => {
        const res = await BackendService.Instance.getFileInfo(directory, file, hdu);
        return {file: res.fileInfo.name, info: res.fileInfoExtended};
    };

    @action selectFile = (file: ISelectedFile) => {
        const fileList = this.getfileListByMode;
        this.selectedFile = file.fileInfo;

        if (file.hdu) {
            this.selectedHDU = file.hdu;
        }

        if (this.browserMode === BrowserMode.File) {
            this.getFileInfo(fileList.directory, file.fileInfo.name, file.hdu);
        } else if (this.browserMode === BrowserMode.SaveFile) {
            this.getFileInfo(fileList.directory, file.fileInfo.name, file.hdu);
            this.saveFilename = file.fileInfo.name;
        } else if (this.browserMode === BrowserMode.Catalog) {
            this.getCatalogFileInfo(fileList.directory, file.fileInfo.name);
        } else {
            this.setExportFilename(file.fileInfo.name);
            this.getRegionFileInfo(fileList.directory, file.fileInfo.name);
        }
    };

    @action selectFolder = (folder: string, absolutePath: boolean = false) => {
        if (absolutePath) {
            this.getFileList(folder);
            return;
        }
        const fileList = this.getfileListByMode;
        if (folder === "..") {
            this.selectParent();
        } else if (fileList) {
            const currentDir = fileList.directory;
            let newFolder = folder;
            if (currentDir?.length && !(currentDir.length === 1 && currentDir[0] === "/")) {
                newFolder = `${currentDir}/${folder}`;
            }
            this.getFileList(newFolder);
        }
    };

    @action selectParent() {
        const fileList = this.getfileListByMode;
        if (fileList && fileList.parent) {
            this.getFileList(fileList.parent);
        }
    }

    @action selectHDU = (hdu: string) => {
        if (hdu in this.HDUfileInfoExtended) {
            this.selectedHDU = hdu;
        }
    };

    @action setSelectedTab(newId: TabId) {
        this.selectedTab = newId;
    }

    @action saveStartingDirectory(directory?: string) {
        this.setStartingDirectory(directory);
        const preferenceStore = PreferenceStore.Instance;
        if (preferenceStore.keepLastUsedFolder) {
            preferenceStore.setPreference(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER, this.startingDirectory);
        } else {
            preferenceStore.setPreference(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER, "");
        }
    }

    @action setStartingDirectory(directory?: string) {
        if (directory !== undefined) {
            this.startingDirectory = directory;
        } else {
            if (this.browserMode === BrowserMode.Catalog) {
                this.startingDirectory = this.catalogFileList.directory;
            } else {
                this.startingDirectory = this.fileList.directory;
            }
        }
    }

    @action restoreStartingDirectory() {
        const preferenceStore = PreferenceStore.Instance;
        if (preferenceStore.keepLastUsedFolder) {
            if (preferenceStore.lastUsedFolder?.length > 0) {
                this.startingDirectory = preferenceStore.lastUsedFolder;
            } else {
                preferenceStore.setPreference(PreferenceKeys.GLOBAL_SAVED_LAST_FOLDER, "");
            }
        }
    }

    @action setExportFilename = (filename: string) => {
        this.exportFilename = filename;
    };

    @action setExportCoordinateType = (coordType: CARTA.CoordinateType) => {
        this.exportCoordinateType = coordType;
    };

    @action setExportFileType = (fileType: RegionFileType) => {
        this.exportFileType = fileType;
    };

    @action resetExportRegionIndexes = () => {
        if (AppStore.Instance.activeFrame?.regionSet?.regions) {
            // include all region indexes except cursor region
            this.exportRegionIndexes = Array.from(AppStore.Instance.activeFrame.regionSet.regions.keys()).slice(1);
        } else {
            this.exportRegionIndexes = [];
        }
    };

    @action clearExportRegionIndexes = () => {
        this.exportRegionIndexes = [];
    };

    @action addExportRegionIndex = (regionIndex: number) => {
        if (!this.exportRegionIndexes.includes(regionIndex)) {
            this.exportRegionIndexes.push(regionIndex);
            this.exportRegionIndexes.sort();
        }
    };

    @action deleteExportRegionIndex = (regionIndex: number) => {
        const index = this.exportRegionIndexes.indexOf(regionIndex);
        if (index > -1) {
            this.exportRegionIndexes.splice(index, 1);
        }
    };

    @action setSaveFilename = (filename: string) => {
        this.saveFilename = filename;
    };

    @action setSaveFileType = (fileType: CARTA.FileType) => {
        this.saveFileType = fileType;
    };

    @action setSortingConfig = (columnName: string, direction: number) => {
        const sortingString = (direction >= 0 ? "+" : "-") + columnName.toLowerCase();
        PreferenceStore.Instance.setPreference(PreferenceKeys.SILENT_FILE_SORTING_STRING, sortingString);
    };

    @action setSaveRegionId = (regionId: number) => {
        if (0 <= regionId && isFinite(regionId)) {
            this.saveRegionId = regionId;
        }
    };

    @action setSaveSpectralRangeMin = (min: string) => {
        this.saveSpectralRange[0] = min;
    };

    @action setSaveSpectralRangeMax = (max: string) => {
        this.saveSpectralRange[1] = max;
    };

    @action setSelectedFiles = (selection: ISelectedFile[]) => {
        this.selectedFiles = selection;
    };

    @action showLoadingDialog = () => {
        this.isLoadingDialogOpen = true;
    };

    @action updateLoadingState = (progress: number, checkedCount: number, totalCount: number) => {
        this.loadingProgress = progress;
        this.loadingCheckedCount = checkedCount;
        this.loadingTotalCount = totalCount;
    };

    @action resetLoadingStates = () => {
        this.loadingList = false;
        this.clearExtendedDelayTimer(true);
        this.isLoadingDialogOpen = false;
        this.updateLoadingState(0, 0, 0);
    };

    @action cancelRequestingFileList = () => {
        this.loadingList = false;
        if (this.loadingProgress < 1.0) {
            if (this.browserMode === BrowserMode.Catalog) {
                BackendService.Instance.cancelRequestingFileList(CARTA.FileListType.Catalog);
            } else {
                BackendService.Instance.cancelRequestingFileList(CARTA.FileListType.Image);
            }
        }
    };

    @action showExportRegions = (regionId?: number) => {
        this.showFileBrowser(BrowserMode.RegionExport, false);
        if (regionId) {
            this.clearExportRegionIndexes();
            const frame = AppStore.Instance.activeFrame;
            if (frame?.regionSet?.regions) {
                const regionIndex = frame.regionSet.regions.findIndex(region => region.regionId === regionId);
                this.addExportRegionIndex(regionIndex);
            }
        } else {
            this.resetExportRegionIndexes();
        }
    };

    @action setSaveRestFreqVal = (val: number) => {
        this.saveRestFreq.value = val;
    };

    @action setSaveRestFreqUnit = (unit: FrequencyUnit) => {
        this.saveRestFreq.unit = unit;
    };

    @action setSaveRestFreq = (freq: Freq) => {
        this.saveRestFreq = freq;
    };

    resetSaveRestFreq = () => {
        const restFreqStore = AppStore.Instance.activeFrame?.restFreqStore;
        if (restFreqStore) {
            this.setSaveRestFreq(restFreqStore.headerRestFreq);
        }
    };

    @computed get saveRestFreqInHz(): number {
        if (!isFinite(this.saveRestFreq.value)) {
            return undefined;
        }
        return Freq.convertUnitToHz(this.saveRestFreq);
    }

    @computed get HDUList(): IOptionProps[] {
        return this.HDUfileInfoExtended
            ? Object.keys(this.HDUfileInfoExtended)?.map(hdu => {
                  // hdu extension name is in field 3 of fileInfoExtended computed entries
                  const extName =
                      this.HDUfileInfoExtended[hdu]?.computedEntries?.length >= 3 && this.HDUfileInfoExtended[hdu].computedEntries[2]?.name === "Extension name" ? `: ${this.HDUfileInfoExtended[hdu].computedEntries[2]?.value}` : "";
                  return {
                      label: `${hdu}${extName}`,
                      value: hdu
                  };
              })
            : null;
    }

    @computed get fileInfoExtended(): CARTA.IFileInfoExtended {
        return this.HDUfileInfoExtended && this.selectedHDU in this.HDUfileInfoExtended ? this.HDUfileInfoExtended[this.selectedHDU] : null;
    }

    @computed get isComplexImage() {
        const dataTypeEntry = this.fileInfoExtended?.computedEntries?.find(e => e.name === "Data type");
        return dataTypeEntry?.value === "Complex";
    }

    @computed get fileInfo() {
        let fileInfo = "";
        if (this.fileInfoExtended?.computedEntries) {
            this.fileInfoExtended.computedEntries.forEach(header => {
                fileInfo += `${header.name} = ${header.value}\n`;
            });
        }
        return fileInfo;
    }

    @computed get headers() {
        let headers = "";
        if (this.fileInfoExtended?.headerEntries) {
            this.fileInfoExtended.headerEntries.forEach(header => {
                if (header.name === "END") {
                    headers += `${header.name}\n`;
                } else {
                    headers += `${header.name} = ${header.value}\n`;
                }
            });
        }
        return headers;
    }

    @computed get getfileListByMode(): CARTA.IFileListResponse | CARTA.ICatalogListResponse {
        switch (this.browserMode) {
            case BrowserMode.Catalog:
                return this.catalogFileList;
            default:
                return this.fileList;
        }
    }

    @computed get getBrowserMode(): FileInfoType {
        switch (this.browserMode) {
            case BrowserMode.File:
                return FileInfoType.IMAGE_FILE;
            case BrowserMode.SaveFile:
                return FileInfoType.SAVE_IMAGE;
            case BrowserMode.Catalog:
                return FileInfoType.CATALOG_FILE;
            case BrowserMode.RegionExport:
                return FileInfoType.SELECT_REGION;
            default:
                return FileInfoType.REGION_FILE;
        }
    }

    @computed get catalogHeaderDataset(): {columnHeaders: Array<CARTA.CatalogHeader>; columnsData: Map<number, ProcessedColumnData>} {
        const nameData = [];
        const unitData = [];
        const typeData = [];
        const descriptionData = [];

        for (let index = 0; index < this.catalogHeaders.length; index++) {
            const catalogHeader = this.catalogHeaders[index];
            nameData.push(catalogHeader.name);
            unitData.push(catalogHeader.units);
            typeData.push(getDataTypeString(catalogHeader.dataType));
            descriptionData.push(catalogHeader.description);
        }

        const dataType = CARTA.ColumnType.String;
        const columnsData = new Map<number, ProcessedColumnData>([
            [0, {dataType, data: nameData}],
            [1, {dataType, data: unitData}],
            [2, {dataType, data: typeData}],
            [3, {dataType, data: descriptionData}]
        ]);

        const columnHeaders = [
            new CARTA.CatalogHeader({name: "Name", dataType, columnIndex: 0}),
            new CARTA.CatalogHeader({name: "Unit", dataType, columnIndex: 1}),
            new CARTA.CatalogHeader({name: "Data Type", dataType, columnIndex: 2}),
            new CARTA.CatalogHeader({name: "Description", dataType, columnIndex: 3})
        ];

        return {columnHeaders: columnHeaders, columnsData: columnsData};
    }

    /// Transfer the request from stokes string
    /// to [start, end, stride]
    /// Ex. "ABC" could be "IQU" or "QUV"
    /// Ex. "AB" could be "IQ", "IU", "IV", "QU", "UV", or "QV"
    @computed get saveStokesRange(): number[] {
        // [start, end, stride] for "ABCD"
        const options: number[][] = [
            [], // all
            [0, 0, 1], // A
            [1, 1, 1], // B
            [2, 2, 1], // C
            [3, 3, 1], // D
            [0, 1, 1], // AB
            [1, 2, 1], // BC
            [2, 3, 1], // CD
            [0, 2, 2], // AC
            [0, 3, 3], // AD
            [1, 3, 2], // BD
            [0, 2, 1], // ABC
            [1, 3, 1] // BCD
        ];
        return options[this.saveStokesOption];
    }

    @computed get exportRegionOptions(): LineOption[] {
        let options: LineOption[] = [];
        const appStore = AppStore.Instance;
        const frame = appStore.activeFrame;
        if (frame?.regionSet?.regions) {
            const activeRegionId = appStore.selectedRegion ? appStore.selectedRegion.regionId : RegionId.CURSOR;
            frame.regionSet.regions.forEach((region, index) => {
                if (region.regionId !== RegionId.CURSOR) {
                    options.push({
                        value: index,
                        label: region.nameString,
                        active: region.regionId === activeRegionId,
                        icon: RegionStore.RegionIconString(region.regionType),
                        isCustomIcon: RegionStore.IsRegionCustomIcon(region.regionType)
                    });
                }
            });
        }
        return options;
    }

    @computed get regionOptionNum(): number {
        return this.exportRegionOptions?.length;
    }

    @computed get exportRegionNum(): number {
        return this.exportRegionIndexes?.length;
    }
}

import {action, computed, observable, makeObservable, runInAction} from "mobx";
import {IOptionProps, TabId} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {BackendService} from "services";
import {AppStore, DialogStore, PreferenceKeys, PreferenceStore} from "stores";
import {FileInfoType} from "components";
import {ProcessedColumnData} from "models";
import {getDataTypeString} from "utilities";

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
    fileInfo?: CARTA.IFileInfo | CARTA.ICatalogFileInfo,
    hdu?: string
}

export class FileBrowserStore {
    private static staticInstance: FileBrowserStore;

    static get Instance() {
        if (!FileBrowserStore.staticInstance) {
            FileBrowserStore.staticInstance = new FileBrowserStore();
        }
        return FileBrowserStore.staticInstance;
    }

    @observable browserMode: BrowserMode = BrowserMode.File;
    @observable appendingFrame = false;
    @observable fileList: CARTA.IFileListResponse;
    @observable selectedFile: CARTA.IFileInfo | CARTA.ICatalogFileInfo;
    @observable selectedHDU: string;
    @observable HDUfileInfoExtended: {[k: string]: CARTA.IFileInfoExtended};
    @observable regionFileInfo: string[];
    @observable selectedTab: TabId = FileInfoType.IMAGE_FILE;
    @observable loadingList = false;
    @observable loadingInfo = false;
    @observable fileInfoResp = false;
    @observable responseErrorMessage: string = "";
    @observable startingDirectory: string = "$BASE";
    @observable exportFilename: string;
    @observable exportCoordinateType: CARTA.CoordinateType;
    @observable exportFileType: RegionFileType;

    @observable catalogFileList: CARTA.ICatalogListResponse;
    @observable selectedCatalogFile: CARTA.ICatalogFileInfo;
    @observable catalogFileInfo: CARTA.ICatalogFileInfo;
    @observable catalogHeaders: Array<CARTA.ICatalogHeader>;

    @observable saveFilename: string = "";
    @observable saveFileType: CARTA.FileType = CARTA.FileType.CASA;

    @observable selectedFiles: ISelectedFile[];

    @action showFileBrowser = (mode: BrowserMode, append = false) => {
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
    };

    @action hideFileBrowser = () => {
        DialogStore.Instance.hideFileBrowserDialog();
    };

    @action getFileList = (directory: string) => {
        const backendService = BackendService.Instance;
        this.loadingList = true;
        this.selectedFile = null;
        this.selectedHDU = null;
        this.HDUfileInfoExtended = null;
        this.regionFileInfo = null;
        this.catalogFileInfo = null;

        if (this.browserMode === BrowserMode.File || this.browserMode === BrowserMode.SaveFile) {
            AppStore.Instance.resetFileRequestState();
            AppStore.Instance.setIsRequestingFiles(true);
            backendService.getFileList(directory).subscribe(res => runInAction(() => {
                this.fileList = res;
                this.loadingList = false;
                AppStore.Instance.resetFileRequestState();
            }), err => runInAction(() => {
                console.log(err);
                this.loadingList = false;
                AppStore.Instance.resetFileRequestState();
            }));
        } else if (this.browserMode === BrowserMode.Catalog) {
            backendService.getCatalogList(directory).subscribe(res => runInAction(() => {
                this.catalogFileList = res;
                this.loadingList = false;
            }), err => runInAction(() => {
                console.log(err);
                this.loadingList = false;
            }));
        } else {
            backendService.getRegionList(directory).subscribe(res => runInAction(() => {
                this.fileList = res;
                this.loadingList = false;
            }), err => runInAction(() => {
                console.log(err);
                this.loadingList = false;
            }));
        }
        AppStore.Instance.restartTaskProgress();
    };

    @action getFileInfo = (directory: string, file: string, hdu: string) => {
        const backendService = BackendService.Instance;
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.HDUfileInfoExtended = null;
        this.responseErrorMessage = "";

        backendService.getFileInfo(directory, file, hdu).subscribe((res: CARTA.FileInfoResponse) => runInAction(() => {
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.HDUfileInfoExtended = res.fileInfoExtended;
                const HDUList = Object.keys(this.HDUfileInfoExtended);
                if (HDUList?.length >= 1) {
                    this.selectedHDU = HDUList[0];
                }
                this.loadingInfo = false;
            }
            this.fileInfoResp = true;
        }), err => runInAction(() => {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.HDUfileInfoExtended = null;
            this.loadingInfo = false;
        }));
    };

    @action getRegionFileInfo = (directory: string, file: string) => {
        const backendService = BackendService.Instance;
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.regionFileInfo = null;
        this.responseErrorMessage = "";

        backendService.getRegionFileInfo(directory, file).subscribe((res: CARTA.IRegionFileInfoResponse) => runInAction(() => {
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.loadingInfo = false;
                this.regionFileInfo = res.contents;
            }
            this.fileInfoResp = true;
        }), err => runInAction(() => {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.regionFileInfo = null;
            this.loadingInfo = false;
        }));
    };

    @action getCatalogFileInfo = (directory: string, filename: string) => {
        const backendService = BackendService.Instance;
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.catalogFileInfo = null;
        this.catalogHeaders = [];
        this.responseErrorMessage = "";

        backendService.getCatalogFileInfo(directory, filename).subscribe((res: CARTA.ICatalogFileInfoResponse) => runInAction(() => {
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.loadingInfo = false;
                this.catalogFileInfo = res.fileInfo;
                this.catalogHeaders = res.headers.sort((a, b) => {
                    return a.columnIndex - b.columnIndex;
                });
            }
            this.fileInfoResp = true;
        }), err => runInAction(() => {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.catalogFileInfo = null;
            this.loadingInfo = false;
        }));
    };

    @action getConcatFilesHeader = (directory: string, file: string, hdu: string): Promise<{file: string, info: CARTA.IFileInfoExtended}> => {
        return new Promise((resolve, reject) => {
            BackendService.Instance.getFileInfo(directory, file, hdu).subscribe((res: CARTA.FileInfoResponse) => {
                resolve({file: res.fileInfo.name, info: res.fileInfoExtended});
            }, err => {
                reject(err);
            });
        })
    }

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
            if (currentDir.length && !(currentDir.length === 1 && currentDir[0] === "/")) {
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

    @action setExportFilename = (filename: string) => {
        this.exportFilename = filename;
    };

    @action setExportCoordinateType = (coordType: CARTA.CoordinateType) => {
        this.exportCoordinateType = coordType;
    };

    @action setExportFileType = (fileType: RegionFileType) => {
        this.exportFileType = fileType;
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

    @action setSelectedFiles = (selection: ISelectedFile[]) => {
        this.selectedFiles = selection;
    };

    @computed get HDUList(): IOptionProps[] {
        return this.HDUfileInfoExtended ?
            Object.keys(this.HDUfileInfoExtended)?.map(hdu => {
                // hdu extension name is in field 3 of fileInfoExtended computed entries
                const extName = this.HDUfileInfoExtended[hdu]?.computedEntries?.length >= 3 && this.HDUfileInfoExtended[hdu].computedEntries[2]?.name === "Extension name" ?
                    `: ${this.HDUfileInfoExtended[hdu].computedEntries[2]?.value}` : "";
                return {
                    label: `${hdu}${extName}`,
                    value: hdu
                }
            }) :
            null;
    }

    @computed get fileInfoExtended(): CARTA.IFileInfoExtended {
        return this.HDUfileInfoExtended && this.selectedHDU in this.HDUfileInfoExtended ? this.HDUfileInfoExtended[this.selectedHDU] : null;
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
            case BrowserMode.SaveFile:
                return FileInfoType.IMAGE_FILE;
            case BrowserMode.Catalog:
                return FileInfoType.CATALOG_FILE;
            default:
                return FileInfoType.REGION_FILE;
        }
    }

    @computed get catalogHeaderDataset(): { columnHeaders: Array<CARTA.CatalogHeader>, columnsData: Map<number, ProcessedColumnData> } {
        let columnsData = new Map<number, ProcessedColumnData>();

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
        columnsData.set(0, {dataType, data: nameData});
        columnsData.set(1, {dataType, data: unitData});
        columnsData.set(2, {dataType, data: typeData});
        columnsData.set(3, {dataType, data: descriptionData});

        let columnHeaders = [
            new CARTA.CatalogHeader({name: "Name", dataType, columnIndex: 0}),
            new CARTA.CatalogHeader({name: "Unit", dataType, columnIndex: 1}),
            new CARTA.CatalogHeader({name: "Data Type", dataType, columnIndex: 2}),
            new CARTA.CatalogHeader({name: "Description", dataType, columnIndex: 3})
        ];

        return {columnHeaders: columnHeaders, columnsData: columnsData};
    }

    constructor() {
        makeObservable(this);
        this.exportCoordinateType = CARTA.CoordinateType.WORLD;
        this.exportFileType = CARTA.FileType.CRTF;
    }
}

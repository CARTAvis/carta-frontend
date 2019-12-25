import {action, computed, observable} from "mobx";
import {TabId} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {BackendService} from "services";
import {FileInfoType} from "components";

export enum BrowserMode {
    File,
    RegionImport,
    RegionExport
}

export type RegionFileType = CARTA.FileType.CRTF | CARTA.FileType.REG;
export type ImageFileType = CARTA.FileType.CASA | CARTA.FileType.FITS | CARTA.FileType.HDF5 | CARTA.FileType.MIRIAD;

export class FileBrowserStore {
    @observable fileBrowserDialogVisible = false;
    @observable browserMode: BrowserMode = BrowserMode.File;
    @observable appendingFrame = false;
    @observable fileList: CARTA.IFileListResponse;
    @observable selectedFile: CARTA.IFileInfo;
    @observable selectedHDU: string;
    @observable fileInfoExtended: CARTA.IFileInfoExtended;
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

    @action showFileBrowser = (mode: BrowserMode, append = false) => {
        this.appendingFrame = append;
        this.browserMode = mode;
        this.fileBrowserDialogVisible = true;
        this.fileList = null;
        this.selectedTab = (BrowserMode.File === mode) ? FileInfoType.IMAGE_FILE : FileInfoType.REGION_FILE;
        this.responseErrorMessage = "";
        this.exportFilename = "";
        this.getFileList(this.startingDirectory);
    };

    @action hideFileBrowser = () => {
        this.fileBrowserDialogVisible = false;
    };

    @action getFileList = (directory: string) => {
        this.loadingList = true;
        this.selectedFile = null;
        this.selectedHDU = null;
        this.fileInfoExtended = null;
        this.regionFileInfo = null;

        if (this.browserMode === BrowserMode.File) {
            this.backendService.getFileList(directory).subscribe(res => {
                this.fileList = res;
            }, err => {
                console.log(err);
                this.loadingList = false;
            });
        } else {
            this.backendService.getRegionList(directory).subscribe(res => {
                this.fileList = res;
            }, err => {
                console.log(err);
                this.loadingList = false;
            });
        }
    };

    @action getFileInfo = (directory: string, file: string, hdu: string) => {
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.fileInfoExtended = null;
        this.responseErrorMessage = "";
        this.backendService.getFileInfo(directory, file, hdu).subscribe((res: CARTA.FileInfoResponse) => {
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.fileInfoExtended = res.fileInfoExtended;
                this.loadingInfo = false;
            }
            this.fileInfoResp = true;
        }, err => {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.fileInfoExtended = null;
            this.loadingInfo = false;
        });
    };

    @action getRegionFileInfo = (directory: string, file: string) => {
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.regionFileInfo = null;
        this.responseErrorMessage = "";
        this.backendService.getRegionFileInfo(directory, file).subscribe((res: CARTA.IRegionFileInfoResponse) => {
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.loadingInfo = false;
                this.regionFileInfo = res.contents;
            }
            this.fileInfoResp = true;
        }, err => {
            console.log(err);
            this.responseErrorMessage = err;
            this.fileInfoResp = false;
            this.regionFileInfo = null;
            this.loadingInfo = false;
        });
    };

    @action selectFile = (file: CARTA.IFileInfo, hdu: string) => {
        this.selectedFile = file;
        this.selectedHDU = hdu;
        if (this.browserMode === BrowserMode.File) {
            this.getFileInfo(this.fileList.directory, file.name, hdu);
        } else {
            this.setExportFilename(file.name);
            this.getRegionFileInfo(this.fileList.directory, file.name);
        }
    };

    @action selectFolder = (folder: string, absolutePath: boolean) => {
        if (absolutePath) {
            this.getFileList(folder);
            return;
        }

        if (folder === "..") {
            this.selectParent();
        } else if (this.fileList) {
            const currentDir = this.fileList.directory;
            let newFolder = folder;
            if (currentDir.length && !(currentDir.length === 1 && currentDir[0] === "/")) {
                newFolder = `${currentDir}/${folder}`;
            }
            this.getFileList(newFolder);
        }
    };

    @action selectParent() {
        if (this.fileList && this.fileList.parent) {
            this.getFileList(this.fileList.parent);
        }
    }

    @action setSelectedTab(newId: TabId) {
        this.selectedTab = newId;
    }

    @action saveStartingDirectory() {
        this.startingDirectory = this.fileList.directory;
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

    @computed get fileInfo() {
        let fileInfo = "";
        if (this.fileInfoExtended && this.fileInfoExtended.computedEntries) {
            this.fileInfoExtended.computedEntries.forEach(header => {
                fileInfo += `${header.name} = ${header.value}\n`;
            });
        }
        return fileInfo;
    }

    @computed get headers() {
        let headers = "";
        if (this.fileInfoExtended && this.fileInfoExtended.headerEntries) {
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

    private backendService: BackendService;

    constructor(backendService: BackendService) {
        this.backendService = backendService;
        this.exportCoordinateType = CARTA.CoordinateType.WORLD;
        this.exportFileType = CARTA.FileType.CRTF;
    }
}

import {action, observable} from "mobx";
import {TabId} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {BackendService} from "services";

export class FileBrowserStore {
    @observable fileBrowserDialogVisible = false;
    @observable appendingFrame = false;
    @observable fileList: CARTA.FileListResponse;
    @observable selectedFile: CARTA.FileInfo;
    @observable selectedHDU: string;
    @observable fileInfoExtended: CARTA.FileInfoExtended;
    @observable selectedTab: TabId = "fileInfo";
    @observable loadingList = false;
    @observable loadingInfo = false;
    @observable fileInfoResp = false;
    @observable respErrmsg: string = "";

    @action showFileBrowser = (append = false) => {
        this.appendingFrame = append;
        this.fileBrowserDialogVisible = true;
        this.selectedTab = "fileInfo";
        this.getFileList("");
    };

    @action hideFileBrowser = () => {
        this.fileBrowserDialogVisible = false;
    };

    @action getFileList = (directory: string) => {
        this.loadingList = true;
        this.backendService.getFileList(directory).subscribe(res => {
            this.fileList = res;
            this.selectedFile = null;
            this.selectedHDU = null;
            this.fileInfoExtended = null;
            this.loadingList = false;
        }, err => {
            console.log(err);
            this.loadingList = false;
        });
    };

    @action getFileInfo = (directory: string, file: string, hdu: string) => {
        this.loadingInfo = true;
        this.fileInfoResp = false;
        this.fileInfoExtended = null;
        this.backendService.getFileInfo(directory, file, hdu).subscribe((res: CARTA.FileInfoResponse) => {
            if (res.fileInfo && this.selectedFile && res.fileInfo.name === this.selectedFile.name) {
                this.fileInfoExtended = res.fileInfoExtended as CARTA.FileInfoExtended;
                this.loadingInfo = false;
            }
            this.fileInfoResp = true;
        }, err => {
            console.log(err);
            this.respErrmsg = err;
            this.fileInfoResp = false;
            this.fileInfoExtended = null;
            this.loadingInfo = false;
        });
    };

    @action selectFile(file: CARTA.FileInfo, hdu: string) {
        this.selectedFile = file;
        this.selectedHDU = hdu;
        this.getFileInfo(this.fileList.directory, file.name, hdu);
    }

    @action selectFolder(folder: string) {
        if (folder === "..") {
            this.selectParent();
        }
        else if (this.fileList) {
            const currentDir = this.fileList.directory;
            let newFolder = folder;
            if (currentDir.length && !(currentDir.length === 1 && currentDir[0] === "/")) {
                newFolder = `${currentDir}/${folder}`;
            }
            this.getFileList(newFolder);
        }
    }

    @action selectParent() {
        if (this.fileList && this.fileList.parent) {
            this.getFileList(this.fileList.parent);
        }
    }

    @action setSelectedTab(newId: TabId) {
        this.selectedTab = newId;
    }

    private backendService: BackendService;

    constructor(backendService: BackendService) {
        this.backendService = backendService;
    }
}
import {BackendService} from "../services/BackendService";
import {action, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import FileInfoExtended = CARTA.FileInfoExtended;
import FileInfo = CARTA.FileInfo;
import FileListResponse = CARTA.FileListResponse;

export class FileBrowserState {
    @observable fileBrowserDialogVisible = false;
    @observable fileList: FileListResponse;
    @observable selectedFile: FileInfo;
    @observable selectedHDU: string;
    @observable fileInfoExtended: FileInfoExtended;
    @observable loadingList = false;
    @observable loadingInfo = false;
    @observable sortColumn = "name";
    @observable sortDirection = 1;

    @action showFileBrowser = () => {
        this.fileBrowserDialogVisible = true;
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
        this.backendService.getFileInfo(directory, file, hdu).subscribe((res: CARTA.FileInfoResponse) => {
            this.fileInfoExtended = res.fileInfoExtended as FileInfoExtended;
            this.loadingInfo = false;
        }, err => {
            console.log(err);
            this.loadingInfo = false;
        });
    };

    @action selectFile(file: FileInfo, hdu: string) {
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

    @action setSortColumn = (column: string) => {
        if (this.sortColumn === column) {
            this.sortDirection *= -1;
        }
        else {
            this.sortColumn = column;
            this.sortDirection = 1;
        }
    };

    private backendService: BackendService;

    constructor(backendService: BackendService) {
        this.backendService = backendService;
    }
}
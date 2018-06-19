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
            this.fileInfoExtended = null;
            this.loadingList = false;
        }, err => {
            console.log(err);
            this.loadingList = false;
        });
    };

    @action getFileInfo = (directory: string, file: string) => {
        this.loadingInfo = true;
        this.backendService.getFileInfo(directory, file).subscribe((res: CARTA.FileInfoResponse) => {
            this.fileInfoExtended = res.fileInfoExtended as FileInfoExtended;
            this.loadingInfo = false;
        }, err => {
            console.log(err);
            this.loadingInfo = false;
        });
    };

    private backendService: BackendService;

    constructor(backendService: BackendService) {
        this.backendService = backendService;
    }
}
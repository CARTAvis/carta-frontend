import {action, observable} from "mobx";
import {TabId} from "@blueprintjs/core";

export enum ImageInfoTabs {
    INFO = "tab-info",
    HEADER = "tab-header"
}

export class ImageInfoStore {
    @observable imageInfoDialogVisible = false;
    @observable selectedTab: TabId = ImageInfoTabs.INFO;

    @observable latestFileInfoCach: string = "";
    @observable latestHeadersCach: string = "";
    @observable fileInfo: string = "";
    @observable headers: string = "";

    @action showImageInfoDialog = () => {
        this.imageInfoDialogVisible = true;
    };

    @action hideImageInfoDialog = () => {
        this.imageInfoDialogVisible = false;
    };

    @action setSelectedTab(newId: TabId) {
        this.selectedTab = newId;
    }

    @action setLatestFileInfoCach(latestFileInfoCach: string) {
        this.latestFileInfoCach = latestFileInfoCach;
    }

    @action setLatestHeadersCach(latestHeadersCach: string) {
        this.latestHeadersCach = latestHeadersCach;
    }

    @action setFileInfo(fileInfo: string) {
        this.fileInfo = fileInfo;
    }

    @action setHeaders(headers: string) {
        this.headers = headers;
    }

}

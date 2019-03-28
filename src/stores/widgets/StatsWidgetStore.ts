import {action, observable} from "mobx";

export class StatsWidgetStore {
    @observable fileId: number;
    @observable regionId: number;

    constructor(fileId: number = -1, regionId: number = -1) {
        this.fileId = fileId;
        this.regionId = regionId;
    }

    @action setFileId = (fileId: number) => {
        this.fileId = fileId;
    };

    @action setRegionId = (regionId: number) => {
        this.regionId = regionId;
    };
}
import {action, observable} from "mobx";

export class StatsWidgetStore {
    @observable regionIdMap: Map<number, number>;

    constructor() {
        this.regionIdMap = new Map<number, number>();
    }

    @action clearFrameEntry = (fileId: number) => {
        this.regionIdMap.delete(fileId);
    };

    @action clearRegionMap = () => {
        this.regionIdMap.clear();
    };

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
    };

}
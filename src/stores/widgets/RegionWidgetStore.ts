import {action, observable} from "mobx";
import {AppStore} from "../AppStore";
import {FrameStore} from "../FrameStore";

export class RegionWidgetStore {
    private readonly appStore: AppStore;
    @observable regionIdMap: Map<number, number>;
    @observable isActive: boolean = true;

    constructor(appStore: AppStore) {
        this.appStore = appStore;
        this.regionIdMap = new Map<number, number>();
    }

    @action clearFrameEntry = (fileId: number) => {
        this.regionIdMap.delete(fileId);
    };

    @action clearRegionMap = () => {
        this.regionIdMap.clear();
    };

    @action syncRegionIdIfActive = (defaultRegionId: number) => {
        if (this.appStore.activeFrame && this.isActive) {
            const fileId = this.appStore.activeFrame.frameInfo.fileId;
            if (this.appStore.selectedRegion) {
                this.setRegionId(fileId, this.appStore.selectedRegion.regionId);
            } else {
                this.setRegionId(fileId, defaultRegionId);
            }
        }
    }

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
    };

    @action enableActive = () => {
        this.isActive = true;
    }

    @action disableActive = () => {
        this.isActive = false;
    }

    public static CalculateRequirementsArray(frame: FrameStore, widgetsMap: Map<string, RegionWidgetStore>) {
        const updatedRequirements = new Map<number, Array<number>>();
        const fileId = frame.frameInfo.fileId;

        widgetsMap.forEach(widgetStore => {
            const regionId = widgetStore.regionIdMap.get(fileId) || -1;
            if (!frame.regionSet) {
                return;
            }
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (regionId === -1 || region && region.isClosedRegion) {
                let frameRequirementsArray = updatedRequirements.get(fileId);
                if (!frameRequirementsArray) {
                    frameRequirementsArray = [];
                    updatedRequirements.set(fileId, frameRequirementsArray);
                }
                if (frameRequirementsArray.indexOf(regionId) === -1) {
                    frameRequirementsArray.push(regionId);
                }
            }
        });
        return updatedRequirements;
    }
}
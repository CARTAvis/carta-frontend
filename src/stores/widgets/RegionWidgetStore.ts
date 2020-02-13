import {action, observable} from "mobx";
import {AppStore} from "../AppStore";
import {FrameStore} from "../FrameStore";

export class RegionWidgetStore {
    @observable regionIdMap: Map<number, number>;

    constructor(appStore: AppStore) {
        this.regionIdMap = new Map<number, number>();
        if (appStore.selectedRegion) {
            this.setRegionId(appStore.activeFrame.frameInfo.fileId, appStore.selectedRegion.regionId);
        }
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
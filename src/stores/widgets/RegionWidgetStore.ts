import {action, observable, computed} from "mobx";
import {AppStore} from "../AppStore";
import {FrameStore} from "../FrameStore";

export enum RegionId {
    ACTIVE = -3,
    IMAGE = -1,
    CURSOR = 0
}

export enum RegionsType {
    CLOSED,
    CLOSED_AND_POINT
}
export class RegionWidgetStore {
    protected readonly appStore: AppStore;
    @observable regionIdMap: Map<number, number>;
    @observable type: RegionsType;

    constructor(appStore: AppStore, type: RegionsType) {
        this.appStore = appStore;
        this.type = type;
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

    @computed get effectiveRegionId() {
        if (this.appStore.activeFrame) {
            const regionId = this.regionIdMap.get(this.appStore.activeFrame.frameInfo.fileId);
            if (regionId === RegionId.ACTIVE || regionId === undefined) {
                const selectedRegion = this.appStore.selectedRegion;
                if (selectedRegion) {
                    return (this.type === RegionsType.CLOSED && !selectedRegion.isClosedRegion) ? RegionId.IMAGE : selectedRegion.regionId;
                } else {
                    return this.type === RegionsType.CLOSED ? RegionId.IMAGE : RegionId.CURSOR;
                }
            }
            return regionId;
        }
        return this.type === RegionsType.CLOSED ? RegionId.IMAGE : RegionId.CURSOR;
    }

    @computed get matchesSelectedRegion() {
        if (this.appStore.selectedRegion) {
            return this.effectiveRegionId === this.appStore.selectedRegion.regionId;
        }
        return false;
    }

    public static CalculateRequirementsArray(frame: FrameStore, widgetsMap: Map<string, RegionWidgetStore>) {
        const updatedRequirements = new Map<number, Array<number>>();
        const fileId = frame.frameInfo.fileId;

        widgetsMap.forEach(widgetStore => {
            const regionId = widgetStore.effectiveRegionId;
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
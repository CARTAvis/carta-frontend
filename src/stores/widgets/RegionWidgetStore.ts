import {action, observable, computed, makeObservable} from "mobx";
import {IOptionProps} from "@blueprintjs/core";
import {AppStore, FrameStore, RegionStore} from "..";
import {CARTA} from "carta-protobuf";

export const ACTIVE_FILE_ID = -1;

export enum RegionId {
    ACTIVE = -3,
    IMAGE = -1,
    CURSOR = 0
}

export enum RegionsType {
    CLOSED,
    CLOSED_AND_POINT,
    LINE
}

export class RegionWidgetStore {
    protected readonly appStore: AppStore;
    @observable fileId: number;
    @observable regionIdMap: Map<number, number>;
    @observable type: RegionsType;

    constructor(type: RegionsType) {
        makeObservable(this);
        this.appStore = AppStore.Instance;
        this.fileId = ACTIVE_FILE_ID;
        this.type = type;
        this.regionIdMap = new Map<number, number>();
    }

    @action clearFrameEntry = (fileId: number) => {
        this.regionIdMap.delete(fileId);
    };

    @action clearRegionMap = () => {
        this.regionIdMap.clear();
    };

    @action setRegionId(fileId: number, regionId: number) {
        this.regionIdMap.set(fileId, regionId);
    }

    @action setFileId = (fileId: number) => {
        this.fileId = fileId;
    };

    @computed get effectiveFrame(): FrameStore {
        if (this.appStore.activeFrame && this.appStore.frames?.length > 0) {
            return this.fileId === ACTIVE_FILE_ID || !this.appStore.getFrame(this.fileId) ? this.appStore.activeFrame : this.appStore.getFrame(this.fileId);
        }
        return null;
    }

    @computed get isEffectiveFrameEqualToActiveFrame(): boolean {
        return this.effectiveFrame && this.appStore.activeFrame.frameInfo.fileId === this.effectiveFrame.frameInfo.fileId;
    }

    // @computed get effectiveRegionId(): number {
    //     if (this.effectiveFrame) {
    //         const regionId = this.regionIdMap.get(this.fileId);
    //         if (regionId !== RegionId.ACTIVE && regionId !== undefined) {
    //             return regionId;
    //         } else {
    //             const selectedRegion = this.effectiveFrame.regionSet.selectedRegion;
    //             if (selectedRegion) {
    //                 return this.type === RegionsType.CLOSED && !selectedRegion.isClosedRegion ? RegionId.IMAGE : selectedRegion.regionId;
    //             }
    //         }
    //     }
    //     return this.type === RegionsType.CLOSED ? RegionId.IMAGE : RegionId.CURSOR;
    // }

    @computed get effectiveRegionId(): number {
        if (this.effectiveFrame) {
            const regionId = this.regionIdMap.get(this.fileId);
            if (regionId !== RegionId.ACTIVE && regionId !== undefined) {
                return regionId;
            } else {
                const selectedRegion = this.effectiveFrame.regionSet.selectedRegion;
                if (selectedRegion) {
                    switch (this.type) {
                        case RegionsType.CLOSED:
                            return selectedRegion.isClosedRegion ? selectedRegion.regionId : this.defaultRegionId();
                        case RegionsType.CLOSED_AND_POINT:
                            return selectedRegion.regionId;
                        // return selectedRegion.isClosedRegion || selectedRegion.regionType === CARTA.RegionType.POINT ? selectedRegion.regionId : this.defaultRegionId();
                        case RegionsType.LINE:
                        default:
                            return selectedRegion.regionType === CARTA.RegionType.LINE ? selectedRegion.regionId : this.defaultRegionId();
                    }
                }
            }
        }

        return this.defaultRegionId();
    }

    private defaultRegionId(): number {
        switch (this.type) {
            case RegionsType.CLOSED:
                return RegionId.IMAGE;
            case RegionsType.CLOSED_AND_POINT:
                return RegionId.CURSOR;
            case RegionsType.LINE:
            default:
                return null;
        }
    }

    @computed get effectiveRegion(): RegionStore {
        return this.effectiveFrame?.getRegion(this.effectiveRegionId);
    }

    @computed get matchesSelectedRegion(): boolean {
        if (this.isEffectiveFrameEqualToActiveFrame) {
            if (this.appStore.selectedRegion) {
                return this.effectiveRegionId === this.appStore.selectedRegion.regionId;
            } else {
                if (this.effectiveRegionId === RegionId.CURSOR || this.effectiveRegionId === RegionId.IMAGE) {
                    return true;
                }
            }
        }
        return false;
    }

    @computed get frameOptions(): IOptionProps[] {
        return [{value: ACTIVE_FILE_ID, label: "Active"}, ...(AppStore.Instance.frameNames ?? [])];
    }

    public static CalculateRequirementsArray(widgetsMap: Map<string, RegionWidgetStore>) {
        const updatedRequirements = new Map<number, Array<number>>();

        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            if (!frame) {
                return;
            }
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;
            const region = frame.getRegion(regionId);
            if (regionId === -1 || region?.isClosedRegion) {
                let frameRequirementsArray = updatedRequirements.get(fileId);
                if (!frameRequirementsArray) {
                    frameRequirementsArray = [];
                    updatedRequirements.set(fileId, frameRequirementsArray);
                }
                if (!frameRequirementsArray.includes(regionId)) {
                    frameRequirementsArray.push(regionId);
                }
            }
        });
        return updatedRequirements;
    }
}

import {action, observable, makeObservable, computed} from "mobx";
import {IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType, RegionId} from "./RegionWidgetStore";

export enum PVAxis {
    SPATIAL = "Spatial",
    SPECTRAL = "Spectral"
}

export class PvGeneratorWidgetStore extends RegionWidgetStore {
    @observable width: number;
    @observable reverse: boolean;
    @observable overwrite: boolean;
    @observable range: CARTA.IIntBounds;

    @computed get regionOptions(): IOptionProps[] {
        const appStore = AppStore.Instance;
        let regionOptions: IOptionProps[] = [{value: RegionId.ACTIVE, label: "Active"}];
        if (appStore.frames) {
            const selectedFrame = appStore.getFrame(this.fileId);
            if (selectedFrame?.regionSet) {
                const validRegionOptions = selectedFrame.regionSet.regions
                    ?.filter(r => !r.isTemporary && r.regionType === CARTA.RegionType.LINE)
                    ?.map(region => {
                        return {value: region?.regionId, label: region?.nameString};
                    });
                if (validRegionOptions) {
                    regionOptions = regionOptions.concat(validRegionOptions);
                }
            }
        }
        return regionOptions;
    }

    @action requestPV = () => {
        const frame = this.effectiveFrame;
        if (frame && this.effectiveRegion) {
            const requestMessage: CARTA.IPvRequest = {
                fileId: frame.frameInfo.fileId,
                regionId: this.effectiveRegionId,
                width: this.width,
                spectralRange: this.range?.max && this.range?.min ? this.range : null,
                reverse: this.reverse,
                overwrite: this.overwrite

            };
            frame.resetPvRequestState();
            frame.setIsRequestingPV(true);
            AppStore.Instance.requestPV(requestMessage, frame);
        }
    };

    @action requestingPVCancelled = () => {
        const frame = this.effectiveFrame;
        if (frame) {
            AppStore.Instance.cancelRequestingPV(frame.frameInfo.fileId);
            frame.setIsRequestPVCancelling(true);
        }
    };

    @action setWidth = (val: number) => {
        this.width = val;
    };

    @action setReverse = (bool: boolean) => {
        this.reverse = bool;
    };

    @action setOverwrite = (bool: boolean) => {
        this.overwrite = bool;
    };

    @action setSpectralRange = (range: CARTA.IIntBounds) => {
        this.range = range;
    }

    constructor() {
        super(RegionsType.LINE);
        makeObservable(this);
        this.width = 3;
        this.reverse = false;
    }
}

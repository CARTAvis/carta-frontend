import {action, observable, makeObservable, computed} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {IOptionProps} from "@blueprintjs/core";
import {RegionWidgetStore, RegionsType, RegionId} from "./RegionWidgetStore";

export class PVGeneratorWidgetStore extends RegionWidgetStore {
    @observable width: number;

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
                width: this.width
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
        }
    };

    @action setWidth = (val: number) => {
        this.width = val;
    };

    constructor() {
        super(RegionsType.LINE);
        makeObservable(this);
        this.width = 3;
    }
}

import {action, observable, makeObservable, computed, reaction} from "mobx";
import {IOptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType, RegionId} from "../RegionWidgetStore/RegionWidgetStore";
import {SpectralSystem} from "models";

export enum PVAxis {
    SPATIAL = "Spatial",
    SPECTRAL = "Spectral"
}

export class PvGeneratorWidgetStore extends RegionWidgetStore {
    @observable width: number;
    @observable reverse: boolean;
    @observable keep: boolean;
    @observable range: CARTA.IIntBounds = {min: this.effectiveFrame?.channelValueBounds?.min, max: this.effectiveFrame?.channelValueBounds?.max};

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
        let channelIndexMin = frame.findChannelIndexByValue(this.range.min);
        let channelIndexMax = frame.findChannelIndexByValue(this.range.max);

        if (channelIndexMin > channelIndexMax) {
            const holder = channelIndexMax;
            channelIndexMax = channelIndexMin;
            channelIndexMin = holder;
        }
        if (channelIndexMin >= channelIndexMax) {
            if (channelIndexMax === 0) {
                channelIndexMax++;
            }
            channelIndexMin = channelIndexMax - 1;
        }
        if (frame && this.effectiveRegion) {
            const requestMessage: CARTA.IPvRequest = {
                fileId: frame.frameInfo.fileId,
                regionId: this.effectiveRegionId,
                width: this.width,
                spectralRange: isFinite(channelIndexMin) && isFinite(channelIndexMax) ? {min: channelIndexMin, max: channelIndexMax} : null,
                reverse: this.reverse,
                keep: this.keep
            };
            frame.resetPvRequestState();
            frame.setIsRequestingPV(true);
            AppStore.Instance.requestPV(requestMessage, frame, this.keep);
        }
    };

    @action requestingPVCancelled = () => {
        const frame = this.effectiveFrame;
        if (frame) {
            AppStore.Instance.cancelRequestingPV(frame.frameInfo.fileId);
            frame.setIsRequestPVCancelling(true);
        }
    };

    @action setSpectralCoordinate = (coordStr: string) => {
        if (this.effectiveFrame.setSpectralCoordinate(coordStr)) {
            return;
        }
    };

    @action setSpectralSystem = (specsys: SpectralSystem) => {
        if (this.effectiveFrame.setSpectralSystem(specsys)) {
            return;
        }
    };

    @action setWidth = (val: number) => {
        this.width = val;
    };

    @action setReverse = (bool: boolean) => {
        this.reverse = bool;
    };

    @action setKeep = (bool: boolean) => {
        this.keep = bool;
    };

    @action setSpectralRange = (range: CARTA.IIntBounds) => {
        if (isFinite(range.min) && isFinite(range.max)) {
            this.range = range;
        }
    };

    constructor() {
        super(RegionsType.LINE);
        makeObservable(this);
        this.width = 3;
        this.reverse = false;
        this.keep = false;
        reaction(
            () => this.effectiveFrame?.channelValueBounds,
            channelValueBounds => {
                if (channelValueBounds) {
                    this.setSpectralRange(channelValueBounds);
                }
            }
        );
    }
}

import {OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, reaction} from "mobx";

import {SpectralSystem} from "models";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";

import {ACTIVE_FILE_ID, RegionId, RegionsType, RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

export enum PVAxis {
    SPATIAL = "Spatial",
    SPECTRAL = "Spectral"
}

export class PvGeneratorWidgetStore extends RegionWidgetStore {
    @observable width: number;
    @observable reverse: boolean;
    @observable keep: boolean;
    @observable range: CARTA.IIntBounds = {min: this.effectiveFrame?.channelValueBounds?.min, max: this.effectiveFrame?.channelValueBounds?.max};
    @observable xyRebin: number = 1;
    @observable zRebin: number = 1;
    @observable previewRegionId: number;
    @observable previewFrame: FrameStore;

    @computed get regionOptions(): OptionProps[] {
        const appStore = AppStore.Instance;
        let regionOptions: OptionProps[] = [{value: RegionId.NONE, label: "None"}];
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

    //Can be refractored later
    @computed get previewRegionOptions(): OptionProps[] {
        const appStore = AppStore.Instance;
        let previewRegionOptions: OptionProps[] = [{value: RegionId.IMAGE, label: "Image"}];
        if (appStore.frames) {
            const selectedFrame = appStore.getFrame(this.fileId);
            if (selectedFrame?.regionSet) {
                const validRegionOptions = selectedFrame.regionSet.regions
                    ?.filter(r => !r.isTemporary && r.regionType === CARTA.RegionType.RECTANGLE)
                    ?.map(region => {
                        return {value: region?.regionId, label: region?.nameString};
                    });
                if (validRegionOptions) {
                    previewRegionOptions = previewRegionOptions.concat(validRegionOptions);
                }
            }
        }
        return previewRegionOptions;
    }

    @computed get effectivePreviewRegionId(): number {
        if (this.effectiveFrame) {
            const regionId = this.previewRegionId;
            if (regionId !== RegionId.IMAGE && regionId !== undefined) {
                return regionId;
            }
        }
        return RegionId.IMAGE;
    }

    @action requestPV = (preview: boolean = false, pvGeneratorId?: string) => {
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
                keep: this.keep,
                previewSettings: preview ? {previewId: parseInt(pvGeneratorId.split("-")[2]), regionId: this.effectivePreviewRegionId, rebinXy: this.xyRebin, rebinZ: this.zRebin} : undefined
            };
            if (preview) {
                AppStore.Instance.requestPreviewPV(requestMessage, frame, pvGeneratorId);
            } else {
                AppStore.Instance.requestPV(requestMessage, frame, this.keep);
            }
            frame.resetPvRequestState();
            frame.setIsRequestingPV(true);
        }
    };

    @action requestingPVCancelled = (pvGeneratorId: string) => {
        return () => {
            const frame = this.effectiveFrame;
            if (frame) {
                AppStore.Instance.cancelRequestingPV(frame.frameInfo.fileId, parseInt(pvGeneratorId.split("-")[2]));
                frame.setIsRequestPVCancelling(true);
            }
        };
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

    @action setXYRebin = (val: number) => {
        this.xyRebin = val;
    };

    @action setZRebin = (val: number) => {
        this.zRebin = val;
    };

    @action setPreviewRegionId = (regionId: number) => {
        this.previewRegionId = regionId;
    };

    @action setPreviewFrame = (frame: FrameStore) => {
        this.previewFrame = frame;
    };

    @action removePreviewFrame = (id: number) => {
        AppStore.Instance.removePreviewFrame(id);
        this.previewFrame = null;
    };

    constructor() {
        super(RegionsType.LINE);
        makeObservable(this);
        this.width = 3;
        this.reverse = false;
        this.keep = false;
        this.regionIdMap.set(ACTIVE_FILE_ID, RegionId.NONE);
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

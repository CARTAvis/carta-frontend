import {OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";

import { PlotType} from "components/Shared";
import {AppStore} from "stores";

import {ACTIVE_FILE_ID, RegionId, RegionsType, RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

export class Render3DWidgetStore extends RegionWidgetStore {

    @observable coordinate: string;
    @observable minX: number | undefined;
    @observable maxX: number | undefined;
    @observable minY: number | undefined;
    @observable maxY: number | undefined;

    // settings
    @observable logScaleY: boolean;
    @observable plotType: PlotType;
    @observable primaryLineColor: string;
    @observable lineWidth: number;
    @observable linePlotPointSize: number;

    @computed get regionOptions(): OptionProps[] {
        const appStore = AppStore.Instance;
        let regionOptions: OptionProps[] = [{value: RegionId.NONE, label: "None"}];
        if (appStore.frames) {
            const selectedFrame = appStore.getFrame(this.fileId);
            if (selectedFrame?.regionSet) {
                const validRegionOptions = selectedFrame.regionSet.regions
                    ?.filter(r => !r.isTemporary && r.regionType === CARTA.RegionType.RECTANGLE)
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

    @action setXBounds = (minVal: number, maxVal: number) => {
        this.minX = minVal;
        this.maxX = maxVal;
    };

    @action clearXBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
    };

    @action setYBounds = (minVal: number, maxVal: number) => {
        this.minY = minVal;
        this.maxY = maxVal;
    };

    @action clearYBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
    };

    @action setXYBounds = (minX: number, maxX: number, minY: number, maxY: number) => {
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
    };

    @action clearXYBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
        this.minY = undefined;
        this.maxY = undefined;
    };

    @computed get isAutoScaledX() {
        return this.minX === undefined || this.maxX === undefined;
    }

    @computed get isAutoScaledY() {
        return this.minY === undefined || this.maxY === undefined;
    }

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
        this.regionIdMap.set(ACTIVE_FILE_ID, RegionId.NONE);
    }
}

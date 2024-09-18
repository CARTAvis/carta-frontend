import {OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, reaction} from "mobx";

import {LineSettings, PlotType} from "components/Shared";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";

import {RegionId, RegionsType, RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

export class Render3DWidgetStore extends RegionWidgetStore {

    @observable markerTextVisible: boolean;
    @observable meanRmsVisible: boolean;
    @observable linePlotInitXYBoundaries: {minXVal: number; maxXVal: number; minYVal: number; maxYVal: number};
    // secondary settings
    @observable minX: number | undefined;
    @observable maxX: number | undefined;
    @observable minY: number | undefined;
    @observable maxY: number | undefined;
    @observable cursorX: number;

    // settings
    @observable logScaleY: boolean;
    @observable plotType: PlotType;
    @observable primaryLineColor: string;
    @observable lineWidth: number;
    @observable linePlotPointSize: number;

    // Generate Levels
    @observable range: CARTA.IIntBounds = {min: this.effectiveFrame?.channelValueBounds?.min, max: this.effectiveFrame?.channelValueBounds?.max};
    @observable keep: boolean;

    @observable render3DFrame: FrameStore | null;

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

    @action setLogScale = (logScale: boolean) => {
        this.logScaleY = logScale;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    @action requestRender3D = (render3DGeneratorId?: string) => {
        console.log("Requesting Render3D");
        const frame = this.effectiveFrame;
        if (!frame) {
            return;
        }
        console.log(this.effectiveRegion);
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
            console.log("Requesting Render3D with region ID: " + this.effectiveRegionId);
            const requestMessage: CARTA.IRender3DRequest = {
                fileId: frame.frameInfo.fileId,
                regionId: this.effectiveRegionId,
                imageBounds: {
                    xMin: 0,
                    xMax: frame.frameInfo.fileInfoExtended.width,
                    yMin: 0,
                    yMax: frame.frameInfo.fileInfoExtended.height
                },
                spectralRange: isFinite(channelIndexMin) && isFinite(channelIndexMax) ? {min: channelIndexMin, max: channelIndexMax} : null,
                keep: this.keep,
            }
            console.log(render3DGeneratorId);
            if (render3DGeneratorId) {
                console.log("Requesting Render3D with generator ID: " + render3DGeneratorId);
                AppStore.Instance.requestRender3D(requestMessage, frame, render3DGeneratorId);
            }
        }
    };

    @action setSpectralRange = (range: CARTA.IIntBounds) => {
        if (isFinite(range.min ?? NaN) && isFinite(range.max ?? NaN)) {
            this.range = range;
        }
    };

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
        // this.regionIdMap.set(ACTIVE_FILE_ID, RegionId.ACTIVE);
        this.logScaleY = true;
        this.plotType = PlotType.STEPS;
        this.markerTextVisible = true;
        this.meanRmsVisible = true;
        this.primaryLineColor = "auto-blue";
        this.linePlotPointSize = 1.5;
        this.lineWidth = 1;
        this.linePlotInitXYBoundaries = {minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0};
        // request render3d
        this.keep = false;
        reaction(
            () => this.effectiveFrame?.channelValueBounds,
            channelValueBounds => {
                if (channelValueBounds) {
                    this.setSpectralRange(channelValueBounds);
                }
            }
        );
    } // endconstructor

    // settings
    @action setPrimaryLineColor = (color: string) => {
        this.primaryLineColor = color;
    };

    @action setLineWidth = (val: number) => {
        if (val >= LineSettings.MIN_WIDTH && val <= LineSettings.MAX_WIDTH) {
            this.lineWidth = val;
        }
    };

    @action setLinePlotPointSize = (val: number) => {
        if (val >= LineSettings.MIN_POINT_SIZE && val <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = val;
        }
    };

    @action initXYBoundaries(minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = {minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal};
    }

    @action setRender3DFrame = (frame: FrameStore) => {
        this.render3DFrame = frame;
    };

    @action removeRender3DFrame = (id: number) => {
        AppStore.Instance.removeRender3DFrame(id);
        this.render3DFrame = null;
    };

    public toConfig = () => {
        return {
            primaryLineColor: this.primaryLineColor,
            lineWidth: this.lineWidth,
            linePlotPointSize: this.linePlotPointSize,
            logScaleY: this.logScaleY,
            markerTextVisible: this.markerTextVisible,
            meanRmsVisible: this.meanRmsVisible,
            plotType: this.plotType,
            minXVal: this.linePlotInitXYBoundaries.minXVal,
            maxXVal: this.linePlotInitXYBoundaries.maxXVal,
            minYVal: this.linePlotInitXYBoundaries.minYVal,
            maxYVal: this.linePlotInitXYBoundaries.maxYVal
        }
    };

}

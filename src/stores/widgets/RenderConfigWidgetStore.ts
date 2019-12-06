import {action, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {PlotType, LineSettings} from "components/Shared";

export class RenderConfigWidgetStore {
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;

    // settings 
    @observable plotType: PlotType;
    @observable primaryLineColor: { colorHex: string, fixed: boolean };
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
    @observable logScaleY: boolean;
    @observable markerTextVisible: boolean;
    @observable meanRmsVisible: boolean;
    @observable linePlotInitXYBoundaries: { minXVal: number, maxXVal: number, minYVal: number, maxYVal: number };

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

    @action setMarkerTextVisible = (val: boolean) => {
        this.markerTextVisible = val;
    };

    @action setMeanRmsVisible = (val: boolean) => {
        this.meanRmsVisible = val;
    };

    @action setLogScale = (logScale: boolean) => {
        this.logScaleY = logScale;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    constructor() {
        this.logScaleY = true;
        this.plotType = PlotType.STEPS;
        this.markerTextVisible = true;
        this.meanRmsVisible = true;
        this.primaryLineColor = { colorHex: Colors.BLUE2, fixed: false };
        this.linePlotPointSize = 1.5;
        this.lineWidth = 1;
        this.linePlotInitXYBoundaries = { minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0 };
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }

    // settings
    @action setPrimaryLineColor = (colorHex: string, fixed: boolean) => {
        this.primaryLineColor = { colorHex: colorHex, fixed: fixed };
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

    @action initXYBoundaries (minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = { minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal };
    }
}
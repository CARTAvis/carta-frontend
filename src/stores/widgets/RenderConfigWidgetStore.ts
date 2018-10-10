import {action, computed, observable} from "mobx";

export class RenderConfigWidgetStore {
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable logScaleY: boolean;
    @observable usePoints: boolean;
    @observable interpolateLines: boolean;
    @observable settingsPanelVisible: boolean;
    @observable markerTextVisible: boolean;

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

    @action showSettingsPanel = () => {
        this.settingsPanelVisible = true;
    };

    @action hideSettingsPanel = () => {
        this.settingsPanelVisible = false;
    };

    @action setMarkerTextVisible = (val: boolean) => {
        this.markerTextVisible = val;
    };

    @action setLogScale = (logScale: boolean) => {
        this.logScaleY = logScale;
    };

    @action setUsePoints = (val: boolean) => {
        this.usePoints = val;
    };

    @action setInterpolateLines = (val: boolean) => {
        this.interpolateLines = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    constructor() {
        this.minX = undefined;
        this.maxX = undefined;
        this.cursorX = undefined;
        this.logScaleY = true;
        this.usePoints = false;
        this.interpolateLines = false;
        this.settingsPanelVisible = false;
        this.markerTextVisible = true;
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }
}
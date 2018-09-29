import {action, computed, observable} from "mobx";

export class RenderConfigWidgetStore {
    @observable minX: number;
    @observable maxX: number;
    @observable cursorX: number;
    @observable logScaleY: boolean;
    @observable usePoints: boolean;
    @observable settingsPanelVisible: boolean;
    @observable markerTextVisible: boolean;

    @action setBounds = (minVal: number, maxVal: number) => {
        this.minX = minVal;
        this.maxX = maxVal;
    };

    @action clearBounds = () => {
        this.minX = undefined;
        this.maxX = undefined;
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

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    constructor() {
        this.minX = undefined;
        this.maxX = undefined;
        this.cursorX = undefined;
        this.logScaleY = true;
        this.usePoints = false;
        this.settingsPanelVisible = false;
        this.markerTextVisible = true;
    }

    @computed get isAutoScaled() {
        return (this.minX === undefined || this.maxX === undefined);
    }
}
import {action, computed, observable} from "mobx";

export class SpatialProfileWidgetStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable coordinate: string;
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable usePoints: boolean;
    @observable interpolateLines: boolean;
    @observable settingsPanelVisible: boolean;
    @observable meanRmsVisible: boolean;
    @observable markerTextVisible: boolean;

    @computed get validCoordinates() {
        const validCoordinates = [];
        for (let coordinate of ["x", "y"]) {
            for (let stokes of ["", "I", "Q", "U", "V"]) {
                validCoordinates.push(`${stokes}${coordinate}`);
            }
        }
        return validCoordinates;
    }

    @action setFileId = (fileId: number) => {
        // Reset zoom when changing between files
        this.clearXYBounds();
        this.fileId = fileId;
    };

    @action setRegionId = (regionId: number) => {
        // Reset zoom when changing between regions
        this.clearXYBounds();
        this.regionId = regionId;
    };

    @action setCoordinate = (coordinate: string) => {
        // Check coordinate validity
        if (this.validCoordinates.indexOf(coordinate) !== -1) {
            // Reset zoom when changing between coordinates
            this.clearXYBounds();
            this.coordinate = coordinate;
        }
    };

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

    @action setMeanRmsVisible = (val: boolean) => {
        this.meanRmsVisible = val;
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

    constructor(coordinate: string = "x", fileId: number = -1, regionId: number = -1) {
        // Describes which data is being visualised
        this.coordinate = coordinate;
        this.fileId = fileId;
        this.regionId = regionId;

        // Describes how the data is visualised
        this.usePoints = false;
        this.interpolateLines = false;
        this.settingsPanelVisible = false;
        this.meanRmsVisible = false;
        this.markerTextVisible = false;
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }
}
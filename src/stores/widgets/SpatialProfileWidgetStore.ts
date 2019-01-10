import {action, computed, observable} from "mobx";
import {PlotType} from "components/Shared";

export class SpatialProfileWidgetStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable coordinate: string;
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable plotType: PlotType;
    @observable settingsPanelVisible: boolean;
    @observable meanRmsVisible: boolean;
    @observable wcsAxisVisible: boolean;
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

    @action setWcsAxisVisible = (val: boolean) => {
        this.wcsAxisVisible = val;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    constructor(coordinate: string = "x", fileId: number = -1, regionId: number = 0) {
        // Describes which data is being visualised
        this.coordinate = coordinate;
        this.fileId = fileId;
        this.regionId = regionId;

        // Describes how the data is visualised
        this.plotType = PlotType.STEPS;
        this.settingsPanelVisible = false;
        this.meanRmsVisible = false;
        this.markerTextVisible = false;
        this.wcsAxisVisible = true;
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }
}
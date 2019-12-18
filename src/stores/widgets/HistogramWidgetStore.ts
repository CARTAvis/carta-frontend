import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {Colors} from "@blueprintjs/core";
import {PlotType, LineSettings} from "components/Shared";
import {RegionWidgetStore} from "./RegionWidgetStore";

export class HistogramWidgetStore extends RegionWidgetStore {
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;

    // settings 
    @observable logScaleY: boolean;
    @observable plotType: PlotType;
    @observable primaryLineColor: { colorHex: string, fixed: boolean };
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
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

    @action setLogScale = (logScale: boolean) => {
        this.logScaleY = logScale;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }

    public static DiffRequirementsArray(originalRequirements: Map<number, Array<number>>, updatedRequirements: Map<number, Array<number>>) {
        const diffList: CARTA.ISetHistogramRequirements[] = [];

        // Three possible scenarios:
        // 1. Existing array, no new array => diff should be empty stats requirements for each element of existing array
        // 2. No existing array, new array => diff should be full stats requirements for each element of new array
        // 3. Existing array and new array => diff should be empty stats for those missing in new array, full stats for those missing in old array

        // (1) & (3) handled first
        originalRequirements.forEach((statsArray, fileId) => {
            const updatedStatsArray = updatedRequirements.get(fileId);
            // If there's no new array, remove requirements for all existing regions
            if (!updatedStatsArray) {
                for (const regionId of statsArray) {
                    diffList.push({fileId, regionId, histograms: []});
                }
            } else {
                // If regions in the new array are missing, remove requirements for those regions
                for (const regionId of statsArray) {
                    if (updatedStatsArray.indexOf(regionId) === -1) {
                        diffList.push({fileId, regionId, histograms: []});
                    }
                }
                // If regions in the existing array are missing, add requirements for those regions
                for (const regionId of updatedStatsArray) {
                    if (statsArray.indexOf(regionId) === -1) {
                        diffList.push({fileId, regionId, histograms: [{channel: -1, numBins: -1}]});
                    }
                }
            }
        });

        updatedRequirements.forEach((updatedStatsArray, fileId) => {
            const statsArray = originalRequirements.get(fileId);
            // If there's no existing array, add requirements for all new regions
            if (!statsArray) {
                for (const regionId of updatedStatsArray) {
                    diffList.push({fileId, regionId, histograms: [{channel: -1, numBins: -1}]});
                }
            }
        });

        return diffList;
    }

    constructor() {
        super();
        this.logScaleY = true;
        this.plotType = PlotType.STEPS;
        this.primaryLineColor = { colorHex: Colors.BLUE2, fixed: false };
        this.linePlotPointSize = 1.5;
        this.lineWidth = 1;
        this.linePlotInitXYBoundaries = { minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0 };
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

    @action setMeanRmsVisible = (val: boolean) => {
        this.meanRmsVisible = val;
    };

    @action initXYBoundaries (minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = { minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal };
    }
}
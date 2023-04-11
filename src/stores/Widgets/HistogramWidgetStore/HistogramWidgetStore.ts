import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable} from "mobx";
import tinycolor from "tinycolor2";

import {HistogramSettingsTabs} from "components";
import {LineSettings, PlotType} from "components/Shared";
import {POLARIZATIONS, VALID_COORDINATES} from "models";
import {isAutoColor} from "utilities";

import {RegionsType, RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

export class HistogramWidgetStore extends RegionWidgetStore {
    @observable settingsTabId: HistogramSettingsTabs;

    @observable coordinate: string;
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable isMouseMoveIntoLinePlots: boolean;

    // settings
    @observable logScaleY: boolean;
    @observable plotType: PlotType;
    @observable primaryLineColor: string;
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
    @observable meanRmsVisible: boolean;
    @observable linePlotInitXYBoundaries: {minXVal: number; maxXVal: number; minYVal: number; maxYVal: number};

    // Current config settings
    @observable curAutoBounds: boolean;
    @observable curMinPix: number;
    @observable curMaxPix: number;
    @observable curAutoBins: boolean;
    @observable curNumBins: number;

    // Maximum number of histogram bins on the slider
    @observable maxNumBins: number;

    // Config settings in the protobuf message
    public fixedNumBins: boolean;
    public numBins: number;
    public binWidth: number;
    public fixedBounds: boolean;
    public minPix: number;
    public maxPix: number;

    // Cached histogram config settings
    private cachedMinPix: number;
    private cachedMaxPix: number;
    private cachedNumBins: number;

    @action setCoordinate = (coordinate: string) => {
        // Check coordinate validity
        if (VALID_COORDINATES.indexOf(coordinate) !== -1) {
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

    @action setLogScale = (logScale: boolean) => {
        this.logScaleY = logScale;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    @action setMouseMoveIntoLinePlots = (val: boolean) => {
        this.isMouseMoveIntoLinePlots = val;
    };

    @action setSettingsTabId = (tabId: HistogramSettingsTabs) => {
        this.settingsTabId = tabId;
    };

    @action setAutoBounds = (autoBounds: boolean) => {
        this.curAutoBounds = autoBounds;
    };

    @action setMinPix = (minPix: number) => {
        this.curMinPix = minPix;
    };

    @action setMaxPix = (maxPix: number) => {
        this.curMaxPix = maxPix;
    };

    @action setAutoBins = (autoBins: boolean) => {
        this.curAutoBins = autoBins;
    };

    @action setNumBins = (numBins: number) => {
        this.curNumBins = numBins;
    };

    @action setMaxNumBins = (maxNumBins: number) => {
        this.maxNumBins = maxNumBins;
    };

    @computed get isAutoScaledX() {
        return this.minX === undefined || this.maxX === undefined;
    }

    @computed get isAutoScaledY() {
        return this.minY === undefined || this.maxY === undefined;
    }

    @computed get effectivePolarization(): POLARIZATIONS {
        if (this.coordinate === "z") {
            return this.effectiveFrame?.requiredPolarization;
        } else {
            return POLARIZATIONS[this.coordinate.substring(0, this.coordinate.length - 1)];
        }
    }

    @action onResetConfig = () => {
        this.curAutoBounds = false;
        this.resetBounds();
        this.curAutoBins = false;
        this.resetNumBins();
    };

    resetBounds = () => {
        if (this.cachedMinPix === undefined) {
            this.curMinPix = this.effectiveFrame.renderConfig.histogramMin;
        } else {
            this.curMinPix = this.cachedMinPix;
        }

        if (this.cachedMaxPix === undefined) {
            this.curMaxPix = this.effectiveFrame.renderConfig.histogramMax;
        } else {
            this.curMaxPix = this.cachedMaxPix;
        }
    };

    resetNumBins = () => {
        if (this.cachedNumBins === undefined) {
            this.curNumBins = this.effectiveFrame.renderConfig.histogram.numBins;
        } else {
            this.curNumBins = this.cachedNumBins;
        }
    };

    updateConfigs = () => {
        if (this.curAutoBounds) {
            this.fixedBounds = false;
            this.minPix = 0;
            this.maxPix = 0;
        } else {
            this.fixedBounds = true;
            this.minPix = this.curMinPix;
            this.maxPix = this.curMaxPix;
        }

        if (this.curAutoBins) {
            this.fixedNumBins = false;
            this.numBins = -1;
        } else {
            this.fixedNumBins = true;
            this.numBins = this.curNumBins;
        }

        this.binWidth = 0;
    };

    @computed get isAutoBounds(): boolean {
        return this.curAutoBounds;
    }

    @computed get isAutoBins(): boolean {
        return this.curAutoBins;
    }

    @computed get isAbleToGenerate(): boolean {
        if (!this.curAutoBounds && this.curMinPix >= this.curMaxPix) {
            return false;
        }
        return !(!this.curAutoBins && this.curNumBins <= 0);
    }

    private static areEqual(num1: number, num2: number) {
        return Math.abs(num1 - num2) < 1e-6;
    }

    public static CalculateRequirementsMap(widgetsMap: Map<string, HistogramWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetHistogramRequirements>>();

        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            if (!frame || !frame.regionSet) {
                return;
            }
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;
            const coordinate = widgetStore.coordinate;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (regionId === -1 || (region && region.isClosedRegion)) {
                let frameRequirements = updatedRequirements.get(fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetHistogramRequirements>();
                    updatedRequirements.set(fileId, frameRequirements);
                }

                let regionRequirements = frameRequirements.get(regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetHistogramRequirements({fileId, regionId});
                    frameRequirements.set(regionId, regionRequirements);
                }

                if (!regionRequirements.histograms) {
                    regionRequirements.histograms = [];
                }

                const fixedNumBins = widgetStore.fixedNumBins;
                const numBins = widgetStore.numBins;
                const binWidth = widgetStore.binWidth;
                const fixedBounds = widgetStore.fixedBounds;
                const minPix = widgetStore.minPix;
                const maxPix = widgetStore.maxPix;

                let histogramConfig = regionRequirements.histograms.find(
                    config =>
                        config.coordinate === coordinate &&
                        config.fixedNumBins === fixedNumBins &&
                        config.numBins === numBins &&
                        this.areEqual(config.binWidth, binWidth) &&
                        config.fixedBounds === fixedBounds &&
                        this.areEqual(config.bounds.min, minPix) &&
                        this.areEqual(config.bounds.max, maxPix)
                );

                if (!histogramConfig) {
                    regionRequirements.histograms.push({
                        coordinate: coordinate,
                        channel: -1,
                        fixedNumBins: fixedNumBins,
                        numBins: numBins,
                        binWidth: binWidth,
                        fixedBounds: fixedBounds,
                        bounds: {min: minPix, max: maxPix}
                    });
                }
            }
        });
        return updatedRequirements;
    }

    // This function diffs the updated requirements map with the existing requirements map, and reacts to changes
    // Three diff cases are checked:
    // 1. The old map has an entry, but the new one does not => send an "empty" SetHistogramRequirements message
    // 2. The old and new maps both have entries, but they are different => send the new SetHistogramRequirements message
    // 3. The new map has an entry, but the old one does not => send the new SetHistogramRequirements message
    // The easiest way to check all three is to first add any missing entries to the new map (as empty requirements), and then check the updated maps entries
    public static DiffHistoRequirements(originalRequirements: Map<number, Map<number, CARTA.SetHistogramRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetHistogramRequirements>>) {
        const diffList: CARTA.SetHistogramRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetHistogramRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetHistogramRequirements({fileId, regionId, histograms: []});
                    updatedFrameRequirements.set(regionId, updatedRegionRequirements);
                }
            });
        });

        // Go through updated requirements entries and find differences
        updatedRequirements.forEach((updatedFrameRequirements, fileId) => {
            let frameRequirements = originalRequirements.get(fileId);
            if (!frameRequirements) {
                // If there are no existing requirements for this fileId, all entries for this file are new
                updatedFrameRequirements.forEach(regionRequirements => diffList.push(regionRequirements));
            } else {
                updatedFrameRequirements.forEach((updatedRegionRequirements, regionId) => {
                    let regionRequirements = frameRequirements.get(regionId);
                    if (!regionRequirements) {
                        // If there are no existing requirements for this regionId, this is a new entry
                        diffList.push(updatedRegionRequirements);
                    } else {
                        // Deep equality comparison with sorted arrays
                        const configCount = regionRequirements.histograms ? regionRequirements.histograms.length : 0;
                        const updatedConfigCount = updatedRegionRequirements.histograms ? updatedRegionRequirements.histograms.length : 0;

                        if (configCount !== updatedConfigCount) {
                            diffList.push(updatedRegionRequirements);
                            return;
                        }

                        if (configCount === 0) {
                            return;
                        }
                        const sortedUpdatedConfigs = updatedRegionRequirements.histograms;
                        const sortedConfigs = regionRequirements.histograms;

                        for (let i = 0; i < updatedConfigCount; i++) {
                            const updatedConfig = sortedUpdatedConfigs[i];
                            const config = sortedConfigs[i];
                            if (
                                updatedConfig.coordinate !== config.coordinate ||
                                updatedConfig.channel !== config.channel ||
                                updatedConfig.fixedNumBins !== config.fixedNumBins ||
                                updatedConfig.numBins !== config.numBins ||
                                !this.areEqual(updatedConfig.binWidth, config.binWidth) ||
                                updatedConfig.fixedBounds !== config.fixedBounds ||
                                !this.areEqual(updatedConfig.bounds.min, config.bounds.min) ||
                                !this.areEqual(updatedConfig.bounds.max, config.bounds.max)
                            ) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }
                        }
                    }
                });
            }
        });
        // Sort list so that requirements clearing occurs first
        return diffList.sort((a, b) => (a.histograms.length > b.histograms.length ? 1 : -1));
    }

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
        this.logScaleY = true;
        this.plotType = PlotType.STEPS;
        this.primaryLineColor = "auto-blue";
        this.linePlotPointSize = 1.5;
        this.lineWidth = 1;
        this.linePlotInitXYBoundaries = {minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0};
        this.coordinate = "z";

        // Initialize current config values
        this.curAutoBounds = true;
        this.resetBounds();
        this.curAutoBins = true;
        this.resetNumBins();

        // Initialize config settings in the protobuf message
        this.fixedNumBins = false;
        this.numBins = -1;
        this.binWidth = 0;
        this.fixedBounds = false;
        this.minPix = 0;
        this.maxPix = 0;

        // Initialize the maximum number of histogram bins on the slider
        this.maxNumBins = this.effectiveFrame.renderConfig.histogram.numBins;
    }

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

    @action setMeanRmsVisible = (val: boolean) => {
        this.meanRmsVisible = val;
    };

    @action initXYBoundaries(minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = {minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal};
    }

    public cacheBounds = (minPix: number, maxPix: number): void => {
        this.cachedMinPix = minPix;
        this.cachedMaxPix = maxPix;
    };

    public cacheNumBins = (numBins: number): void => {
        this.cachedNumBins = numBins;
    };

    public init = (widgetSettings): void => {
        if (!widgetSettings) {
            return;
        }
        const lineColor = tinycolor(widgetSettings.primaryLineColor);
        if (lineColor.isValid() || isAutoColor(widgetSettings.primaryLineColor)) {
            this.primaryLineColor = widgetSettings.primaryLineColor;
        }
        if (typeof widgetSettings.lineWidth === "number" && widgetSettings.lineWidth >= LineSettings.MIN_WIDTH && widgetSettings.lineWidth <= LineSettings.MAX_WIDTH) {
            this.lineWidth = widgetSettings.lineWidth;
        }
        if (typeof widgetSettings.linePlotPointSize === "number" && widgetSettings.linePlotPointSize >= LineSettings.MIN_POINT_SIZE && widgetSettings.linePlotPointSize <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = widgetSettings.linePlotPointSize;
        }
        if (typeof widgetSettings.logScaleY === "boolean") {
            this.logScaleY = widgetSettings.logScaleY;
        }
        if (typeof widgetSettings.plotType === "string" && (widgetSettings.plotType === PlotType.STEPS || widgetSettings.plotType === PlotType.LINES || widgetSettings.plotType === PlotType.POINTS)) {
            this.plotType = widgetSettings.plotType;
        }
        if (typeof widgetSettings.minXVal === "number") {
            this.linePlotInitXYBoundaries.minXVal = widgetSettings.minXVal;
        }
        if (typeof widgetSettings.maxXVal === "number") {
            this.linePlotInitXYBoundaries.maxXVal = widgetSettings.maxXVal;
        }
        if (typeof widgetSettings.minYVal === "number") {
            this.linePlotInitXYBoundaries.minYVal = widgetSettings.minYVal;
        }
        if (typeof widgetSettings.maxYVal === "number") {
            this.linePlotInitXYBoundaries.maxYVal = widgetSettings.maxYVal;
        }
    };

    public toConfig = () => {
        return {
            primaryLineColor: this.primaryLineColor,
            lineWidth: this.lineWidth,
            linePlotPointSize: this.linePlotPointSize,
            logScaleY: this.logScaleY,
            plotType: this.plotType,
            minXVal: this.linePlotInitXYBoundaries.minXVal,
            maxXVal: this.linePlotInitXYBoundaries.maxXVal,
            minYVal: this.linePlotInitXYBoundaries.minYVal,
            maxYVal: this.linePlotInitXYBoundaries.maxYVal
        };
    };
}

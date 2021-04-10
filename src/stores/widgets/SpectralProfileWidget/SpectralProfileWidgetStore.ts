import {action, autorun, computed, observable, makeObservable, override} from "mobx";
import {NumberRange} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {PlotType, LineSettings} from "components/Shared";
import {RegionWidgetStore, RegionsType, ACTIVE_FILE_ID, SpectralLine, SpectralProfileSelectionStore} from "stores/widgets";
import {AppStore, ProfileSmoothingStore} from "stores";
import {LineKey, SpectralSystem} from "models";
import tinycolor from "tinycolor2";
import {SpectralProfilerSettingsTabs} from "components";
import {isAutoColor} from "utilities";

export enum MomentSelectingMode {
    NONE = 1,
    CHANNEL,
    MASK
}

export class SpectralProfileWidgetStore extends RegionWidgetStore {
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable channel: number;
    @observable markerTextVisible: boolean;
    @observable isMouseMoveIntoLinePlots: boolean;
    @observable isStreamingData: boolean;
    @observable isHighlighted: boolean;
    @observable private spectralLinesMHz: SpectralLine[];

    // style settings
    @observable plotType: PlotType;
    @observable meanRmsVisible: boolean;
    @observable primaryLineColor: string;
    @observable lineColorMap: Map<LineKey, string>;
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
    @observable linePlotInitXYBoundaries: { minXVal: number, maxXVal: number, minYVal: number, maxYVal: number };
    @observable settingsTabId: SpectralProfilerSettingsTabs;

    // line key will be "Primary" in single line mode
    public static readonly PRIMARY_LINE_KEY = "Primary";

    // moment settings
    @observable selectingMode: MomentSelectingMode;
    @observable channelValueRange: NumberRange;
    @observable momentMask: CARTA.MomentMask;
    @observable maskRange: NumberRange;
    @observable selectedMoments: CARTA.Moment[];

    readonly smoothingStore: ProfileSmoothingStore;
    readonly profileSelectionStore: SpectralProfileSelectionStore;

    @override setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
        this.clearXYBounds();
    };

    @action setSpectralCoordinate = (coordStr: string) => {
        if (this.effectiveFrame.setSpectralCoordinate(coordStr)) {
            this.clearXBounds();
        }
    };

    @action setSpectralSystem = (specsys: SpectralSystem) => {
        if (this.effectiveFrame.setSpectralSystem(specsys)) {
            this.clearXBounds();
        }
    };

    @action setMomentRangeSelectingMode = (mode: MomentSelectingMode) => {
        if (mode) {
            this.selectingMode = mode;
        }
    };

    @action clearMomentRangeSelectingMode = () => {
        this.selectingMode = MomentSelectingMode.NONE;
    };

    @action setSelectedChannelRange = (min: number, max: number) => {
        if (isFinite(min) && isFinite(max)) {
            this.channelValueRange[0] = min;
            this.channelValueRange[1] = max;
        }
        this.selectingMode = MomentSelectingMode.NONE;
    };

    @action setSelectedMaskRange = (min: number, max: number) => {
        if (isFinite(min) && isFinite(max)) {
            this.maskRange[0] = min;
            this.maskRange[1] = max;
        }
        this.selectingMode = MomentSelectingMode.NONE;
    };

    @action private updateRanges = () => {
        const frame = this.effectiveFrame;
        if (frame && frame.channelValueBounds) {
            this.channelValueRange[0] = frame.channelValueBounds.min;
            this.channelValueRange[1] = frame.channelValueBounds.max;
            this.maskRange[0] = 0;
            this.maskRange[1] = 1;
        }
    };

    @action setMomentMask = (momentMask: CARTA.MomentMask) => {
            this.momentMask = momentMask;
    };

    @action selectMoment = (selected: CARTA.Moment) => {
        if (!this.selectedMoments.includes(selected)) {
            this.selectedMoments.push(selected);
        }
    };

    @action deselectMoment = (deselected: CARTA.Moment) => {
        if (this.selectedMoments.includes(deselected)) {
            this.selectedMoments = this.selectedMoments.filter((momentType) => momentType !== deselected);
        }
    };

    @action removeMomentByIndex = (removeIndex: number) => {
        if (removeIndex >= 0 && removeIndex < this.selectedMoments.length) {
            this.selectedMoments = this.selectedMoments.filter((momentType, index) => index !== removeIndex);
        }
    };

    @action clearSelectedMoments = () => {
        this.selectedMoments = [];
    };

    @action isMomentSelected = (momentType: CARTA.Moment): boolean => {
        return this.selectedMoments.includes(momentType);
    };

    @action requestMoment = () => {
        const frame = this.effectiveFrame;
        const channelIndex1 = frame.findChannelIndexByValue(this.channelValueRange[0]);
        const channelIndex2 = frame.findChannelIndexByValue(this.channelValueRange[1]);
        if (frame && isFinite(channelIndex1) && isFinite(channelIndex2)) {
            const channelIndexRange: CARTA.IIntBounds = {
                min: channelIndex1 <= channelIndex2 ? channelIndex1 : channelIndex2,
                max: channelIndex1 <= channelIndex2 ? channelIndex2 : channelIndex1
            };
            const requestMessage: CARTA.IMomentRequest = {
                fileId: frame.frameInfo.fileId,
                moments: this.selectedMoments,
                axis: CARTA.MomentAxis.SPECTRAL,
                regionId: (this.fileId === ACTIVE_FILE_ID && this.effectiveRegionId === 0) ? -1 : this.effectiveRegionId, // request image when region dropdown is active with no region selected
                spectralRange: channelIndexRange,
                mask: this.momentMask,
                pixelRange: new CARTA.FloatBounds({min: this.maskRange[0], max: this.maskRange[1]})
            };
            frame.resetMomentRequestState();
            frame.setIsRequestingMoments(true);
            AppStore.Instance.requestMoment(requestMessage, frame);
        }
    };

    @action requestingMomentCancelled = () => {
        const frame = this.effectiveFrame;
        if (frame) {
            AppStore.Instance.cancelRequestingMoment(frame.frameInfo.fileId);
        }
    };

    @action setHighlighted = (isHighlighted: boolean) => {
        this.isHighlighted = isHighlighted;
     };
 
     @action addSpectralLines = (spectralLines: SpectralLine[]) => {
         if (spectralLines) {
             this.spectralLinesMHz = spectralLines;
         }
     };
 
     @action clearSpectralLines = () => {
         this.spectralLinesMHz = [];
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

    @action setMarkerTextVisible = (val: boolean) => {
        this.markerTextVisible = val;
    };

    @action setMeanRmsVisible = (val: boolean) => {
        this.meanRmsVisible = val;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setChannel = (channel: number) => {
        this.channel = channel;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    @action setMouseMoveIntoLinePlots = (val: boolean) => {
        this.isMouseMoveIntoLinePlots = val;
    };

    @action updateStreamingDataStatus = (val: boolean) => {
        this.isStreamingData = val;
    };

    @action setSettingsTabId = (tabId: SpectralProfilerSettingsTabs) => {
        this.settingsTabId = tabId;
    };

    constructor(coordinate: string = "z") {
        super(RegionsType.CLOSED_AND_POINT);
        makeObservable<SpectralProfileWidgetStore, "spectralLinesMHz" | "updateRanges">(this);
        this.isStreamingData = false;
        this.isHighlighted = false;
        this.spectralLinesMHz = [];

        // Describes how the data is visualised
        this.plotType = PlotType.STEPS;
        this.meanRmsVisible = false;
        this.markerTextVisible = false;
        this.primaryLineColor = "auto-blue";
        this.lineColorMap = new Map<LineKey, string>([[SpectralProfileWidgetStore.PRIMARY_LINE_KEY, this.primaryLineColor]]);
        this.linePlotPointSize = 1.5;
        this.lineWidth = 1;
        this.linePlotInitXYBoundaries = { minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0 };

        this.smoothingStore = new ProfileSmoothingStore();
        this.profileSelectionStore = new SpectralProfileSelectionStore(this, coordinate);
        this.selectingMode = MomentSelectingMode.NONE;
        this.channelValueRange = [0, 0];
        this.momentMask = CARTA.MomentMask.None;
        this.maskRange = [0, 1];
        this.selectedMoments = [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM];
        this.settingsTabId = SpectralProfilerSettingsTabs.CONVERSION;

        autorun(() => {
            if (this.effectiveFrame) {
                this.updateRanges();
            }
        });
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }

    @computed get isSelectingMomentChannelRange() {
        return this.selectingMode === MomentSelectingMode.CHANNEL;
    }

    @computed get isSelectingMomentMaskRange() {
        return this.selectingMode === MomentSelectingMode.MASK;
    }

    @computed get selectedRange(): {isHorizontal: boolean, center: number, width: number} {
        if (this.isSelectingMomentChannelRange) {
            return {
                isHorizontal: false,
                center: (this.channelValueRange[0] + this.channelValueRange[1]) / 2,
                width: Math.abs(this.channelValueRange[0] - this.channelValueRange[1])
            };
        } else if (this.isSelectingMomentMaskRange) {
            return {
                isHorizontal: true,
                center: (this.maskRange[0] + this.maskRange[1]) / 2,
                width: Math.abs(this.maskRange[0] - this.maskRange[1])
            };
        }
        return null;
    }

    @computed get transformedSpectralLines(): SpectralLine[] {
        // transform to corresponding value according to current widget's spectral settings
        let transformedSpectralLines: SpectralLine[] = [];
        const frame = this.effectiveFrame;
        if (frame && this.spectralLinesMHz) {
            this.spectralLinesMHz.forEach(spectralLine => {
                const transformedValue = frame.convertFreqMHzToSettingWCS(spectralLine.value);
                if (isFinite(transformedValue)) {
                    transformedSpectralLines.push({species: spectralLine.species, value: transformedValue, qn: spectralLine.qn});
                }
            });
        }
        return transformedSpectralLines;
    }

    public static CalculateRequirementsMap(widgetsMap: Map<string, SpectralProfileWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetSpectralRequirements>>();

        widgetsMap.forEach(widgetStore => {
            const spectralConfigs = widgetStore.profileSelectionStore.getFormattedSpectralConfigs();
            spectralConfigs?.forEach(spectralConfig => {
                // fileId
                let frameRequirements = updatedRequirements.get(spectralConfig.fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetSpectralRequirements>();
                    updatedRequirements.set(spectralConfig.fileId, frameRequirements);
                }

                // regionId
                let regionRequirements = frameRequirements.get(spectralConfig.regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetSpectralRequirements({fileId: spectralConfig.fileId, regionId: spectralConfig.regionId});
                    frameRequirements.set(spectralConfig.regionId, regionRequirements);
                }

                // cooridnate & stats type
                if (!regionRequirements.spectralProfiles) {
                    regionRequirements.spectralProfiles = [];
                }
                let existingSpectralConfig = regionRequirements.spectralProfiles.find(profiles => profiles.coordinate === spectralConfig.coordinate);
                if (!existingSpectralConfig) { // create new spectral config
                    regionRequirements.spectralProfiles.push({coordinate: spectralConfig.coordinate, statsTypes: spectralConfig.statsTypes});
                } else {
                    spectralConfig.statsTypes?.forEach(statsType => {
                        if (!existingSpectralConfig.statsTypes.includes(statsType)) { // add to the stats type array
                            existingSpectralConfig.statsTypes.push(statsType);
                        }
                    });
                }
            });
        });

        return updatedRequirements;
    }

    // This function diffs the updated requirements map with the existing requirements map, and reacts to changes
    // Three diff cases are checked:
    // 1. The old map has an entry, but the new one does not => send an "empty" SetSpectralRequirements message
    // 2. The old and new maps both have entries, but they are different => send the new SetSpectralRequirements message
    // 3. The new map has an entry, but the old one does not => send the new SetSpectralRequirements message
    // The easiest way to check all three is to first add any missing entries to the new map (as empty requirements), and then check the updated maps entries
    public static DiffSpectralRequirements(originalRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>) {
        const diffList: CARTA.SetSpectralRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetSpectralRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetSpectralRequirements({fileId, regionId, spectralProfiles: []});
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
                        const configCount = regionRequirements.spectralProfiles ? regionRequirements.spectralProfiles.length : 0;
                        const updatedConfigCount = updatedRegionRequirements.spectralProfiles ? updatedRegionRequirements.spectralProfiles.length : 0;

                        if (configCount !== updatedConfigCount) {
                            diffList.push(updatedRegionRequirements);
                            return;
                        }

                        if (configCount === 0) {
                            return;
                        }
                        const sortedUpdatedConfigs = updatedRegionRequirements.spectralProfiles.sort(((a, b) => a.coordinate > b.coordinate ? 1 : -1));
                        const sortedConfigs = regionRequirements.spectralProfiles.sort(((a, b) => a.coordinate > b.coordinate ? 1 : -1));

                        for (let i = 0; i < updatedConfigCount; i++) {
                            const updatedConfig = sortedUpdatedConfigs[i];
                            const config = sortedConfigs[i];
                            if (updatedConfig.coordinate !== config.coordinate) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }

                            const statsCount = config.statsTypes ? config.statsTypes.length : 0;
                            const updatedStatsCount = updatedConfig.statsTypes ? updatedConfig.statsTypes.length : 0;

                            if (statsCount !== updatedStatsCount) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }

                            if (statsCount === 0) {
                                return;
                            }

                            const sortedUpdatedStats = updatedConfig.statsTypes.sort();
                            const sortedStats = config.statsTypes.sort();
                            for (let j = 0; j < updatedStatsCount; j++) {
                                if (sortedUpdatedStats[j] !== sortedStats[j]) {
                                    diffList.push(updatedRegionRequirements);
                                    return;
                                }
                            }
                        }
                    }
                });
            }

        });
        // Sort list so that requirements clearing occurs first
        return diffList.sort((a, b) => a.spectralProfiles.length > b.spectralProfiles.length ? 1 : -1);
    }

    // settings
    @action getProfileColor = (lineKey: LineKey): string => {
        return this.lineColorMap.get(lineKey);
    };

    @action setProfileColor = (lineKey: LineKey, color: string) => {
        this.lineColorMap.set(lineKey, color);
        // In order to be compatible with loading/saving primary color setting in layout config
        if (this.profileSelectionStore?.isSingleProfileMode) {
            this.primaryLineColor = color;
        }
    };

    @action removeProfileColor = (lineKey: LineKey) => {
        this.lineColorMap.delete(lineKey);
    };

    @action clearProfileColors = () => {
        this.lineColorMap.clear();
    };

    @action setLineWidth = (val: number) => {
        if (val >= LineSettings.MIN_WIDTH && val <= LineSettings.MAX_WIDTH) {
            this.lineWidth = val;   
        }
    }

    @action setLinePlotPointSize = (val: number) => {
        if (val >= LineSettings.MIN_POINT_SIZE && val <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = val;   
        }
    }

    @action initXYBoundaries (minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = { minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal };
    }

    public init = (widgetSettings): void => {
        if (!widgetSettings) {
            return;
        }
        const lineColor = tinycolor(widgetSettings.primaryLineColor);
        if (lineColor.isValid() || isAutoColor(widgetSettings.primaryLineColor)) {
            this.primaryLineColor = widgetSettings.primaryLineColor;
            this.lineColorMap.set(SpectralProfileWidgetStore.PRIMARY_LINE_KEY, this.primaryLineColor);
        }
        if (typeof widgetSettings.lineWidth === "number" && widgetSettings.lineWidth >= LineSettings.MIN_WIDTH && widgetSettings.lineWidth <= LineSettings.MAX_WIDTH) {
            this.lineWidth = widgetSettings.lineWidth;
        }
        if (typeof widgetSettings.linePlotPointSize === "number" && widgetSettings.linePlotPointSize >= LineSettings.MIN_POINT_SIZE && widgetSettings.linePlotPointSize <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = widgetSettings.linePlotPointSize;
        }
        if (typeof widgetSettings.meanRmsVisible === "boolean") {
            this.meanRmsVisible = widgetSettings.meanRmsVisible;
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
            meanRmsVisible: this.meanRmsVisible,
            plotType: this.plotType,
            minXVal: this.linePlotInitXYBoundaries.minXVal,
            maxXVal: this.linePlotInitXYBoundaries.maxXVal,
            minYVal: this.linePlotInitXYBoundaries.minYVal,
            maxYVal: this.linePlotInitXYBoundaries.maxYVal
        };
    };
}
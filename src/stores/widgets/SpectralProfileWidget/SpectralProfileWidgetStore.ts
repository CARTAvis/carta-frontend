import {action, autorun, computed, observable, makeObservable, override} from "mobx";
import {IOptionProps, NumberRange} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {PlotType, LineSettings, VERTICAL_RANGE_PADDING, SmoothingType} from "components/Shared";
import {RegionWidgetStore, RegionsType, ACTIVE_FILE_ID, SpectralLine, SpectralProfileSelectionStore} from "stores/widgets";
import {AppStore, ProfileSmoothingStore, ProfileFittingStore} from "stores";
import {FileId, LineKey, Point2D, ProcessedSpectralProfile, RegionId, SpectralSystem} from "models";
import tinycolor from "tinycolor2";
import {SpectralProfilerSettingsTabs} from "components";
import {clamp, getColorForTheme, isAutoColor} from "utilities";

export enum MomentSelectingMode {
    NONE = 1,
    CHANNEL,
    MASK
}

type XBound = {xMin: number, xMax: number};
type YBound = {yMin: number, yMax: number};
type DataPoints = Point2D[];
type Comments = string[];
export type MultiPlotData = {
    numProfiles: number,
    data: DataPoints[],
    smoothedData: DataPoints[],
    fittingData: {x: number[], y: Float32Array | Float64Array},
    colors: string[],
    labels: {image: string, plot: string}[],
    comments: Comments[],
    plotName: {image: string, plot: string},
    xMin: number,
    xMax: number,
    yMin: number,
    yMax: number,
    yMean: number,
    yRms: number,
    progress: number
};

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
    @observable momentFileId: FileId;
    @observable momentRegionId: RegionId;
    @observable selectingMode: MomentSelectingMode;
    @observable channelValueRange: NumberRange;
    @observable momentMask: CARTA.MomentMask;
    @observable maskRange: NumberRange;
    @observable selectedMoments: CARTA.Moment[];

    readonly smoothingStore: ProfileSmoothingStore;
    readonly profileSelectionStore: SpectralProfileSelectionStore;
    readonly fittingStore: ProfileFittingStore;

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

    @action setMomentFileId = (fileId: FileId) => {
        this.momentFileId = fileId;
    };

    @action setMomentRegionId = (regionId: RegionId) => {
        this.momentRegionId = regionId;
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

    // TODO: figure out if frame is selectable
    @action requestMoment = () => {
        const frame = AppStore.Instance.getFrame(this.momentFileId);
        if (frame) {
        const channelIndex1 = frame.findChannelIndexByValue(this.channelValueRange[0]);
        const channelIndex2 = frame.findChannelIndexByValue(this.channelValueRange[1]);
        if (isFinite(channelIndex1) && isFinite(channelIndex2)) {
            const channelIndexRange: CARTA.IIntBounds = {
                min: channelIndex1 <= channelIndex2 ? channelIndex1 : channelIndex2,
                max: channelIndex1 <= channelIndex2 ? channelIndex2 : channelIndex1
            };
            const requestMessage: CARTA.IMomentRequest = {
                fileId: this.momentFileId,
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
        this.fittingStore = new ProfileFittingStore(this);
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

        // Update boundaries
        autorun(() => {
            const currentData = this.plotData;
            if (currentData) {
                this.initXYBoundaries(currentData.xMin, currentData.xMax, currentData.yMin, currentData.yMax);
            }
        });
    }

    @computed get profileNum(): number {
        return this.profileSelectionStore.profiles?.length;
    }

    @computed get plotData(): MultiPlotData {
        const frame = this.effectiveFrame;
        if (!(frame?.channelInfo)) {
            return null;
        }

        // Get profiles
        const profiles = this.profileSelectionStore.profiles;
        if (!(profiles?.length > 0)) {
            return null;
        }

        // Determine points/smoothingPoints/colors/yBound/progress
        let numProfiles = 0;
        let data = [];
        let smoothedData = [];
        let colors = [];
        let labels = [];
        let comments = [];
        let xBound = {xMin: Number.MAX_VALUE, xMax: -Number.MAX_VALUE};
        let yBound = {yMin: Number.MAX_VALUE, yMax: -Number.MAX_VALUE};
        let yMean = undefined;
        let yRms = undefined;
        let progressSum: number = 0;
        let startEndIndexes: {startIndex: number, endIndex: number}[] = [];
        const wantMeanRms = profiles.length === 1;
        const profileColorMap = this.lineColorMap;
        profiles.forEach(profile => {
            if (profile) {
                numProfiles++;
                colors.push(getColorForTheme(profileColorMap.get(profile.colorKey)));
                labels.push(profile.label);
                comments.push(profile.comments);

                const pointsAndProperties = this.getDataPointsAndProperties(profile.channelValues, profile.data, wantMeanRms);
                data.push(pointsAndProperties?.points ?? []);
                smoothedData.push(pointsAndProperties?.smoothedPoints ?? []);
                if (pointsAndProperties) {
                    if (wantMeanRms) {
                        yMean = pointsAndProperties.yMean;
                        yRms = pointsAndProperties.yRms;
                    }

                    if (xBound.xMin > pointsAndProperties.xBound.xMin) {
                        xBound.xMin = pointsAndProperties.xBound.xMin;
                    }
                    if (xBound.xMax < pointsAndProperties.xBound.xMax) {
                        xBound.xMax = pointsAndProperties.xBound.xMax;
                    }

                    if (yBound.yMin > pointsAndProperties.yBound.yMin) {
                        yBound.yMin = pointsAndProperties.yBound.yMin;
                    }
                    if (yBound.yMax < pointsAndProperties.yBound.yMax) {
                        yBound.yMax = pointsAndProperties.yBound.yMax;
                    }
                    progressSum = progressSum + profile.data.progress;
                    startEndIndexes.push({startIndex: pointsAndProperties.startIndex, endIndex: pointsAndProperties.endIndex});
                }
            }
        });

        let fittingData: {x: number[], y: Float32Array | Float64Array};
        if (profiles.length === 1 && startEndIndexes.length === 1) {
            let x = profiles[0].channelValues.slice(startEndIndexes[0].startIndex, startEndIndexes[0].endIndex + 1);
            let y = profiles[0].data.values.slice(startEndIndexes[0].startIndex, startEndIndexes[0].endIndex + 1)
            if (this.smoothingStore.type !== SmoothingType.NONE) {
                const smoothedData = this.smoothingStore.getSmoothingValues(x, y);
                x = smoothedData.x;
                y = smoothedData.y;
            }
            fittingData = { x: x, y: y}
        }

        if (xBound.xMin === Number.MAX_VALUE) {
            xBound.xMin = undefined;
            xBound.xMax = undefined;
        }

        if (yBound.yMin === Number.MAX_VALUE) {
            yBound.yMin = undefined;
            yBound.yMax = undefined;
        } else {
            // extend y range a bit
            const range = yBound.yMax - yBound.yMin;
            yBound.yMin -= range * VERTICAL_RANGE_PADDING;
            yBound.yMax += range * VERTICAL_RANGE_PADDING;
        }

        return {
            numProfiles: numProfiles,
            data: data,
            smoothedData: smoothedData,
            fittingData: fittingData,
            colors: colors,
            labels: labels,
            comments: comments,
            plotName: this.profileSelectionStore.profilesPlotName,
            xMin: xBound.xMin,
            xMax: xBound.xMax,
            yMin: yBound.yMin,
            yMax: yBound.yMax,
            yMean: yMean,
            yRms: yRms,
            progress: progressSum / numProfiles
        };
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

    @computed get momentRegionOptions(): IOptionProps[] {
        const frame = AppStore.Instance.getFrame(this.momentFileId);
        return frame?.regionSet?.regions?.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT))?.map(region => {
            return {
                value: region?.regionId,
                label: region?.nameString,
                disabled: !region?.isClosedRegion
            };
        });
    }

    @computed get transformedSpectralLines(): SpectralLine[] {
        const frame = this.effectiveFrame;

        // Ignoring plotting lines when:
        // 1. x cooridnate is channel
        // 2. showing multiple profiles of different images in radio/optical velocity.(observation sources are not aligned now)
        const disablePlot = frame?.isCoordChannel || (frame?.isCoordVelocity && this.profileSelectionStore.isShowingProfilesOfMultiImages);

        let transformedSpectralLines: SpectralLine[] = [];
        if (frame && !disablePlot) {
            this.spectralLinesMHz?.forEach(spectralLine => {
                const transformedValue = frame.convertFreqMHzToSettingWCS(spectralLine?.value);
                if (isFinite(transformedValue)) {
                    transformedSpectralLines.push({species: spectralLine?.species, value: transformedValue, qn: spectralLine?.qn});
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

    private getBoundX = (channelValues: number[]): XBound => {
        if (channelValues?.length > 0) {
            let xMin = Math.min(channelValues[0], channelValues[channelValues.length - 1]);
            let xMax = Math.max(channelValues[0], channelValues[channelValues.length - 1])
            if (!this.isAutoScaledX) {
                const localXMin = clamp(this.minX, xMin, xMax);
                const localXMax = clamp(this.maxX, xMin, xMax);
                xMin = localXMin;
                xMax = localXMax;
            }
            return {xMin, xMax};
        }
        return {xMin: undefined, xMax: undefined};
    };

    private getDataPointsAndProperties = (frameChannelValues: number[], profile: ProcessedSpectralProfile, wantMeanRms: boolean): {
        points: Point2D[],
        smoothedPoints: Point2D[],
        xBound: XBound,
        yBound: YBound,
        yMean: number,
        yRms: number,
        startIndex: number,
        endIndex: number
    } => {
        let points: Point2D[] = [];
        let smoothedPoints: Point2D[] = [];
        let xBound = this.getBoundX(frameChannelValues);
        let yBound = {yMin: Number.MAX_VALUE, yMax: -Number.MAX_VALUE};
        let yMean = undefined;
        let yRms = undefined;

        if (profile?.values?.length > 0 && frameChannelValues?.length > 0 && profile.values.length === frameChannelValues.length) {
            // Variables for mean and RMS calculations
            let ySum = 0;
            let ySum2 = 0;
            let yCount = 0;
            let startIndex, endIndex;
            for (let i = 0; i < frameChannelValues.length; i++) {
                const x = frameChannelValues[i];
                const y = profile.values[i];

                // Skip values outside of range. If array already contains elements, we've reached the end of the range, and can break
                if (x < xBound?.xMin || x > xBound?.xMax) {
                    if (points.length) {
                        break;
                    } else {
                        continue;
                    }
                }

                if (!isFinite(startIndex)) {
                    startIndex = i;
                }
                endIndex = i;
                points.push({x, y});

                // update yMin/yMax & calculate Mean/RMS
                if (!isNaN(y)) {
                    yBound.yMin = Math.min(yBound.yMin, y);
                    yBound.yMax = Math.max(yBound.yMax, y);

                    if (wantMeanRms) {
                        yCount++;
                        ySum += y;
                        ySum2 += y * y;
                    }
                }
            }
            smoothedPoints = smoothedPoints.concat(this.smoothingStore.getSmoothingPoint2DArray(frameChannelValues, profile.values));

            if (wantMeanRms && yCount > 0) {
                yMean = ySum / yCount;
                yRms = Math.sqrt((ySum2 / yCount) - yMean * yMean);
            }

            return {points: points, smoothedPoints: smoothedPoints, xBound: xBound, yBound: yBound, yMean: yMean, yRms: yRms, startIndex: startIndex, endIndex: endIndex};
        } else {
            return undefined;
        }
    };
}
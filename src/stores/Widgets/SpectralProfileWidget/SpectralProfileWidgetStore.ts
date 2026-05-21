import type {NumberRange, OptionProps} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable, override, reaction} from "mobx";
import tinycolor from "tinycolor2";

import {VERTICAL_RANGE_PADDING} from "components/Shared";
import {LineSettings, MomentSelectingMode, MultiProfileCategory, PlotType, Polarizations, RegionId, RegionsType, SmoothingType, SpectralProfilerSettingsTabs, type SpectralSystem, TelemetryAction} from "enums";
import {GetCommonIntensityOptions, GetIntensityConversion, GetIntensityOptions, type IntensityConfig, IsIntensitySupported, type LineKey, type Point2D} from "models";
import {TelemetryService} from "services";
import {AppStore, ProfileFittingStore, ProfileSmoothingStore} from "stores";
import {RegionWidgetStore, type SpectralLine, SpectralProfileSelectionStore} from "stores/Widgets";
import {clamp, getColorForTheme, isAutoColor, pixelToFluxDensityUnit} from "utilities";

type XBound = {xMin: number | undefined; xMax: number | undefined};
type YBound = {yMin: number; yMax: number};
type DataPoints = Point2D[];
export type MultiPlotData = {
    numProfiles: number;
    data: DataPoints[];
    secondaryXData: number[][];
    smoothedData: DataPoints[];
    fittingData: {x: number[]; y: Float32Array | Float64Array | undefined} | undefined;
    colors: (string | undefined)[];
    labels: {image: string | undefined; plot: string}[];
    plotName: {image: string; plot: string};
    xMin: number | undefined;
    xMax: number | undefined;
    yMin: number | undefined;
    yMax: number | undefined;
    yMean: number | undefined;
    yRms: number | undefined;
    progress: number;
};

export class SpectralProfileWidgetStore extends RegionWidgetStore {
    @observable minX: number | undefined = undefined;
    @observable maxX: number | undefined = undefined;
    @observable minY: number | undefined = undefined;
    @observable maxY: number | undefined = undefined;
    @observable cursorX: number = 0;
    @observable channel: number = 0;
    @observable markerTextVisible: boolean = false;
    @observable isMouseMoveIntoLinePlots: boolean = false;
    @observable isStreamingData: boolean = false;
    @observable isHighlighted: boolean = false;
    @observable private spectralLinesMHz: SpectralLine[] = [];
    @observable intensityUnit: string | undefined = undefined;

    // style settings
    @observable plotType: PlotType = PlotType.STEPS;
    @observable meanRmsVisible: boolean = false;
    @observable primaryLineColor: string = "auto-blue";
    @observable lineColorMap: Map<LineKey, string> = new Map<LineKey, string>([[SpectralProfileWidgetStore.PRIMARY_LINE_KEY, "auto-blue"]]);
    @observable lineWidth: number = 1;
    @observable linePlotPointSize: number = 1.5;
    @observable linePlotInitXYBoundaries: {minXVal: number | undefined; maxXVal: number | undefined; minYVal: number | undefined; maxYVal: number | undefined} = {minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0};
    @observable settingsTabId: SpectralProfilerSettingsTabs = SpectralProfilerSettingsTabs.CONVERSION;

    @observable secondaryAxisCursorInfoVisible: boolean = false;

    @observable keep: boolean = false;

    // line key will be "Primary" in single line mode
    public static readonly PRIMARY_LINE_KEY = "Primary";

    // moment settings
    @observable momentRegionId: number = RegionId.ACTIVE;
    @observable selectingMode: MomentSelectingMode = MomentSelectingMode.NONE;
    @observable channelValueRange: NumberRange = [0, 0];
    @observable momentMask: CARTA.MomentMask = CARTA.MomentMask.None;
    @observable maskRange: NumberRange = [0, 1];
    @observable selectedMoments: CARTA.Moment[] = [CARTA.Moment.INTEGRATED_OF_THE_SPECTRUM];

    readonly smoothingStore: ProfileSmoothingStore;
    readonly profileSelectionStore: SpectralProfileSelectionStore;
    readonly fittingStore: ProfileFittingStore;

    private readonly disposers: IReactionDisposer[] = [];

    /**
     * Set region for the spectral profiler.
     *
     * @param fileId - File ID number.
     * @param regionId - Region ID number.
     */
    @override setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
        this.clearXYBounds();
    };

    /**
     * Set spectral coordinates.
     *
     * @param coordStr - A string of <i>Spectral type (unit)</i> like Frequency (GHz).
     */
    @action setSpectralCoordinate = (coordStr: string) => {
        if (this.effectiveFrame?.setSpectralCoordinate(coordStr)) {
            this.clearXBounds();
        }
    };

    @action setSpectralCoordinateSecondary = (coordStr: string) => {
        if (this.effectiveFrame?.setSpectralCoordinateSecondary(coordStr)) {
            this.clearXBounds();
        }
    };

    /**
     * Set the spectral system.
     *
     * @param specsys - Spectral system {@link SpectralSystem}.
     */
    @action setSpectralSystem = (specsys: SpectralSystem) => {
        if (this.effectiveFrame?.setSpectralSystem(specsys)) {
            this.clearXBounds();
        }
    };

    @action setMultiProfileIntensityUnit = (intensityUnitStr: string | undefined) => {
        this.intensityUnit = intensityUnitStr;
    };

    /**
     * Select region for generating moment maps.
     *
     * @param regionId -  Region ID number.
     */
    @action selectMomentRegion = (regionId: number) => {
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

    /**
     * Set the channel range for generating moment maps.
     *
     * @param min - Number of first channel.
     * @param max - Number of last channel.
     */
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

    /**
     * Mask for generating moment maps.
     *
     * @param momentMask - enum {@link CARTA.MomentMask}.
     */
    @action setMomentMask = (momentMask: CARTA.MomentMask) => {
        this.momentMask = momentMask;
    };

    /**
     * Add moments to generate maps.
     *
     * @param selected - Moment in {@link CARTA.Moment}.
     */
    @action selectMoment = (selected: CARTA.Moment) => {
        if (!this.selectedMoments.includes(selected)) {
            this.selectedMoments.push(selected);
        }
    };

    /**
     * Delete moments to generate maps.
     *
     * @param deselected - Moment in {@link CARTA.Moment}.
     */
    @action deselectMoment = (deselected: CARTA.Moment) => {
        if (this.selectedMoments.includes(deselected)) {
            this.selectedMoments = this.selectedMoments.filter(momentType => momentType !== deselected);
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

    /**
     * Request the moment maps.
     */
    @action requestMoment = () => {
        const frame = this.effectiveFrame;
        if (frame && this.isMomentRegionValid) {
            const channelIndex1 = frame.findChannelIndexByValue(this.channelValueRange[0]);
            const channelIndex2 = frame.findChannelIndexByValue(this.channelValueRange[1]);
            if (channelIndex1 !== undefined && channelIndex2 !== undefined && isFinite(channelIndex1) && isFinite(channelIndex2)) {
                const channelIndexRange: CARTA.IIntBounds = {
                    min: channelIndex1 <= channelIndex2 ? channelIndex1 : channelIndex2,
                    max: channelIndex1 <= channelIndex2 ? channelIndex2 : channelIndex1
                };
                const regionId = this.momentRegionId === RegionId.ACTIVE ? (this.effectiveFrame?.regionSet?.focusedRegion?.regionId ?? RegionId.CURSOR) : this.momentRegionId;
                const requestMessage: CARTA.IMomentRequest = {
                    fileId: frame.frameInfo.fileId,
                    moments: this.selectedMoments,
                    axis: CARTA.MomentAxis.SPECTRAL,
                    regionId: regionId,
                    spectralRange: channelIndexRange,
                    mask: this.momentMask,
                    pixelRange: new CARTA.FloatBounds({min: this.maskRange[0], max: this.maskRange[1]}),
                    keep: this.keep,
                    restFreq: frame.restFreqStore?.restFreqInHz
                };
                frame.resetMomentRequestState();
                frame.setIsRequestingMoments(true);
                AppStore.Instance.requestMoment(requestMessage, frame);

                const region = frame.regionSet.regionMap.get(regionId);
                const width = region?.size.x;
                const height = region?.size.y;
                const depth = Math.abs(channelIndex1 - channelIndex2) + 1;
                TelemetryService.Instance.addTelemetryEntry(TelemetryAction.MomentGeneration, {regionId: regionId, regionType: region?.regionType, width, height, depth});
            }
        }
    };

    /**
     * Cancel the moment maps request.
     */
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

    @action setSecondaryAxisCursorInfoVisible = (val: boolean) => {
        this.secondaryAxisCursorInfoVisible = val;
    };

    /**
     * Keep previous moment maps.
     *
     * @param bool - A boolean. Set true to keep previous moment maps.
     */
    @action setKeep = (bool: boolean) => {
        this.keep = bool;
    };

    constructor(coordinate: string = "z") {
        super(RegionsType.CLOSED_AND_POINT);
        makeObservable<SpectralProfileWidgetStore, "spectralLinesMHz" | "updateRanges">(this);

        this.smoothingStore = new ProfileSmoothingStore();
        this.fittingStore = new ProfileFittingStore(this);
        this.profileSelectionStore = new SpectralProfileSelectionStore(this, coordinate);
        this.setMultiProfileIntensityUnit(this.effectiveFrame?.headerUnit);

        this.disposers.push(
            reaction(
                () => this.effectiveFrame,
                frame => {
                    if (frame) {
                        const isMultiProfileActive = this.profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE;
                        if (isMultiProfileActive) {
                            this.setMultiProfileIntensityUnit(GetIntensityConversion(frame.intensityConfig, this.intensityUnit) ? this.intensityUnit : frame.headerUnit);
                        }
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.profileSelectionStore.activeProfileCategory,
                () => {
                    this.setMultiProfileIntensityUnit(this.intensityOptions[0]);
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.effectiveFrame?.requiredPolarization,
                polarization => {
                    if (this.effectiveFrame && polarization !== undefined && [Polarizations.PFtotal, Polarizations.PFlinear, Polarizations.Pangle].includes(polarization)) {
                        this.setMultiProfileIntensityUnit(this.effectiveFrame.headerUnit);
                    }
                }
            )
        );

        this.disposers.push(
            reaction(
                () => this.effectiveFrame?.channelValueBounds,
                channelValueBounds => {
                    if (channelValueBounds) {
                        this.updateRanges();
                    }
                }
            )
        );

        this.disposers.push(
            autorun(() => {
                if (this.effectiveFrame) {
                    this.updateRanges();
                    this.selectMomentRegion(RegionId.IMAGE);
                }
            })
        );

        // Update boundaries
        this.disposers.push(
            autorun(() => {
                const currentData = this.plotData;
                if (currentData) {
                    this.initXYBoundaries(currentData.xMin, currentData.xMax, currentData.yMin, currentData.yMax);
                }
            })
        );
    }

    public dispose = () => {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
        this.profileSelectionStore.dispose();
    };

    @computed private get intensityConfig(): IntensityConfig | undefined {
        const frame = this.effectiveFrame;
        if (frame) {
            return frame.intensityConfig;
        }
        return undefined;
    }

    @computed get isIntensityConvertible(): boolean {
        return this.intensityConfig?.nativeIntensityUnit !== undefined && IsIntensitySupported(this.intensityConfig?.nativeIntensityUnit) && !this.profileSelectionStore.isCoordinatesIncludingNonIntensityUnit;
    }

    @computed get intensityOptions(): string[] {
        const frame = this.effectiveFrame;
        const isMultiProfileActive = this.profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE;

        const profiles = this.profileSelectionStore.profiles;
        const displayedFramesIntensityConfig = profiles.map(profile => profile.intensityConfig);

        if (frame?.spectralReference && isMultiProfileActive && profiles.length) {
            const intensityConfigArray = [frame?.intensityConfig, ...displayedFramesIntensityConfig];
            return GetCommonIntensityOptions(intensityConfigArray);
        } else {
            return this.intensityConfig ? GetIntensityOptions(this.intensityConfig) : [];
        }
    }

    @computed get profileNum(): number {
        return this.profileSelectionStore.profiles?.length;
    }

    @computed get plotData(): MultiPlotData | null {
        const frame = this.effectiveFrame;
        if (!frame?.channelInfo) {
            return null;
        }

        // Get profiles
        const profiles = this.profileSelectionStore.profiles;
        if (!(profiles?.length > 0)) {
            return null;
        }

        // Determine points/smoothingPoints/colors/yBound/progress
        let numProfiles = 0;
        const data: Point2D[][] = [];
        const secondaryXData: number[][] = [];
        const smoothedData: Point2D[][] = [];
        const colors: (string | undefined)[] = [];
        const labels: {image: string | undefined; plot: string}[] = [];
        const xBound = {xMin: Number.MAX_VALUE, xMax: -Number.MAX_VALUE};
        const yBound = {yMin: Number.MAX_VALUE, yMax: -Number.MAX_VALUE};
        let yMean: number | undefined;
        let yRms: number | undefined;
        let progressSum: number = 0;
        const dataIndexes: {startIndex: number; endIndex: number}[] = [];
        const wantMeanRms = profiles.length === 1;
        const profileColorMap = this.lineColorMap;
        const isMultiProfileActive = this.profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE;

        profiles.forEach(profile => {
            if (profile?.data) {
                numProfiles++;
                const profileColor = profileColorMap.get(profile.colorKey ?? "");
                colors.push(profileColor === undefined ? undefined : getColorForTheme(profileColor));
                labels.push(profile.label);

                const intensityConversion = GetIntensityConversion(profile.intensityConfig, isMultiProfileActive ? this.intensityUnit : profile.intensityUnit);
                const intensityValues = intensityConversion && profile.data.values ? intensityConversion(profile.data.values) : profile.data.values;
                const pointsAndProperties = this.getDataPointsAndProperties(profile.channelValues, intensityValues, wantMeanRms);

                data.push(pointsAndProperties?.points ?? []);
                smoothedData.push(pointsAndProperties?.smoothedPoints ?? []);
                secondaryXData.push(profile.channelSecondaryValues?.slice(pointsAndProperties?.startIndex, (pointsAndProperties?.endIndex ?? NaN) + 1) ?? []);

                if (pointsAndProperties) {
                    if (wantMeanRms) {
                        if (this.smoothingStore.type === SmoothingType.NONE) {
                            yMean = pointsAndProperties.yMean;
                            yRms = pointsAndProperties.yRms;
                        } else if (!this.smoothingStore.isOverlayOn) {
                            yMean = pointsAndProperties.ySmoothedMean;
                            yRms = pointsAndProperties.ySmoothedRms;
                        }
                    }
                    if (pointsAndProperties.xBound.xMin !== undefined && xBound.xMin > pointsAndProperties.xBound.xMin) {
                        xBound.xMin = pointsAndProperties.xBound.xMin;
                    }
                    if (pointsAndProperties.xBound.xMax !== undefined && xBound.xMax < pointsAndProperties.xBound.xMax) {
                        xBound.xMax = pointsAndProperties.xBound.xMax;
                    }
                    if (yBound.yMin > pointsAndProperties.yBound.yMin) {
                        yBound.yMin = pointsAndProperties.yBound.yMin;
                    }
                    if (yBound.yMax < pointsAndProperties.yBound.yMax) {
                        yBound.yMax = pointsAndProperties.yBound.yMax;
                    }
                    progressSum = progressSum + profile.data.progress;
                    dataIndexes.push({startIndex: pointsAndProperties.startIndex, endIndex: pointsAndProperties.endIndex});
                }
            }
        });

        let fittingData: {x: number[]; y: Float32Array | Float64Array | undefined} | undefined;
        if (profiles.length === 1 && dataIndexes.length === 1) {
            let x = profiles[0].channelValues.slice(dataIndexes[0].startIndex, dataIndexes[0].endIndex + 1);
            const intensityConversion = GetIntensityConversion(profiles[0].intensityConfig, isMultiProfileActive ? this.intensityUnit : profiles[0].intensityUnit);
            const intensityValues = intensityConversion && profiles[0].data?.values ? intensityConversion(profiles[0].data.values) : profiles[0].data?.values;
            let y: Float32Array | Float64Array | undefined = intensityValues?.slice(dataIndexes[0].startIndex, dataIndexes[0].endIndex + 1);
            if (this.smoothingStore.type !== SmoothingType.NONE && y) {
                const smoothedData = this.smoothingStore.getSmoothingValues(x, y);
                x = smoothedData.x;
                y = smoothedData.y;
            }
            fittingData = {x: x, y: y};
        }

        let xMin: number | undefined = xBound.xMin;
        let xMax: number | undefined = xBound.xMax;
        if (xMin === Number.MAX_VALUE) {
            xMin = undefined;
            xMax = undefined;
        }

        let yMin: number | undefined = yBound.yMin;
        let yMax: number | undefined = yBound.yMax;
        if (yMin === Number.MAX_VALUE) {
            yMin = undefined;
            yMax = undefined;
        } else {
            // extend y range a bit
            const range = yMax - yMin;
            yMin -= range * VERTICAL_RANGE_PADDING;
            yMax += range * VERTICAL_RANGE_PADDING;
        }

        return {
            numProfiles,
            data,
            secondaryXData,
            smoothedData,
            fittingData,
            colors,
            labels,
            plotName: this.profileSelectionStore.profilesPlotName,
            xMin,
            xMax,
            yMin,
            yMax,
            yMean,
            yRms,
            progress: progressSum / numProfiles
        };
    }

    @computed get isAutoScaledX() {
        return this.minX === undefined || this.maxX === undefined;
    }

    @computed get isAutoScaledY() {
        return this.minY === undefined || this.maxY === undefined;
    }

    @computed get isSelectingMomentChannelRange() {
        return this.selectingMode === MomentSelectingMode.CHANNEL;
    }

    @computed get isSelectingMomentMaskRange() {
        return this.selectingMode === MomentSelectingMode.MASK;
    }

    @computed get selectedRange(): {isHorizontal: boolean; center: number; width: number} | null {
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

    @computed get momentRegionOptions(): OptionProps[] {
        const frame = this.effectiveFrame;
        let momentRegionOptions = [
            {value: RegionId.ACTIVE, label: "Active"},
            {value: RegionId.IMAGE, label: "Image"}
        ];
        if (frame?.regionSet) {
            const validRegionOptions = frame.regionSet.regions
                ?.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT))
                ?.map(region => {
                    return {value: region?.regionId, label: region?.nameString, disabled: !region?.isClosedRegion};
                });
            if (validRegionOptions) {
                momentRegionOptions = momentRegionOptions.concat(validRegionOptions);
            }
        }
        return momentRegionOptions;
    }

    // Valid region for moments:
    // 1. cursor, request moments of whole image
    // 2. closed region
    @computed get isMomentRegionValid(): boolean {
        if (this.effectiveFrame) {
            if (this.momentRegionId === RegionId.IMAGE) {
                return true;
            } else if (this.momentRegionId === RegionId.ACTIVE) {
                const region = this.effectiveFrame.regionSet?.focusedRegion;
                return !region || region?.regionId === RegionId.CURSOR ? true : region?.isClosedRegion;
            } else {
                const region = this.effectiveFrame.getRegion(this.momentRegionId);
                return region?.isClosedRegion ?? false;
            }
        }
        return false;
    }

    @computed get momentRegionInfo(): string | undefined {
        if (this.effectiveFrame) {
            if (this.momentRegionId === RegionId.IMAGE) {
                return "Image";
            } else if (this.momentRegionId === RegionId.ACTIVE) {
                const region = this.effectiveFrame.regionSet?.focusedRegion;
                return !region || region.regionId === RegionId.CURSOR ? "Image" : region.nameString;
            } else {
                const region = this.effectiveFrame.getRegion(this.momentRegionId);
                return region?.nameString ?? undefined;
            }
        }
        return undefined;
    }

    @computed get transformedSpectralLines(): SpectralLine[] {
        const frame = this.effectiveFrame;

        // Ignoring plotting lines when:
        // 1. x coordinate is channel
        // 2. showing multiple profiles of different images in radio/optical velocity.(observation sources are not aligned now)
        const disablePlot = frame?.isCoordChannel || (frame?.isCoordVelocity && this.profileSelectionStore.isShowingProfilesOfMultiImages);

        const transformedSpectralLines: SpectralLine[] = [];
        if (frame && !disablePlot) {
            this.spectralLinesMHz?.forEach(spectralLine => {
                const transformedValue = frame.convertFreqMHzToSettingWCS(spectralLine?.value);
                if (transformedValue && isFinite(transformedValue)) {
                    transformedSpectralLines.push({species: spectralLine?.species, value: transformedValue, qn: spectralLine?.qn});
                }
            });
        }
        return transformedSpectralLines;
    }

    @computed get yUnit(): string | undefined {
        const isMultiProfileActive = this.profileSelectionStore.activeProfileCategory === MultiProfileCategory.IMAGE;
        if (this.intensityUnit || this.effectiveFrame?.intensityUnit) {
            if (this.profileSelectionStore.isSameStatsTypeUnit && this.profileSelectionStore.isSameCoordinatesUnit) {
                let unitString: string | undefined;
                if (this.profileSelectionStore.isCoordinatesPFtotalPFlinearOnly) {
                    unitString = "%";
                } else if (this.profileSelectionStore.isCoordinatesPangleOnly) {
                    unitString = "degree";
                } else {
                    unitString = isMultiProfileActive
                        ? GetIntensityConversion(this.effectiveFrame?.intensityConfig, this.intensityUnit) && this.intensityUnit
                            ? this.intensityUnit
                            : this.effectiveFrame?.headerUnit
                        : this.effectiveFrame?.intensityUnit;
                }

                if (this.profileSelectionStore.isStatsTypeFluxDensityOnly && this.profileSelectionStore.isCoordinatesPangleOnly) {
                    return "";
                } else if (this.profileSelectionStore.isStatsTypeFluxDensityOnly && unitString) {
                    return pixelToFluxDensityUnit(unitString);
                } else if (this.profileSelectionStore.isStatsTypeSumSqOnly) {
                    return `(${unitString})^2`;
                } else {
                    return unitString;
                }
            }
        }
        return "";
    }

    public static calculateRequirementsMap(widgetsMap: Map<string, SpectralProfileWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetSpectralRequirements>>();

        widgetsMap.forEach(widgetStore => {
            const spectralConfigs = widgetStore.profileSelectionStore.getFormattedSpectralConfigs();
            spectralConfigs?.forEach(spectralConfig => {
                // fileId
                if (spectralConfig.fileId === undefined) {
                    return;
                }
                let frameRequirements = updatedRequirements.get(spectralConfig.fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetSpectralRequirements>();
                    updatedRequirements.set(spectralConfig.fileId, frameRequirements);
                }

                // regionId
                if (spectralConfig.regionId === undefined || spectralConfig.regionId === null) {
                    return;
                }
                let regionRequirements = frameRequirements.get(spectralConfig.regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetSpectralRequirements({fileId: spectralConfig.fileId, regionId: spectralConfig.regionId});
                    frameRequirements.set(spectralConfig.regionId, regionRequirements);
                }

                // coordinate & stats type
                if (!regionRequirements.spectralProfiles) {
                    regionRequirements.spectralProfiles = [];
                }
                const existingSpectralConfig = regionRequirements.spectralProfiles.find(profiles => profiles.coordinate === spectralConfig.coordinate);
                if (!existingSpectralConfig) {
                    // create new spectral config
                    regionRequirements.spectralProfiles.push({coordinate: spectralConfig.coordinate, statsTypes: spectralConfig.statsTypes});
                } else {
                    spectralConfig.statsTypes?.forEach(statsType => {
                        if (!existingSpectralConfig?.statsTypes?.includes(statsType)) {
                            // add to the stats type array
                            existingSpectralConfig?.statsTypes?.push(statsType);
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
    public static diffSpectralRequirements(originalRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>) {
        const diffList: CARTA.SetSpectralRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetSpectralRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements?.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetSpectralRequirements({fileId, regionId, spectralProfiles: []});
                    updatedFrameRequirements?.set(regionId, updatedRegionRequirements);
                }
            });
        });

        // Go through updated requirements entries and find differences
        updatedRequirements.forEach((updatedFrameRequirements, fileId) => {
            const frameRequirements = originalRequirements.get(fileId);
            if (!frameRequirements) {
                // If there are no existing requirements for this fileId, all entries for this file are new
                updatedFrameRequirements.forEach(regionRequirements => diffList.push(regionRequirements));
            } else {
                updatedFrameRequirements.forEach((updatedRegionRequirements, regionId) => {
                    const regionRequirements = frameRequirements?.get(regionId);
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
                        const sortedUpdatedConfigs = updatedRegionRequirements.spectralProfiles.sort((a, b) => ((a.coordinate ?? NaN) > (b.coordinate ?? NaN) ? 1 : -1));
                        const sortedConfigs = regionRequirements.spectralProfiles.sort((a, b) => ((a.coordinate ?? NaN) > (b.coordinate ?? NaN) ? 1 : -1));

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

                            const sortedUpdatedStats = updatedConfig.statsTypes?.sort();
                            const sortedStats = config.statsTypes?.sort();
                            for (let j = 0; j < updatedStatsCount; j++) {
                                if (sortedUpdatedStats?.[j] !== sortedStats?.[j]) {
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
        return diffList.sort((a, b) => (a.spectralProfiles.length > b.spectralProfiles.length ? 1 : -1));
    }

    // settings
    @action getProfileColor = (lineKey: LineKey): string | undefined => {
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
    };

    @action setLinePlotPointSize = (val: number) => {
        if (val >= LineSettings.MIN_POINT_SIZE && val <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = val;
        }
    };

    @action initXYBoundaries(minXVal: number | undefined, maxXVal: number | undefined, minYVal: number | undefined, maxYVal: number | undefined) {
        this.linePlotInitXYBoundaries = {minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal};
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

    public selectFrame = (fileId: number) => {
        this.profileSelectionStore.selectFrame(fileId);
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
            let xMax = Math.max(channelValues[0], channelValues[channelValues.length - 1]);
            if (!this.isAutoScaledX) {
                const localXMin = clamp(this.minX ?? NaN, xMin, xMax);
                const localXMax = clamp(this.maxX ?? NaN, xMin, xMax);
                xMin = localXMin;
                xMax = localXMax;
            }
            return {xMin, xMax};
        }
        return {xMin: undefined, xMax: undefined};
    };

    private getDataPointsAndProperties = (
        frameChannelValues: number[],
        intensityValues: Float32Array | Float64Array | null,
        wantMeanRms: boolean
    ):
        | {
              points: Point2D[];
              smoothedPoints: Point2D[];
              xBound: XBound;
              yBound: YBound;
              yMean: number | undefined;
              yRms: number | undefined;
              startIndex: number;
              endIndex: number;
              ySmoothedMean: number | undefined;
              ySmoothedRms: number | undefined;
          }
        | undefined => {
        const points: Point2D[] = [];
        let smoothedPoints: Point2D[] = [];
        const xBound = this.getBoundX(frameChannelValues);
        const yBound = {yMin: Number.MAX_VALUE, yMax: -Number.MAX_VALUE};
        let yMean: number | undefined;
        let yRms: number | undefined;
        let ySmoothedMean: number | undefined;
        let ySmoothedRms: number | undefined;

        if (intensityValues && intensityValues.length > 0 && frameChannelValues?.length > 0 && intensityValues.length === frameChannelValues.length) {
            // Variables for mean and RMS calculations
            let ySum = 0;
            let ySum2 = 0;
            let yCount = 0;
            let startIndex, endIndex;
            for (let i = 0; i < frameChannelValues.length; i++) {
                const x = frameChannelValues[i];
                const y = intensityValues[i];

                // Skip values outside of range. If array already contains elements, we've reached the end of the range, and can break
                if ((xBound.xMin !== undefined && x < xBound.xMin) || (xBound.xMax !== undefined && x > xBound.xMax)) {
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
            smoothedPoints = smoothedPoints.concat(this.smoothingStore.getSmoothingPoint2DArray(frameChannelValues, intensityValues, startIndex, endIndex));

            if (wantMeanRms && yCount > 0) {
                yMean = ySum / yCount;
                yRms = Math.sqrt(ySum2 / yCount - yMean * yMean);
            }

            if (wantMeanRms && smoothedPoints && this.smoothingStore.type !== SmoothingType.NONE) {
                let ySmoothedSum = 0;
                let ySmoothedSum2 = 0;
                let ySmoothedCount = 0;
                for (let i = 0; i < smoothedPoints.length; i++) {
                    const ySmoothed = smoothedPoints[i].y;
                    if (isFinite(ySmoothed)) {
                        ySmoothedCount++;
                        ySmoothedSum += ySmoothed;
                        ySmoothedSum2 += ySmoothed * ySmoothed;
                    }
                }
                if (ySmoothedCount > 0) {
                    ySmoothedMean = ySmoothedSum / ySmoothedCount;
                    ySmoothedRms = Math.sqrt(ySmoothedSum2 / ySmoothedCount - ySmoothedMean * ySmoothedMean);
                }
            }

            return {
                points: points,
                smoothedPoints: smoothedPoints,
                xBound: xBound,
                yBound: yBound,
                yMean: yMean,
                yRms: yRms,
                startIndex: startIndex,
                endIndex: endIndex,
                ySmoothedMean: ySmoothedMean,
                ySmoothedRms: ySmoothedRms
            };
        } else {
            return undefined;
        }
    };
}

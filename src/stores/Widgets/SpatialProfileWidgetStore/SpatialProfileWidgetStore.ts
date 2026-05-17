import {CARTA} from "carta-protobuf";
import * as _ from "lodash";
import {action, autorun, computed, type IReactionDisposer, makeObservable, observable, override} from "mobx";
import tinycolor from "tinycolor2";

import {LineSettings, PlotType, POLARIZATIONS, RegionId, RegionsType, SpatialProfilerSettingsTabs} from "enums";
import {type LineOption, VALID_XY_COORDINATES} from "models";
import {AppStore, ProfileSmoothingStore} from "stores";
import {type FrameStore, type RegionStore} from "stores/Frame";
import {clamp, isAutoColor} from "utilities";

import {RegionWidgetStore} from "../RegionWidgetStore/RegionWidgetStore";

const DEFAULT_STOKES = "current";

export class SpatialProfileWidgetStore extends RegionWidgetStore {
    @observable coordinate: string = "x";
    @observable selectedStokes: string = DEFAULT_STOKES;
    @observable minX: number | undefined = undefined;
    @observable maxX: number | undefined = undefined;
    @observable minY: number | undefined = undefined;
    @observable maxY: number | undefined = undefined;
    @observable cursorX: number = 0;
    @observable markerTextVisible: boolean = false;
    @observable isMouseMoveIntoLinePlots: boolean = false;

    // settings
    @observable wcsAxisVisible: boolean = true;
    @observable plotType: PlotType = PlotType.STEPS;
    @observable meanRmsVisible: boolean = false;
    @observable primaryLineColor: string = "auto-blue";
    @observable lineWidth: number = 1;
    @observable linePlotPointSize: number = 1.5;
    @observable linePlotInitXYBoundaries: {minXVal: number; maxXVal: number; minYVal: number; maxYVal: number} = {minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0};
    readonly smoothingStore: ProfileSmoothingStore = new ProfileSmoothingStore();
    @observable settingsTabId: SpatialProfilerSettingsTabs = SpatialProfilerSettingsTabs.STYLING;

    private readonly disposers: IReactionDisposer[] = [];

    @override setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
        this.clearXYBounds();
    };

    @action setCoordinate = (coordinate: string) => {
        if (VALID_XY_COORDINATES.includes(coordinate)) {
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

    @action setMouseMoveIntoLinePlots = (val: boolean) => {
        this.isMouseMoveIntoLinePlots = val;
    };

    @action setSettingsTabId = (val: SpatialProfilerSettingsTabs) => {
        this.settingsTabId = val;
    };

    @action setLineRegionSampleWidth = (val: number) => {
        if (this.effectiveRegion) {
            this.effectiveRegion.lineRegionSampleWidth = val;
        }
    };

    constructor(coordinate: string = "x") {
        super(RegionsType.POINT_AND_LINES);
        if (coordinate !== undefined) {
            this.coordinate = coordinate;
        }
        this.disposers.push(
            autorun(() => {
                if (this.effectiveFrame) {
                    action(() => {
                        this.selectedStokes = DEFAULT_STOKES;
                    })();
                }
            })
        );
        makeObservable(this);
    }

    public dispose = () => {
        this.disposers.forEach(disposer => disposer());
        this.disposers.length = 0;
    };

    @computed get isXProfile(): boolean {
        return this.coordinate?.includes("x");
    }

    @computed get isAutoScaledX() {
        return this.minX === undefined || this.maxX === undefined;
    }

    @computed get isAutoScaledY() {
        return this.minY === undefined || this.maxY === undefined;
    }

    @computed get stokesOptions(): LineOption[] {
        const options = [{value: DEFAULT_STOKES, label: "Current"}];
        if (this.effectiveFrame?.hasStokes) {
            options.push(...this.effectiveFrame.coordinateOptions);
        }
        return options;
    }

    @computed get fullCoordinate(): string {
        // stokes(IQUV) + coordinate(x/y)
        const frame = this.effectiveFrame;
        let stokes: string | undefined;
        if (frame?.hasStokes) {
            stokes = this.selectedStokes === DEFAULT_STOKES ? frame.requiredPolarizationInfo : this.selectedStokes;
        }
        return `${stokes?.replace("Stokes ", "") ?? ""}${this.isLineOrPolyline ? "" : this.coordinate}`;
    }

    @computed get isLineOrPolyline(): boolean {
        return this.effectiveRegion?.regionType === CARTA.RegionType.LINE || this.effectiveRegion?.regionType === CARTA.RegionType.POLYLINE;
    }

    @computed get effectivePolarization(): POLARIZATIONS | undefined {
        if (this.selectedStokes === DEFAULT_STOKES) {
            return this.effectiveFrame?.requiredPolarization;
        } else {
            return POLARIZATIONS[this.fullCoordinate.substring(0, this.fullCoordinate.length - 1)];
        }
    }

    private static GetSpatialConfig(frame: FrameStore, coordinate: string, region: RegionStore, lineRegionSampleWidth: number): CARTA.SetSpatialRequirements.ISpatialConfig {
        if (frame.cursorMoving && !AppStore.Instance.cursorFrozen && region?.regionId === RegionId.CURSOR) {
            if (coordinate.includes("x")) {
                return {
                    coordinate,
                    mip: clamp(frame.requiredFrameView.mip, 1, frame.maxMip),
                    start: Math.floor(clamp(frame.requiredFrameView.xMin, 0, frame.frameInfo.fileInfoExtended.width)),
                    end: Math.ceil(clamp(frame.requiredFrameView.xMax, 0, frame.frameInfo.fileInfoExtended.width))
                };
            } else {
                return {
                    coordinate,
                    mip: clamp(frame.requiredFrameView.mip, 1, frame.maxMip),
                    start: Math.floor(clamp(frame.requiredFrameView.yMin, 0, frame.frameInfo.fileInfoExtended.height)),
                    end: Math.ceil(clamp(frame.requiredFrameView.yMax, 0, frame.frameInfo.fileInfoExtended.height))
                };
            }
        } else {
            return {
                coordinate,
                mip: 1,
                width: region?.regionType === CARTA.RegionType.LINE || region?.regionType === CARTA.RegionType.POLYLINE ? lineRegionSampleWidth : undefined
            };
        }
    }

    public static CalculateRequirementsMap(widgetsMap: Map<string, SpatialProfileWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetSpatialRequirements>>();
        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            const fileId = frame?.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;

            if (fileId === undefined || regionId === null || !frame?.regionSet) {
                return;
            }

            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region && !region.isAnnotation) {
                let frameRequirements = updatedRequirements.get(fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetSpatialRequirements>();
                    updatedRequirements.set(fileId, frameRequirements);
                }

                let regionRequirements = frameRequirements.get(regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetSpatialRequirements({regionId, fileId});
                    frameRequirements.set(regionId, regionRequirements);
                }

                if (!regionRequirements.spatialProfiles) {
                    regionRequirements.spatialProfiles = [];
                }

                const existingConfig = regionRequirements.spatialProfiles.find(c => c.coordinate === widgetStore.fullCoordinate);
                if (existingConfig) {
                    // TODO: Merge existing configs, rather than only allowing a single one
                } else {
                    regionRequirements.spatialProfiles.push(SpatialProfileWidgetStore.GetSpatialConfig(frame, widgetStore.fullCoordinate, region, region.lineRegionSampleWidth));
                }
            }
        });
        return updatedRequirements;
    }

    // This function diffs the updated requirements map with the existing requirements map, and reacts to changes
    // Three diff cases are checked:
    // 1. The old map has an entry, but the new one does not => send an "empty" SetSpatialRequirements message
    // 2. The old and new maps both have entries, but they are different => send the new SetSpatialRequirements message
    // 3. The new map has an entry, but the old one does not => send the new SetSpatialRequirements message
    // The easiest way to check all three is to first add any missing entries to the new map (as empty requirements), and then check the updated maps entries
    public static DiffSpatialRequirements(originalRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>) {
        const diffList: CARTA.SetSpatialRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetSpatialRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements?.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetSpatialRequirements({fileId, regionId, spatialProfiles: []});
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
                        const configCount = regionRequirements.spatialProfiles ? regionRequirements.spatialProfiles.length : 0;
                        const updatedConfigCount = updatedRegionRequirements.spatialProfiles ? updatedRegionRequirements.spatialProfiles.length : 0;

                        if (configCount !== updatedConfigCount) {
                            diffList.push(updatedRegionRequirements);
                            return;
                        }

                        if (configCount === 0) {
                            return;
                        }
                        const sortedUpdatedConfigs = updatedRegionRequirements.spatialProfiles.sort();
                        const sortedConfigs = regionRequirements.spatialProfiles.sort();

                        for (let i = 0; i < updatedConfigCount; i++) {
                            const updatedConfig = sortedUpdatedConfigs[i];
                            const config = sortedConfigs[i];
                            if (!_.isEqual(config, updatedConfig)) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }
                        }
                    }
                });
            }
        });
        // Sort list so that requirements clearing occurs first
        return diffList.sort((a, b) => (a.spatialProfiles.length > b.spatialProfiles.length ? 1 : -1));
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

    @action initXYBoundaries(minXVal: number, maxXVal: number, minYVal: number, maxYVal: number) {
        this.linePlotInitXYBoundaries = {minXVal: minXVal, maxXVal: maxXVal, minYVal: minYVal, maxYVal: maxYVal};
    }

    @action setSelectedStokes = (stokes: string) => {
        this.selectedStokes = stokes;
    };

    public init = (widgetSettings): void => {
        if (!widgetSettings) {
            return;
        }
        if (typeof widgetSettings.coordinate === "string" && VALID_XY_COORDINATES.includes(widgetSettings.coordinate)) {
            this.coordinate = widgetSettings.coordinate;
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
        if (typeof widgetSettings.wcsAxisVisible === "boolean") {
            this.wcsAxisVisible = widgetSettings.wcsAxisVisible;
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
            coordinate: this.coordinate,
            primaryLineColor: this.primaryLineColor,
            lineWidth: this.lineWidth,
            linePlotPointSize: this.linePlotPointSize,
            wcsAxisVisible: this.wcsAxisVisible,
            meanRmsVisible: this.meanRmsVisible,
            plotType: this.plotType,
            minXVal: this.linePlotInitXYBoundaries.minXVal,
            maxXVal: this.linePlotInitXYBoundaries.maxXVal,
            minYVal: this.linePlotInitXYBoundaries.minYVal,
            maxYVal: this.linePlotInitXYBoundaries.maxYVal
        };
    };
}

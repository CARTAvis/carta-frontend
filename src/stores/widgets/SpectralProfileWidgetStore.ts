import * as AST from "ast_wrapper";
import {action, autorun, computed, observable} from "mobx";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {PlotType, LineSettings} from "components/Shared";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {AppStore, FrameStore} from "..";
import {isColorValid} from "utilities";
import {DEFAULT_UNIT, GenCoordinateLabel, IsSpectralSystemValid, IsSpectralTypeValid, IsSpectralUnitValid, SpectralSystem, SpectralType, SpectralUnit, SPECTRAL_COORDS_SUPPORTED} from "models";

export class SpectralProfileWidgetStore extends RegionWidgetStore {
    @observable coordinate: string;
    @observable statsType: CARTA.StatsType;
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable channel: number;
    @observable spectralType: SpectralType;
    @observable spectralUnit: SpectralUnit;
    @observable spectralSystem: SpectralSystem;
    @observable channelValues:  Array<number>;
    @observable markerTextVisible: boolean;
    @observable isMouseMoveIntoLinePlots: boolean;

    // settings 
    @observable plotType: PlotType;
    @observable meanRmsVisible: boolean;
    @observable primaryLineColor: { colorHex: string, fixed: boolean };
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
    @observable linePlotInitXYBoundaries: { minXVal: number, maxXVal: number, minYVal: number, maxYVal: number };

    public static StatsTypeString(statsType: CARTA.StatsType) {
        switch (statsType) {
            case CARTA.StatsType.Sum:
                return "Sum";
            case CARTA.StatsType.FluxDensity:
                return "FluxDensity";
            case CARTA.StatsType.Mean:
                return "Mean";
            case CARTA.StatsType.Sigma:
                return "StdDev";
            case CARTA.StatsType.Min:
                return "Min";
            case CARTA.StatsType.Max:
                return "Max";
            case CARTA.StatsType.RMS:
                return "RMS";
            case CARTA.StatsType.SumSq:
                return "SumSq";
            default:
                return "Not Implemented";
        }
    }

    private static ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    private static ValidStatsTypes = [
        CARTA.StatsType.Sum, CARTA.StatsType.FluxDensity, CARTA.StatsType.Mean, CARTA.StatsType.Sigma,
        CARTA.StatsType.Min, CARTA.StatsType.Max, CARTA.StatsType.RMS, CARTA.StatsType.SumSq
    ];

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
        this.clearXYBounds();
    };

    @action setStatsType = (statsType: CARTA.StatsType) => {
        if (SpectralProfileWidgetStore.ValidStatsTypes.indexOf(statsType) !== -1) {
            this.statsType = statsType;
        }
    };

    @action setCoordinate = (coordinate: string) => {
        // Check coordinate validity
        if (SpectralProfileWidgetStore.ValidCoordinates.indexOf(coordinate) !== -1) {
            // Reset zoom when changing between coordinates
            this.clearXYBounds();
            this.coordinate = coordinate;
        }
    };

    @action setSpectralCoordinate = (coordStr: string) => {
        if (SPECTRAL_COORDS_SUPPORTED.has(coordStr)) {
            const coord: {type: SpectralType, unit: SpectralUnit} = SPECTRAL_COORDS_SUPPORTED.get(coordStr);
            this.spectralType = coord.type;
            this.spectralUnit = coord.unit;
            this.clearXBounds();
        }
    };

    @action setSpectralSystem = (specsys: SpectralSystem) => {
        this.spectralSystem = specsys;
        this.clearXBounds();
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

    constructor(appStore: AppStore, coordinate: string = "z") {
        super(appStore, RegionsType.CLOSED_AND_POINT);
        this.coordinate = coordinate;
        this.statsType = CARTA.StatsType.Mean;
        this.initSpectralSettings();

        // Describes how the data is visualised
        this.plotType = PlotType.STEPS;
        this.meanRmsVisible = false;
        this.markerTextVisible = false;
        this.primaryLineColor = { colorHex: Colors.BLUE2, fixed: false };
        this.linePlotPointSize = 1.5;
        this.lineWidth = 1;
        this.linePlotInitXYBoundaries = { minXVal: 0, maxXVal: 0, minYVal: 0, maxYVal: 0 };

        // if type/unit/specsys changes, trigger transformation
        autorun(() => {
            const frame = this.appStore.activeFrame;
            if (frame && frame.channelInfo && this.isSpectralSettingsSupported) {
                if (this.isCoordChannel) {
                    this.channelValues = frame.channelInfo.indexes;
                } else {
                    this.channelValues = this.isSpectralPropsEqual ? frame.channelInfo.values : this.convertSpectral(frame.spectralFrame, this.spectralType, this.spectralUnit, this.spectralSystem, frame.channelInfo.values);
                }
            }
        });
    }

    private convertSpectral = (spectralFrame: number, type: SpectralType, unit: SpectralUnit, system: SpectralSystem, x: Array<number>): Array<number> => {
        if (!spectralFrame || !type || !unit || !system || !x) {
            return null;
        }
        let tx: Array<number> = new Array<number>(x.length);
        for (let i = 0; i < x.length; i++) {
            tx[i] = AST.transformSpectralPoint(this.appStore.activeFrame.spectralFrame, this.spectralType, this.spectralUnit, this.spectralSystem, x[i]);
        }
        return tx;
    };

    public initSpectralSettings = () => {
        const frame = this.appStore.activeFrame;
        if (frame && frame.spectralInfo && this.isSpectralSettingsSupported) {
            this.spectralType = frame.spectralInfo.channelType.code as SpectralType;
            this.spectralUnit = DEFAULT_UNIT.get(this.spectralType);
            this.spectralSystem = frame.spectralInfo.specsys as SpectralSystem;
        } else {
            this.spectralType = null;
            this.spectralUnit = null;
            this.spectralSystem = null;
        }

        this.channelValues = null;
        if (frame && frame.channelInfo) {
            if (this.isCoordChannel) {
                this.channelValues = frame.channelInfo.indexes;
            } else {
                this.channelValues = this.isSpectralPropsEqual ? frame.channelInfo.values : this.convertSpectral(frame.spectralFrame, this.spectralType, this.spectralUnit, this.spectralSystem, frame.channelInfo.values);
            }
        }
    };

    // check the type, unit, specsys are the same between widget and active frame
    @computed get isSpectralPropsEqual(): boolean {
        const appStore = this.appStore;
        const frame = appStore.activeFrame;
        let result = false;
        if (frame && frame.spectralInfo) {
            const isTypeEqual = frame.spectralInfo.channelType.code === (this.spectralType as string);
            const isUnitEqual = frame.spectralInfo.channelType.unit === (this.spectralUnit as string);
            const isSpecsysEqual = frame.spectralInfo.specsys === (this.spectralSystem as string);
            result = isTypeEqual && isUnitEqual && isSpecsysEqual;
        }
        return result;
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }

    @computed get spectralCoordinate() {
        return this.spectralType && this.spectralUnit ? GenCoordinateLabel(this.spectralType, this.spectralUnit) : "Channel";
    }

    @computed get isCoordChannel() {
        return this.spectralCoordinate === "Channel";
    }

    @computed get isSpectralCoordinateSupported(): boolean {
        const frame = this.appStore.activeFrame;
        if (frame && frame.spectralInfo) {
            const type = frame.spectralInfo.channelType.code as string;
            const unit = frame.spectralInfo.channelType.unit as string;
            return type && unit && IsSpectralTypeValid(type) && IsSpectralUnitValid(unit);
        }
        return false;
    }

    @computed get isSpectralSystemSupported(): boolean {
        const frame = this.appStore.activeFrame;
        if (frame && frame.spectralInfo) {
            const specsys = frame.spectralInfo.specsys as string;
            return specsys && IsSpectralSystemValid(specsys);
        }
        return false;
    }

    @computed get isSpectralSettingsSupported(): boolean {
        return this.isSpectralCoordinateSupported && this.isSpectralSystemSupported;
    }

    public static CalculateRequirementsMap(frame: FrameStore, widgetsMap: Map<string, SpectralProfileWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetSpectralRequirements>>();
        widgetsMap.forEach(widgetStore => {
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;
            const coordinate = widgetStore.coordinate;
            let statsType = widgetStore.statsType;

            if (!frame.regionSet) {
                return;
            }
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region) {
                // Point regions have no meaningful stats type, default to Sum
                if (region.regionType === CARTA.RegionType.POINT) {
                    statsType = CARTA.StatsType.Sum;
                }

                let frameRequirements = updatedRequirements.get(fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetSpectralRequirements>();
                    updatedRequirements.set(fileId, frameRequirements);
                }

                let regionRequirements = frameRequirements.get(regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetSpectralRequirements({regionId, fileId});
                    frameRequirements.set(regionId, regionRequirements);
                }

                if (!regionRequirements.spectralProfiles) {
                    regionRequirements.spectralProfiles = [];
                }

                let spectralConfig = regionRequirements.spectralProfiles.find(profiles => profiles.coordinate === coordinate);
                if (!spectralConfig) {
                    // create new spectral config
                    regionRequirements.spectralProfiles.push({coordinate, statsTypes: [statsType]});
                } else if (spectralConfig.statsTypes.indexOf(statsType) === -1) {
                    // add to the stats type array
                    spectralConfig.statsTypes.push(statsType);
                }
            }
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
    @action setPrimaryLineColor = (colorHex: string, fixed: boolean) => {
        this.primaryLineColor = { colorHex: colorHex, fixed: fixed };
    }

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
        if (typeof widgetSettings.primaryLineColor === "string" && isColorValid(widgetSettings.primaryLineColor)) {
            this.primaryLineColor.colorHex = widgetSettings.primaryLineColor;
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
            primaryLineColor: this.primaryLineColor.colorHex,
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
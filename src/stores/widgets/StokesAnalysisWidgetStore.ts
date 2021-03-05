import {action, computed, observable, makeObservable, override} from "mobx";
import {ChartArea} from "chart.js";
import {CARTA} from "carta-protobuf";
import {PlotType, LineSettings, ScatterSettings} from "components/Shared";
import {RegionWidgetStore, RegionsType} from "./RegionWidgetStore";
import {getColorsForValues, isAutoColor} from "utilities";
import {SpectralSystem, SpectralType, SpectralUnit} from "models";
import tinycolor from "tinycolor2";
import {ProfileSmoothingStore} from "stores/ProfileSmoothingStore";
import {StokesAnalysisSettingsTabs} from "components";

export enum StokesCoordinate {
    CurrentZ = "z",
    TotalIntensity = "Iz",
    LinearPolarizationQ = "Qz",
    LinearPolarizationU = "Uz",
    CircularPolarization = "Vz",
    PolarizedIntensity = "PIz",
    PolarizationAngle = "PAz",
    PolarizationQU = "QvsU",
}

const DEFAULTS = {
        fractionalPolVisible: false,
        scatterOutRangePointsZIndex: [],
        primaryLineColor: "auto-blue",
        secondaryLineColor: "auto-orange",
        lineWidth: 1,
        linePlotPointSize: 1.5,
        scatterPlotPointSize: 3,
        equalAxes: true,
        colorMap: "jet",
        pointTransparency: 1,
        invertedColorMap: false
};

export class StokesAnalysisWidgetStore extends RegionWidgetStore {
    @observable sharedMinX: number;
    @observable sharedMaxX: number;
    @observable quMinY: number;
    @observable quMaxY: number;
    @observable polIntensityMinY: number;
    @observable polIntensityMaxY: number;
    @observable polAngleMinY: number;
    @observable polAngleMaxY: number;
    @observable quScatterMinX: number;
    @observable quScatterMaxX: number;
    @observable quScatterMinY: number;
    @observable quScatterMaxY: number;
    @observable linePlotcursorX: number;
    @observable channel: number;
    @observable scatterPlotCursorX: number;
    @observable scatterPlotCursorY: number;
    @observable isMouseMoveIntoScatterPlots: boolean;
    @observable isMouseMoveIntoLinePlots: boolean;
    @observable scatterChartArea: ChartArea;
    @observable statsType: CARTA.StatsType;
    @observable fractionalPolVisible: boolean;
    scatterOutRangePointsZIndex: Array<number>;

    // settings 
    @observable plotType: PlotType;
    @observable primaryLineColor: string;
    @observable secondaryLineColor: string;
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
    @observable scatterPlotPointSize: number;
    @observable equalAxes: boolean;
    @observable colorMap: string;
    @observable colorPixel: { color: Uint8ClampedArray, size: number };
    @observable pointTransparency: number;
    @observable invertedColorMap: boolean;
    readonly smoothingStore: ProfileSmoothingStore;
    @observable settingsTabId: StokesAnalysisSettingsTabs;
    
    private static requestDataType = [StokesCoordinate.LinearPolarizationQ, StokesCoordinate.LinearPolarizationU];
    private static ValidStatsTypes = [
        CARTA.StatsType.Mean,
    ];

    // return regionRequirements spectralProfiles coordinate array
    private static requiredCoordinate(widgetStore: StokesAnalysisWidgetStore): Array<StokesCoordinate> {
        let requiredCoordinate = StokesAnalysisWidgetStore.requestDataType;
        let Iz = requiredCoordinate.indexOf(StokesCoordinate.TotalIntensity);
        if (widgetStore.fractionalPolVisible) {
            if (Iz < 0 ) {
                requiredCoordinate.push(StokesCoordinate.TotalIntensity);
            }
        }
        return requiredCoordinate;
    }

    public static addToRequirementsMap(updatedRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>, widgetsMap: Map<string, StokesAnalysisWidgetStore>)
        : Map<number, Map<number, CARTA.SetSpectralRequirements>> {
        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            if (frame && frame.hasStokes) {
                const fileId = frame.frameInfo.fileId;
                const regionId = widgetStore.effectiveRegionId;
                const coordinates = StokesAnalysisWidgetStore.requiredCoordinate(widgetStore);
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

                    coordinates.forEach(coordinate => {
                        let spectralConfig = regionRequirements.spectralProfiles.find(profiles => profiles.coordinate === coordinate);
                        if (!spectralConfig) {
                            // create new spectral config
                            regionRequirements.spectralProfiles.push({coordinate, statsTypes: [statsType]});
                        } else if (spectralConfig.statsTypes.indexOf(statsType) === -1) {
                            // add to the stats type array
                            spectralConfig.statsTypes.push(statsType);
                        }
                    });
                }
            }
        });
        return updatedRequirements;
    }

    @action setScatterChartAres = (chartArea: ChartArea) => {
        this.scatterChartArea = chartArea;
    }

    @action setMouseMoveIntoScatterPlots = (val: boolean) => {
        this.isMouseMoveIntoScatterPlots = val;
    };

    @action setMouseMoveIntoLinePlots = (val: boolean) => {
        this.isMouseMoveIntoLinePlots = val;
    };

    @action setStatsType = (statsType: CARTA.StatsType) => {
        if (StokesAnalysisWidgetStore.ValidStatsTypes.indexOf(statsType) !== -1) {
            this.statsType = statsType;
        }
    };

    @action setSpectralCoordinate = (coordStr: string) => {
        const frame = this.effectiveFrame;
        if (frame && frame.spectralCoordsSupported && frame.spectralCoordsSupported.has(coordStr)) {
            const coord: {type: SpectralType, unit: SpectralUnit} = frame.spectralCoordsSupported.get(coordStr);
            frame.spectralType = coord.type;
            frame.spectralUnit = coord.unit;
            this.clearSharedXBounds();
        }
    };

    @action setSpectralSystem = (specsys: SpectralSystem) => {
        const frame = this.effectiveFrame;
        if (frame && frame.spectralSystemsSupported && frame.spectralSystemsSupported.includes(specsys)) {
            frame.spectralSystem = specsys;
            this.clearSharedXBounds();
        }
    };

    @action setSharedXBounds = (minVal: number, maxVal: number) => {
        this.sharedMinX = minVal;
        this.sharedMaxX = maxVal;
    };

    @action clearSharedXBounds = () => {
        this.sharedMinX = undefined;
        this.sharedMaxX = undefined;
    };

    @action setPolIntensityYBounds = (minVal: number, maxVal: number) => {
        this.polIntensityMinY = minVal;
        this.polIntensityMaxY = maxVal;
    };

    @action clearPolIntensityYBounds = () => {
        this.polIntensityMinY = undefined;
        this.polIntensityMaxY = undefined;
    };

    @action setChannel = (channel: number) => {
        this.channel = channel;
    };

    @action setlinePlotCursorX = (cursorVal: number) => {
        this.linePlotcursorX = cursorVal;
    };

    @action setScatterPlotCursor = (cursorVal: { x: number, y: number }) => {
        this.scatterPlotCursorX = cursorVal.x;
        this.scatterPlotCursorY = cursorVal.y;
    };

    @action setFractionalPolVisible = (val: boolean) => {
        this.fractionalPolVisible = val;
        this.clearScatterPlotXYBounds();
    };

    @override setRegionId(fileId: number, regionId: number) {
        this.regionIdMap.set(fileId, regionId);
        this.clearLinePlotsXYBounds();
        this.clearScatterPlotXYBounds();
    };

    constructor() {
        super(RegionsType.CLOSED_AND_POINT);
        makeObservable(this);
        this.colorMap = DEFAULTS.colorMap;
        this.colorPixel = getColorsForValues(DEFAULTS.colorMap);
        this.statsType = CARTA.StatsType.Mean;
        this.plotType = PlotType.STEPS;
        this.fractionalPolVisible = DEFAULTS.fractionalPolVisible;
        this.scatterOutRangePointsZIndex = DEFAULTS.scatterOutRangePointsZIndex;
        this.primaryLineColor = DEFAULTS.primaryLineColor;
        this.secondaryLineColor = DEFAULTS.secondaryLineColor;
        this.lineWidth = DEFAULTS.lineWidth;
        this.linePlotPointSize = DEFAULTS.linePlotPointSize;
        this.scatterPlotPointSize = DEFAULTS.scatterPlotPointSize;
        this.equalAxes = DEFAULTS.equalAxes;
        this.pointTransparency = DEFAULTS.pointTransparency;
        this.smoothingStore = new ProfileSmoothingStore();
        this.settingsTabId = StokesAnalysisSettingsTabs.CONVERSION;
        this.invertedColorMap  = DEFAULTS.invertedColorMap;
    }

    @action setQUScatterPlotXBounds = (minVal: number, maxVal: number) => {
        this.quScatterMinX = minVal;
        this.quScatterMaxX = maxVal;
    };

    @action setPolAngleYBounds = (minVal: number, maxVal: number) => {
        this.polAngleMinY = minVal;
        this.polAngleMaxY = maxVal;
    };

    @action setQULinePlotYBounds = (minVal: number, maxVal: number) => {
        this.quMinY = minVal;
        this.quMaxY = maxVal;
    };

    @action setQUScatterPlotYBounds = (minVal: number, maxVal: number) => {
        this.quScatterMinY = minVal;
        this.quScatterMaxY = maxVal;
    };

    @action clearLinePlotsXYBounds = () => {
        this.sharedMinX = undefined;
        this.sharedMaxX = undefined;
        this.quMinY = undefined;
        this.quMaxY = undefined;
        this.polIntensityMinY = undefined;
        this.polIntensityMaxY = undefined;
        this.polAngleMinY = undefined;
        this.polAngleMaxY = undefined;
    };

    @action clearScatterPlotXYBounds = () => {
        this.quScatterMinX = undefined;
        this.quScatterMaxX = undefined;
        this.quScatterMinY = undefined;
        this.quScatterMaxY = undefined;
        this.scatterOutRangePointsZIndex = [];
    };

    @action setQULinePlotsXYBounds = (minX: number, maxX: number, minY: number, maxY: number) => {
        this.sharedMinX = minX;
        this.sharedMaxX = maxX;
        this.quMinY = minY;
        this.quMaxY = maxY;
    };

    @action setPolIntensityXYBounds = (minX: number, maxX: number, minY: number, maxY: number) => {
        this.sharedMinX = minX;
        this.sharedMaxX = maxX;
        this.polIntensityMinY = minY;
        this.polIntensityMaxY = maxY;
    };

    @action setPolAngleXYBounds = (minX: number, maxX: number, minY: number, maxY: number) => {
        this.sharedMinX = minX;
        this.sharedMaxX = maxX;
        this.polAngleMinY = minY;
        this.polAngleMaxY = maxY;
    };

    @action setQUScatterPlotXYBounds = (minX: number, maxX: number, minY: number, maxY: number) => {
        this.quScatterMinX = minX;
        this.quScatterMaxX = maxX;
        this.quScatterMinY = minY;
        this.quScatterMaxY = maxY;
    };

    // settings
    @action setInvertedColorMap = (invertedColorMap: boolean) => {
        this.invertedColorMap = invertedColorMap;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setPrimaryLineColor = (color: string) => {
        this.primaryLineColor = color;
    }

    @action setSecondaryLineColor = (color: string) => {
        this.secondaryLineColor = color;
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

    @action setScatterPlotPointSize = (val: number) => {
        if (val >= ScatterSettings.MIN_POINT_SIZE && val <= ScatterSettings.MAX_POINT_SIZE ) {
            this.scatterPlotPointSize = val;   
        }
    }

    @action setEqualAxesValue = (val: boolean) => {
        this.equalAxes = val;
    }

    @action setColormap = (colormap: string) => {
        this.colorMap = colormap;
        this.colorPixel = getColorsForValues(colormap);
    };

    @action setPointTransparency = (val: number) => {
        if (val >= ScatterSettings.MIN_TRANSPARENCY && val <= ScatterSettings.MAX_TRANSPARENCY) {
            this.pointTransparency = val;   
        }
    }

    @action setSettingsTabId = (tabId: StokesAnalysisSettingsTabs) => {
        this.settingsTabId = tabId;
    }

    @computed get isLinePlotsAutoScaledX() {
        return (this.sharedMinX === undefined || this.sharedMaxX === undefined);
    }

    @computed get isQUScatterPlotAutoScaledX() {
        return (this.quScatterMinX === undefined || this.quScatterMaxX === undefined);
    }

    @computed get isQUScatterPlotAutoScaledY() {
        return (this.quScatterMinY === undefined || this.quScatterMaxY === undefined);
    }

    @computed get isQULinePlotAutoScaledY() {
        return (this.quMinY === undefined || this.quMaxY === undefined);
    }

    @computed get isPolIntensityAutoScaledY() {
        return (this.polIntensityMinY === undefined || this.polIntensityMaxY === undefined);
    }

    @computed get isPolAngleAutoScaledY() {
        return (this.polAngleMinY === undefined || this.polAngleMaxY === undefined);
    }

    public init = (widgetSettings): void => {
        if (!widgetSettings) {
            return;
        }
        const lineColor = tinycolor(widgetSettings.primaryLineColor);
        if (lineColor.isValid() || isAutoColor(widgetSettings.primaryLineColor)) {
            this.primaryLineColor = widgetSettings.primaryLineColor;
        }
        const secondaryLineColor = tinycolor(widgetSettings.secondaryLineColor);
        if (secondaryLineColor.isValid() || isAutoColor(widgetSettings.secondaryLineColor)) {
            this.secondaryLineColor = widgetSettings.secondaryLineColor;
        }
        if (typeof widgetSettings.lineWidth === "number" && widgetSettings.lineWidth >= LineSettings.MIN_WIDTH && widgetSettings.lineWidth <= LineSettings.MAX_WIDTH) {
            this.lineWidth = widgetSettings.lineWidth;
        }
        if (typeof widgetSettings.linePlotPointSize === "number" && widgetSettings.linePlotPointSize >= LineSettings.MIN_POINT_SIZE && widgetSettings.linePlotPointSize <= LineSettings.MAX_POINT_SIZE) {
            this.linePlotPointSize = widgetSettings.linePlotPointSize;
        }
        if (typeof widgetSettings.plotType === "string" && (widgetSettings.plotType === PlotType.STEPS || widgetSettings.plotType === PlotType.LINES || widgetSettings.plotType === PlotType.POINTS)) {
            this.plotType = widgetSettings.plotType;
        }
        if (typeof widgetSettings.colorMap === "string") {
            this.colorMap = widgetSettings.colorMap;
        }
        if (typeof widgetSettings.scatterPlotPointSize === "number" && widgetSettings.scatterPlotPointSize >= ScatterSettings.MIN_POINT_SIZE && widgetSettings.scatterPlotPointSize <= ScatterSettings.MAX_POINT_SIZE ) {
            this.scatterPlotPointSize = widgetSettings.scatterPlotPointSize;
        }
        if (typeof widgetSettings.pointTransparency === "number" && widgetSettings.pointTransparency >= ScatterSettings.MIN_TRANSPARENCY && widgetSettings.pointTransparency <= ScatterSettings.MAX_TRANSPARENCY) {
            this.pointTransparency = widgetSettings.pointTransparency;
        }
        if (typeof widgetSettings.equalAxes === "boolean") {
            this.equalAxes = widgetSettings.equalAxes;
        }
    };

    public toConfig = () => {
        return {
            primaryLineColor: this.primaryLineColor,
            secondaryLineColor: this.secondaryLineColor,
            lineWidth: this.lineWidth,
            linePlotPointSize: this.linePlotPointSize,
            plotType: this.plotType,
            colorMap: this.colorMap,
            scatterPlotPointSize: this.scatterPlotPointSize,
            pointTransparency: this.pointTransparency,
            equalAxes: this.equalAxes
        };
    };
}
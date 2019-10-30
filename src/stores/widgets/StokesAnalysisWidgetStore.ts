import {action, computed, observable, values} from "mobx";
import {ChartArea} from "chart.js";
import {Colors} from "@blueprintjs/core";
import {CARTA} from "carta-protobuf";
import {PlotType} from "components/Shared";
import {RegionWidgetStore} from "./RegionWidgetStore";
import {FrameStore} from "stores";
import {getColorsForValues} from "utilities";

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
        useWcsValues: true,
        scatterOutRangePointsZIndex: [],
        primaryLineColor: { colorHex: Colors.BLUE2, fixed: false },
        secondaryLineColor: { colorHex: Colors.ORANGE2, fixed: false },
        lineWidth: 1,
        linePlotPointSize: 1.5,
        scatterPlotPointSize: 3,
        equalAxes: true,
        colorMap: "jet",
        pointTransparency: 1
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
    @observable useWcsValues: boolean;
    @observable plotType: PlotType;
    @observable primaryLineColor: { colorHex: string, fixed: boolean };
    @observable secondaryLineColor: { colorHex: string, fixed: boolean };
    @observable lineWidth: number;
    @observable linePlotPointSize: number;
    @observable scatterPlotPointSize: number;
    @observable equalAxes: boolean;
    @observable colorMap: string;
    @observable colorPixel: { color: Uint8ClampedArray, size: number };
    @observable pointTransparency: number;

    static readonly MIN_LINE_WIDTH = 0.5;
    static readonly MAX_LINE_WIDTH = 10;
    static readonly MIN_LINE_POINT_SIZE = 0.5;
    static readonly MIN_SCATTER_POINT_SIZE = 0.5;
    static readonly MAX_POINT_SIZE = 10;
    static readonly MIN_POINT_TRANSPARENCY = 0.1;
    static readonly MAX_POINT_TRANSPARENCY = 1;
    
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

    public static addToRequirementsMap(frame: FrameStore, updatedRequirements: Map<number, Map<number, CARTA.SetSpectralRequirements>>, widgetsMap: Map<string, StokesAnalysisWidgetStore>)
        : Map<number, Map<number, CARTA.SetSpectralRequirements>> {
        widgetsMap.forEach(widgetStore => {
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.regionIdMap.get(fileId) || 0;
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

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
        this.clearLinePlotsXYBounds();
        this.clearScatterPlotXYBounds();
    };

    @action setUseWcsValues = (val: boolean) => {
        if (val !== this.useWcsValues) {
            this.clearSharedXBounds();
        }
        this.useWcsValues = val;
    };

    constructor() {
        super();
        this.colorMap = DEFAULTS.colorMap;
        this.colorPixel = getColorsForValues(DEFAULTS.colorMap);
        this.statsType = CARTA.StatsType.Mean;
        this.plotType = PlotType.STEPS;
        this.fractionalPolVisible = DEFAULTS.fractionalPolVisible;
        this.useWcsValues = DEFAULTS.useWcsValues;
        this.scatterOutRangePointsZIndex = DEFAULTS.scatterOutRangePointsZIndex;
        this.primaryLineColor = DEFAULTS.primaryLineColor;
        this.secondaryLineColor = DEFAULTS.secondaryLineColor;
        this.lineWidth = DEFAULTS.lineWidth;
        this.linePlotPointSize = DEFAULTS.linePlotPointSize;
        this.scatterPlotPointSize = DEFAULTS.scatterPlotPointSize;
        this.equalAxes = DEFAULTS.equalAxes;
        this.pointTransparency = DEFAULTS.pointTransparency;
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
    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setPrimaryLineColor = (colorHex: string, fixed: boolean) => {
        this.primaryLineColor = { colorHex: colorHex, fixed: fixed };
    }

    @action setSecondaryLineColor = (colorHex: string, fixed: boolean) => {
        this.secondaryLineColor = { colorHex: colorHex, fixed: fixed };
    }

    @action setLineWidth = (val: number) => {
        if (val >= StokesAnalysisWidgetStore.MIN_LINE_WIDTH && val <= StokesAnalysisWidgetStore.MAX_LINE_WIDTH) {
            this.lineWidth = val;   
        }
    }

    @action setLinePlotPointSize = (val: number) => {
        if (val >= StokesAnalysisWidgetStore.MIN_LINE_POINT_SIZE && val <= StokesAnalysisWidgetStore.MAX_POINT_SIZE) {
            this.linePlotPointSize = val;   
        }
    }

    @action setScatterPlotPointSize = (val: number) => {
        if (val >= StokesAnalysisWidgetStore.MIN_SCATTER_POINT_SIZE && val <= StokesAnalysisWidgetStore.MAX_POINT_SIZE ) {
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
        if (val >= StokesAnalysisWidgetStore.MIN_POINT_TRANSPARENCY && val <= StokesAnalysisWidgetStore.MAX_POINT_TRANSPARENCY) {
            this.pointTransparency = val;   
        }
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
}
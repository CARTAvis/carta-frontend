import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {PlotType} from "components/Shared";
import {RegionWidgetStore} from "./RegionWidgetStore";

export class SpectralProfileWidgetStore extends RegionWidgetStore {
    @observable coordinate: string;
    @observable statsType: CARTA.StatsType;
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable channel: number;
    @observable plotType: PlotType;
    @observable settingsPanelVisible: boolean;
    @observable meanRmsVisible: boolean;
    @observable useWcsValues: boolean;
    @observable markerTextVisible: boolean;

    private static ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    private static ValidStatsTypes = [
        CARTA.StatsType.None, CARTA.StatsType.Sum, CARTA.StatsType.FluxDensity, CARTA.StatsType.Mean, CARTA.StatsType.RMS,
        CARTA.StatsType.Sigma, CARTA.StatsType.SumSq, CARTA.StatsType.Min, CARTA.StatsType.Max];

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

    @action setUseWcsValues = (val: boolean) => {
        if (val !== this.useWcsValues) {
            this.clearXBounds();
        }
        this.useWcsValues = val;
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

    constructor(coordinate: string = "z") {
        super();
        this.coordinate = coordinate;
        this.statsType = CARTA.StatsType.Mean;

        // Describes how the data is visualised
        this.plotType = PlotType.STEPS;
        this.settingsPanelVisible = false;
        this.meanRmsVisible = false;
        this.markerTextVisible = false;
        this.useWcsValues = true;
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }
}
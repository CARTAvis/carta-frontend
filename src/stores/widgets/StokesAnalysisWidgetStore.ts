import {action, computed, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {RegionWidgetStore} from "./RegionWidgetStore";
import {FrameStore} from "stores/FrameStore";

export enum StokesCoordinate {
    CurrentZ = "z",
    TotalIntensity = "Iz",
    LinearPolarizationQ = "Qz",
    LinearPolarizationU = "Uz",
    CircularPolarization = "Vz",
    PolarizedIntensity = "PIz",
    PolarizationAngle = "PAz"
}

export enum StokesCoordinateLabel {
    CurrentZLabel = "Current",
    TotalIntensityLabel = "I",
    LinearPolarizationQLabel = "Q",
    LinearPolarizationULabel = "U",
    CircularPolarizationLabel = "V",
    PolarizedIntensityLabel = "Pol. Intensity",
    PolarizationAngleLabel = "Pol. Angle"
}

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
    @observable cursorX: number;
    @observable channel: number;
    @observable useWcsValues: boolean;
    
    @observable statsType: CARTA.StatsType;
    @observable fractionalPolVisible: boolean;

    private static requestDataType = [StokesCoordinate.LinearPolarizationQ, StokesCoordinate.LinearPolarizationU];
    
    private static ValidStatsTypes = [
        CARTA.StatsType.Mean,
    ];
    // return regionRequirements spectralProfiles coordinate array
    private static requiredCoordinate(widgetStore: StokesAnalysisWidgetStore): Array<StokesCoordinate> {
        let requiredCoordinate = StokesAnalysisWidgetStore.requestDataType;

        if (widgetStore.fractionalPolVisible) {
            requiredCoordinate.push(StokesCoordinate.TotalIntensity);
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

    @action clearXYBounds = () => {
        this.sharedMinX = undefined;
        this.sharedMaxX = undefined;
        this.quMinY = undefined;
        this.quMaxY = undefined;
        this.polIntensityMinY = undefined;
        this.polIntensityMaxY = undefined;
        this.polAngleMinY = undefined;
        this.polAngleMaxY = undefined;
        this.quScatterMinX = undefined;
        this.quScatterMaxX = undefined;
        this.quScatterMinY = undefined;
        this.quScatterMaxY = undefined;
    };

    @action setChannel = (channel: number) => {
        this.channel = channel;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    @action setFractionalPolVisible = (val: boolean) => {
        this.fractionalPolVisible = val;
    };

    @action setRegionId = (fileId: number, regionId: number) => {
        this.regionIdMap.set(fileId, regionId);
        this.clearXYBounds();
    };

    @action setUseWcsValues = (val: boolean) => {
        if (val !== this.useWcsValues) {
            this.clearSharedXBounds();
        }
        this.useWcsValues = val;
    };

    constructor() {
        super();
        this.statsType = CARTA.StatsType.Mean;

        // Describes how the data is visualised
        this.fractionalPolVisible = false;
        this.useWcsValues = true;
    }

    @computed get isAutoScaledX() {
        return (this.sharedMinX === undefined || this.sharedMaxX === undefined);
    }

    // @computed get isAutoScaledY() {
    //     return (this.minY === undefined || this.maxY === undefined);
    // }
}
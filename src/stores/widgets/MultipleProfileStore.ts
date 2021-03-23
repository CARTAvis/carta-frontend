import {action, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "..";
import {RegionId, SpectralProfileWidgetStore} from ".";
import {ProfileItemOptionProps} from "components";
import {STATISTICS_TEXT, SUPPORTED_STATISTICS_TYPES} from "models";

export enum ProfileCategory {
    IMAGE = "Image",
    REGION = "Region",
    STATISTICS = "Statistics",
    STOKES = "Stokes"
}

type SpectralConfig = CARTA.SetSpectralRequirements.ISpectralConfig;

export class MultipleProfileStore {
    // profile selection
    @observable profileCategory: ProfileCategory;
    @observable selectedRegions: number[];
    @observable selectedStatsTypes: CARTA.StatsType[];
    @observable selectedCoordinates: string[];

    private readonly widgetStore: SpectralProfileWidgetStore;
    private defaultStatsType: CARTA.StatsType = CARTA.StatsType.Mean;
    private defaultCoordinate: string;
    private profileStatsOptionTemplate: ProfileItemOptionProps[] = Array.from(STATISTICS_TEXT.entries()).map(entry => {
        return {
            value: entry[0],
            label: entry[1],
            enable: true
        };
    });
    private static ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    public getProfileConfigs = (): SpectralConfig[] => {
        let profileConfigs: SpectralConfig[] = [];
        if (this.profileCategory === ProfileCategory.IMAGE) {
            // TODO: wire up profiles of matching images
            const statsType = this.widgetStore.effectiveRegion?.isClosedRegion ? this.defaultStatsType : CARTA.StatsType.Sum;
            profileConfigs.push({statsTypes: [statsType], coordinate: this.defaultCoordinate});
        } else if (this.profileCategory === ProfileCategory.REGION) {
            // TODO: how to create multiple region profile?
            const statsType = this.widgetStore.effectiveRegion?.isClosedRegion ? this.defaultStatsType : CARTA.StatsType.Sum;
            this.selectedRegions?.forEach(region => {
                profileConfigs.push({statsTypes: [statsType], coordinate: this.defaultCoordinate});
            });
        } else if (this.profileCategory === ProfileCategory.STATISTICS) {
            profileConfigs.push({statsTypes: this.widgetStore.effectiveRegion?.isClosedRegion ? [...this.selectedStatsTypes] : [CARTA.StatsType.Sum], coordinate: this.defaultCoordinate});
        } else if (this.profileCategory === ProfileCategory.STOKES) {
            const statsType = this.widgetStore.effectiveRegion?.isClosedRegion ? this.defaultStatsType : CARTA.StatsType.Sum;
            this.selectedCoordinates?.forEach(coordinate => {
                profileConfigs.push({statsTypes: [statsType], coordinate: coordinate});
            });
        }
        return profileConfigs;
    };

    @computed get frameOptions(): ProfileItemOptionProps[] {
        return AppStore.Instance.frameNames;
    }

    @computed get regionOptions(): ProfileItemOptionProps[] {
        let options = [];
        const widgetStore = this.widgetStore;
        if (widgetStore.effectiveFrame && widgetStore.effectiveFrame.regionSet) {
            const regions = widgetStore.effectiveFrame.regionSet.regions;
            const fiteredRegions = regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT));
            options = options.concat(fiteredRegions?.map(r => {return {value: r.regionId, label: r.nameString};}));
        }
        return options;
    }

    @computed get statsTypeOptions(): ProfileItemOptionProps[] {
        if (this.selectedStatsTypes?.length === 0) {
            this.profileStatsOptionTemplate.forEach(option => option.disable = false);
        } else if (this.selectedStatsTypes?.includes(CARTA.StatsType.FluxDensity)) {
            this.profileStatsOptionTemplate.forEach(option => option.disable = option.value !== CARTA.StatsType.FluxDensity);
        } else if (this.selectedStatsTypes?.includes(CARTA.StatsType.SumSq)) {
            this.profileStatsOptionTemplate.forEach(option => option.disable = option.value !== CARTA.StatsType.SumSq);
        } else {
            this.profileStatsOptionTemplate.forEach(option => option.disable = option.value === CARTA.StatsType.FluxDensity || option.value === CARTA.StatsType.SumSq);
        }
        return this.profileStatsOptionTemplate;
    }

    @computed get coordinateOptions(): ProfileItemOptionProps[] {
        let options = [{value: "z", label: "Current"}];
        this.selectedFrame?.stokesInfo?.forEach(stokes => options.push({value: `${stokes}z`, label: stokes}));
        return options;
    }

    @computed get selectedFrame(): FrameStore {
        return this.widgetStore.effectiveFrame;
    }

    @computed get selectedFrameFileId(): number {
        return this.widgetStore.effectiveFrame?.frameInfo.fileId;
    }

    @computed get isStatsTypeFluxDensity(): boolean {
        return this.selectedStatsTypes?.includes(CARTA.StatsType.FluxDensity);
    }

    @computed get isStatsTypeSumSq(): boolean {
        return this.selectedStatsTypes?.includes(CARTA.StatsType.SumSq);
    }

    @action setProfileCategory = (profileCategory: ProfileCategory) => {
        this.profileCategory = profileCategory;
        // Reset region/statistics/stokes selected option when switching profile category
        // TODO: missing handling for image
        if (profileCategory === ProfileCategory.IMAGE) {
            this.selectedRegions = [RegionId.CURSOR];
            this.selectedStatsTypes = [this.defaultStatsType];
            this.selectedCoordinates = [this.defaultCoordinate];
        } else if (profileCategory === ProfileCategory.REGION) {
            this.selectedStatsTypes = [this.defaultStatsType];
            this.selectedCoordinates = [this.defaultCoordinate];
        } else if (profileCategory === ProfileCategory.STATISTICS) {
            this.selectedRegions = [RegionId.CURSOR];
            this.selectedCoordinates = [this.defaultCoordinate];
        } else if (profileCategory === ProfileCategory.STOKES) {
            this.selectedRegions = [RegionId.CURSOR];
            this.selectedStatsTypes = [this.defaultStatsType];
        }
    };

    @action selectFrame = (fileId: number) => {
        // TODO: error handling for fileId
        this.widgetStore.setFileId(fileId);
    };

    @action selectRegion = (regionId: number) => {
        // if () { TODO: error handling for regionId
            if (this.selectedRegions?.includes(regionId)) {
                this.selectedRegions = this.selectedRegions.filter(region => region !== regionId);
            } else {
                this.selectedRegions = [...this.selectedRegions, regionId];
            }
        // }
    };

    @action selectStatsType = (statsType: CARTA.StatsType) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            if (this.selectedStatsTypes?.includes(statsType)) {
                this.selectedStatsTypes = this.selectedStatsTypes.filter(type => type !== statsType);
            } else {
                this.selectedStatsTypes = [...this.selectedStatsTypes, statsType];
            }
        }
    };

    @action selectCoordinate = (coordinate: string) => {
        if (MultipleProfileStore.ValidCoordinates.includes(coordinate)) {
            if (this.selectedCoordinates?.includes(coordinate)) {
                this.selectedCoordinates = this.selectedCoordinates.filter(coord => coord !== coordinate);
            } else {
                this.selectedCoordinates = [...this.selectedCoordinates, coordinate];
            }
            // this.clearXYBounds();
        }
    };

    constructor(widgetStore: SpectralProfileWidgetStore, coordinate: string) {
        makeObservable(this);
        this.widgetStore = widgetStore;
        this.defaultCoordinate = coordinate;

        this.profileCategory = ProfileCategory.IMAGE;
        this.selectedRegions = [RegionId.CURSOR];
        this.selectedStatsTypes = [CARTA.StatsType.Mean];
        this.selectedCoordinates = [coordinate];
    }
}

import {action, autorun, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {ProfileItemOptionProps} from "components";
import {STATISTICS_TEXT, SUPPORTED_STATISTICS_TYPES} from "models";

export enum ProfileCategory {
    IMAGE = "Image",
    REGION = "Region",
    STATISTICS = "Statistics",
    STOKES = "Stokes"
}

export class MultipleProfileStore {
    // profile selection
    @observable selectedProfileCategory: ProfileCategory;
    @observable selectedFrame: number;
    @observable selectedRegions: number[];
    @observable selectedStatsTypes: CARTA.StatsType[];
    @observable selectedCoordinates: string[];

    private profileStatsOptionTemplate: ProfileItemOptionProps[] = Array.from(STATISTICS_TEXT.entries()).map(entry => {
        return {
            value: entry[0],
            label: entry[1],
            enable: true
        };
    });

    private static ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    @computed get profileStatsOptions(): ProfileItemOptionProps[] {
        if (this.selectedStatsTypes?.length === 0) {
            this.profileStatsOptionTemplate.forEach(option => option.enable = true);
        } else if (this.selectedStatsTypes?.includes(CARTA.StatsType.FluxDensity)) {
            this.profileStatsOptionTemplate.forEach(option => option.enable = option.value === CARTA.StatsType.FluxDensity);
        } else if (this.selectedStatsTypes?.includes(CARTA.StatsType.SumSq)) {
            this.profileStatsOptionTemplate.forEach(option => option.enable = option.value === CARTA.StatsType.SumSq);
        } else {
            this.profileStatsOptionTemplate.forEach(option => option.enable = option.value !== CARTA.StatsType.FluxDensity && option.value !== CARTA.StatsType.SumSq);
        }
        return this.profileStatsOptionTemplate;
    }

    @computed get isStatsTypeFluxDensity(): boolean {
        return this.selectedStatsTypes?.includes(CARTA.StatsType.FluxDensity);
    }

    @computed get isStatsTypeSumSq(): boolean {
        return this.selectedStatsTypes?.includes(CARTA.StatsType.SumSq);
    }

    @action selectProfileCategory = (profileCategory: ProfileCategory) => {
        this.selectedProfileCategory = profileCategory;
    };

    @action selectFrame = (fileId: number) => {
        // TODO: error handling for fileId
        this.selectedFrame = fileId;
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

    constructor(coordinate: string) {
        makeObservable(this);
        this.selectedProfileCategory = ProfileCategory.IMAGE;
        this.selectedFrame = 0;
        this.selectedRegions = [];
        this.selectedStatsTypes = [CARTA.StatsType.Mean];
        this.selectedCoordinates = [coordinate];

        // Reset region/statistics/stokes selected option when switching profile category
        autorun(() => {
            if (this.selectedProfileCategory === ProfileCategory.IMAGE) {
                this.selectedCoordinates = [coordinate];
                this.selectedRegions = [];
                this.selectedStatsTypes = [CARTA.StatsType.Mean];
            } else if (this.selectedProfileCategory === ProfileCategory.REGION) {
                this.selectedCoordinates = [coordinate];
                this.selectedStatsTypes = [CARTA.StatsType.Mean];
            } else if (this.selectedProfileCategory === ProfileCategory.STATISTICS) {
                this.selectedCoordinates = [coordinate];
                this.selectedRegions = [];
            } else if (this.selectedProfileCategory === ProfileCategory.STOKES) {
                this.selectedRegions = [];
                this.selectedStatsTypes = [CARTA.StatsType.Mean];
            }
        });
    }
}
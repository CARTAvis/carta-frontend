import {action, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {RegionId, SpectralProfileWidgetStore} from "stores/widgets";
import {ProfileItemOptionProps} from "components";
import {STATISTICS_TEXT, SUPPORTED_STATISTICS_TYPES} from "models";

export enum ProfileCategory {
    IMAGE = "Image",
    REGION = "Region",
    STATISTICS = "Statistics",
    STOKES = "Stokes"
}

interface FullSpectralConfig extends CARTA.SetSpectralRequirements.ISpectralConfig {
    fileId: number;
    regionId: number;
}

export class SpectralProfileSelectionStore {
    // profile selection
    @observable activeProfileCategory: ProfileCategory;
    @observable selectedRegionIds: number[];
    @observable selectedStatsTypes: CARTA.StatsType[];
    @observable selectedCoordinates: string[];

    private readonly widgetStore: SpectralProfileWidgetStore;
    private readonly DEFAULT_REGION_ID: RegionId = RegionId.CURSOR;
    private readonly DEFAULT_STATS_TYPE: CARTA.StatsType = CARTA.StatsType.Mean;
    private readonly DEFAULT_COORDINATE: string = "z";
    private static readonly ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    @computed get profileConfigs(): FullSpectralConfig[] {
        let profileConfigs: FullSpectralConfig[] = [];
        const fileId = this.widgetStore.effectiveFrame.frameInfo.fileId;
        const regionId = this.widgetStore.effectiveRegionId;
        if (this.activeProfileCategory === ProfileCategory.IMAGE) {
            // TODO: add matched image ids, spectralSiblings of FrameStore
            const statsType = this.widgetStore.effectiveRegion?.isClosedRegion ? this.DEFAULT_STATS_TYPE : CARTA.StatsType.Sum;
            profileConfigs.push({fileId: fileId, regionId: regionId, statsTypes: [statsType], coordinate: this.DEFAULT_COORDINATE});
        } else if (this.activeProfileCategory === ProfileCategory.REGION) {
            this.selectedRegionIds?.forEach(selectedRegionId => {
                const region = this.widgetStore.effectiveFrame.regionSet.regions.find(r => r.regionId === selectedRegionId);
                const statsType = region?.isClosedRegion ? this.DEFAULT_STATS_TYPE : CARTA.StatsType.Sum;
                profileConfigs.push({fileId: fileId, regionId: selectedRegionId, statsTypes: [statsType], coordinate: this.DEFAULT_COORDINATE});
            });
        } else if (this.activeProfileCategory === ProfileCategory.STATISTICS) {
            profileConfigs.push({fileId: fileId, regionId: regionId, statsTypes: this.widgetStore.effectiveRegion?.isClosedRegion ? [...this.selectedStatsTypes] : [CARTA.StatsType.Sum], coordinate: this.DEFAULT_COORDINATE});
        } else if (this.activeProfileCategory === ProfileCategory.STOKES) {
            const statsType = this.widgetStore.effectiveRegion?.isClosedRegion ? this.DEFAULT_STATS_TYPE : CARTA.StatsType.Sum;
            this.selectedCoordinates?.forEach(coordinate => {
                profileConfigs.push({fileId: fileId, regionId: regionId, statsTypes: [statsType], coordinate: coordinate});
            });
        }
        return profileConfigs;
    }

    @computed get frameOptions(): ProfileItemOptionProps[] {
        let options = [];
        const appStore = AppStore.Instance;
        const frameNameOptions = appStore.frameNames;
        const spectralReference = appStore.spectralReference;
        const matchedFrameIds = spectralReference?.spectralSiblings?.map(matchedFrame => {return matchedFrame.frameInfo.fileId;});
        options = frameNameOptions?.map(frameNameOption => {
            const isMatched = matchedFrameIds?.length > 0 && (frameNameOption.value === spectralReference.frameInfo.fileId || matchedFrameIds.includes(frameNameOption.value as number));
            return {
                label: `${frameNameOption.label}`,
                value: frameNameOption.value,
                hightlight: isMatched
            };
        });
        return options;
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
        return Array.from(STATISTICS_TEXT.entries()).map(entry => {
            return {value: entry[0], label: entry[1]};
        });
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

    @computed get isStatsTypeFluxDensityOnly(): boolean {
        return this.selectedStatsTypes?.length === 1 && this.selectedStatsTypes[0] === CARTA.StatsType.FluxDensity;
    }

    @computed get isStatsTypeSumSqOnly(): boolean {
        return this.selectedStatsTypes?.length === 1 && this.selectedStatsTypes[0] === CARTA.StatsType.SumSq;
    }

    @computed get isSameStatsTypeUnit(): boolean {
        // unit of FluxDensity: Jy, unit of SumSq: (Jy/Beam)^2, others: Jy/Beam
        if (this.selectedStatsTypes?.length <= 1) {
            return true;
        } else if (this.selectedStatsTypes?.includes(CARTA.StatsType.FluxDensity) || this.selectedStatsTypes?.includes(CARTA.StatsType.SumSq)) {
            return false;
        }
        return true;
    }

    @action setActiveProfileCategory = (profileCategory: ProfileCategory) => {
        // Reset region/statistics/stokes to default (only 1 item) when switching active profile category
        if (profileCategory === ProfileCategory.IMAGE) {
            this.selectedRegionIds = [this.DEFAULT_REGION_ID];
            this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
            this.selectedCoordinates = [this.DEFAULT_COORDINATE];
        } else if (profileCategory === ProfileCategory.REGION) {
            this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
            this.selectedCoordinates = [this.DEFAULT_COORDINATE];
        } else if (profileCategory === ProfileCategory.STATISTICS) {
            this.selectedRegionIds = [this.DEFAULT_REGION_ID];
            this.selectedCoordinates = [this.DEFAULT_COORDINATE];
        } else if (profileCategory === ProfileCategory.STOKES) {
            this.selectedRegionIds = [this.DEFAULT_REGION_ID];
            this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
        }
        this.activeProfileCategory = profileCategory;
    };

    @action selectFrame = (fileId: number) => {
        // TODO: error handling for fileId
        this.widgetStore.setFileId(fileId);
    };

    @action selectRegion = (regionId: number, isMultipleSelectionMode: boolean) => {
        if (isMultipleSelectionMode) {
            if (!this.selectedRegionIds.includes(regionId)) {
                this.selectedRegionIds = [...this.selectedRegionIds, regionId];
            } else if (this.selectedRegionIds.length > 1) {
                this.selectedRegionIds = this.selectedRegionIds.filter(region => region !== regionId);
            }
        } else {
            this.selectedRegionIds = [regionId];
        }
    };

    @action selectStatsType = (statsType: CARTA.StatsType, isMultipleSelectionMode: boolean) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            if (isMultipleSelectionMode) {
                if (!this.selectedStatsTypes.includes(statsType)) {
                    this.selectedStatsTypes = [...this.selectedStatsTypes, statsType];
                } else if (this.selectedStatsTypes.length > 1) {
                    this.selectedStatsTypes = this.selectedStatsTypes.filter(type => type !== statsType);
                }
            } else {
                this.selectedStatsTypes = [statsType];
            }
        }
    };

    @action selectCoordinate = (coordinate: string, isMultipleSelectionMode: boolean) => {
        if (SpectralProfileSelectionStore.ValidCoordinates.includes(coordinate)) {
            if (isMultipleSelectionMode) {
                if (!this.selectedCoordinates.includes(coordinate)) {
                    this.selectedCoordinates = [...this.selectedCoordinates, coordinate];
                } else if (this.selectedCoordinates.length > 1) {
                    this.selectedCoordinates = this.selectedCoordinates.filter(coord => coord !== coordinate);
                }
            } else {
                this.selectedCoordinates = [coordinate];
            }
            // this.clearXYBounds();
        }
    };

    constructor(widgetStore: SpectralProfileWidgetStore, coordinate: string) {
        makeObservable(this);
        this.widgetStore = widgetStore;

        this.activeProfileCategory = ProfileCategory.IMAGE;
        this.selectedRegionIds = [this.DEFAULT_REGION_ID];
        this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
        this.selectedCoordinates = [this.DEFAULT_COORDINATE];
    }
}

import {action, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {RegionId, SpectralProfileWidgetStore} from "stores/widgets";
import {ProfileItemOptionProps} from "components";
import {ProcessedSpectralProfile, STATISTICS_TEXT, StatsTypeString, SUPPORTED_STATISTICS_TYPES} from "models";

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
    private readonly DEFAULT_COORDINATE: string;
    private static readonly ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    public getProfiles = (): ProcessedSpectralProfile[] => {
        let profiles = [];
        this.profileConfigs?.forEach(profileConfig => {
            const frameProfileStoreMap = AppStore.Instance.spectralProfiles.get(profileConfig.fileId);
            const regionProfileStoreMap = frameProfileStoreMap?.get(profileConfig.regionId);
            profileConfig?.statsTypes?.forEach(statsType => {
                const profile = regionProfileStoreMap?.getProfile(profileConfig.coordinate, statsType);
                if (profile) {
                    profiles.push(profile);
                }
            });
        });
        return profiles;
    };

    @computed get profileConfigs(): FullSpectralConfig[] {
        let profileConfigs: FullSpectralConfig[] = [];
        if (this.selectedFrame && this.selectedRegionIds?.length >= 1 && this.selectedStatsTypes?.length >= 1 && this.selectedCoordinates?.length >= 1) {
            if (this.activeProfileCategory === ProfileCategory.IMAGE) {
                const selectedRegionId = this.selectedRegionIds[0];
                const selectedStatsType = this.selectedStatsTypes[0];
                const selectedCoordinate = this.selectedCoordinates[0];
                const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
                if (matchedFileIds?.includes(this.selectedFrameFileId)) {
                    matchedFileIds.forEach(fileId => {
                        profileConfigs.push({
                            fileId: fileId,
                            regionId: selectedRegionId,
                            statsTypes: [selectedStatsType],
                            coordinate: selectedCoordinate
                        });
                    });
                } else {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: selectedRegionId,
                        statsTypes: [selectedStatsType],
                        coordinate: selectedCoordinate
                    });
                }
            } else if (this.activeProfileCategory === ProfileCategory.REGION) {
                const selectedStatsType = this.selectedStatsTypes[0];
                const selectedCoordinate = this.selectedCoordinates[0];

                this.selectedRegionIds?.forEach(selectedRegionId => {
                    const region = this.selectedFrame.getRegion(selectedRegionId);
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: selectedRegionId,
                        statsTypes: [region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum],
                        coordinate: selectedCoordinate
                    });
                });
            } else if (this.activeProfileCategory === ProfileCategory.STATISTICS) {
                const selectedRegionId = this.selectedRegionIds[0];
                const selectedCoordinate = this.selectedCoordinates[0];
                const region = this.selectedFrame.getRegion(selectedRegionId);

                profileConfigs.push({
                    fileId: this.selectedFrameFileId,
                    regionId: selectedRegionId,
                    statsTypes: region?.isClosedRegion ? [...this.selectedStatsTypes] : [CARTA.StatsType.Sum],
                    coordinate: selectedCoordinate
                });
            } else if (this.activeProfileCategory === ProfileCategory.STOKES) {
                const selectedRegionId = this.selectedRegionIds[0];
                const selectedStatsType = this.selectedStatsTypes[0];
                const region = this.selectedFrame.getRegion(selectedRegionId);

                this.selectedCoordinates?.forEach(coordinate => {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: selectedRegionId,
                        statsTypes: [region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum],
                        coordinate: coordinate
                    });
                });
            }
        }
        return profileConfigs;
    }

    @computed get profileOptions(): string[] {
        let profileOptions = [];
        this.profileConfigs?.forEach(profileConfig => {
            const frame = AppStore.Instance.getFrame(profileConfig.fileId);
            const fileName = frame?.filename;
            const region = frame?.getRegion(profileConfig.regionId);
            profileConfig.statsTypes?.forEach(statsType => {
                profileOptions.push(`${fileName}-${region?.nameString}-${StatsTypeString(statsType)}-${profileConfig.coordinate}`);
            });
        });
        return profileOptions;
    }

    @computed get frameOptions(): ProfileItemOptionProps[] {
        let options = [];
        const appStore = AppStore.Instance;
        const frameNameOptions = appStore.frameNames;
        const matchedFrameIds = appStore.spatialAndSpectalMatchedFileIds;
        options = frameNameOptions?.map(frameNameOption => {
            const isMatched = matchedFrameIds?.length > 1 && matchedFrameIds?.includes(frameNameOption.value as number);
            return {
                label: `${frameNameOption.label}${isMatched ? " (matched)" : ""}`,
                value: frameNameOption.value,
                hightlight: isMatched
            };
        });
        return options;
    }

    @computed get regionOptions(): ProfileItemOptionProps[] {
        let options = [];
        const frame = this.selectedFrame;
        if (frame?.regionSet?.regions) {
            const filteredRegions = frame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT));
            options = options.concat(filteredRegions?.map(r => {return {value: r.regionId, label: r.nameString};}));
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
        return this.selectedFrame?.frameInfo.fileId;
    }

    @computed get isStatsTypeSelectionAvailable(): boolean {
        // Check the available stats types of the selected single region
        if ((this.activeProfileCategory === ProfileCategory.REGION && this.selectedRegionIds?.length === 1) ||
            (this.activeProfileCategory !== ProfileCategory.REGION && this.selectedRegionIds?.length > 0)) {
            const selectedRegion = this.selectedFrame?.getRegion(this.selectedRegionIds[0]);
            return selectedRegion && selectedRegion.isClosedRegion;
        }
        return true;
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
        this.widgetStore.setFileId(fileId);
        // TODO: do we need to switch category to IMAGE or can stay in the same category when switching frame?
        this.setActiveProfileCategory(ProfileCategory.IMAGE);
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
        this.DEFAULT_COORDINATE = coordinate;

        this.activeProfileCategory = ProfileCategory.IMAGE;
        this.selectedRegionIds = [this.DEFAULT_REGION_ID];
        this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
        this.selectedCoordinates = [this.DEFAULT_COORDINATE];
    }
}

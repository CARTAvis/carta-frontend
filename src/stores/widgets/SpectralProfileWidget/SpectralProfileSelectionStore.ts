import {action, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {ACTIVE_FILE_ID, RegionId, SpectralProfileWidgetStore} from "stores/widgets";
import {LineKey, LineOption, ProcessedSpectralProfile, STATISTICS_TEXT, SUPPORTED_STATISTICS_TYPES} from "models";

export enum ProfileCategory {
    NONE = "None", // single profile mode: only 1 profile displayed in widget
    IMAGE = "Image",
    REGION = "Region",
    STATISTIC = "Statistic",
    STOKES = "Stokes"
}

interface ProfileConfig {
    fileId: number;
    regionId: number;
    statsType: CARTA.StatsType;
    coordinate: string;
    colorKey: LineKey;
    label: string;
}

interface SpectralConfig extends CARTA.SetSpectralRequirements.ISpectralConfig {
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

    // getFormattedSpectralConfigs() is a simple converter to transform this.profileConfigs to SpectralConfig,
    // and SpectralConfig is specially for CalculateRequirementsMap in SpectralProfileWidgetStore.
    // P.S. this.profileConfigs has the key statType & SpectralConfig has the key statsType's'
    public getFormattedSpectralConfigs = (): SpectralConfig[] => {
        let formattedSpectralConfigs: SpectralConfig[] = [];
        const profileConfigs = this.profileConfigs;
        if (profileConfigs?.length > 0) {
            if (this.activeProfileCategory === ProfileCategory.STATISTIC) {
                let statsTypes = [];
                profileConfigs.forEach(profileConfig => statsTypes.push(profileConfig.statsType));
                formattedSpectralConfigs.push({
                    fileId: profileConfigs[0].fileId,
                    regionId: profileConfigs[0].regionId,
                    statsTypes: statsTypes,
                    coordinate: profileConfigs[0].coordinate
                });
            } else {
                profileConfigs.forEach(profileConfig => {
                    formattedSpectralConfigs.push({
                        fileId: profileConfig.fileId,
                        regionId: profileConfig.regionId,
                        statsTypes: [profileConfig.statsType],
                        coordinate: profileConfig.coordinate
                    });
                });
            }
        }
        return formattedSpectralConfigs;
    };

    // TODO: remove label
    @computed private get profileConfigs(): ProfileConfig[] {
        let profileConfigs: ProfileConfig[] = [];
        if (this.selectedFrame && this.selectedRegionIds?.length >= 1 && this.selectedStatsTypes?.length >= 1 && this.selectedCoordinates?.length >= 1) {
            const realFileId = this.selectedFrame.frameInfo.fileId;
            if (this.activeProfileCategory === ProfileCategory.NONE || this.activeProfileCategory === ProfileCategory.IMAGE) {
                const selectedRegionId = this.selectedRegionIds[0];
                const region = this.selectedFrame.getRegion(selectedRegionId);
                const statsType = region?.isClosedRegion ? this.selectedStatsTypes[0] : CARTA.StatsType.Sum;
                const selectedCoordinate = this.selectedCoordinates[0];
                const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
                if (this.activeProfileCategory === ProfileCategory.IMAGE && matchedFileIds?.includes(realFileId)) {
                    matchedFileIds.forEach(fileId => {
                        profileConfigs.push({
                            fileId: fileId,
                            regionId: selectedRegionId,
                            statsType: statsType,
                            coordinate: selectedCoordinate,
                            colorKey: fileId,
                            label: `${fileId}-${selectedRegionId}-${statsType}-${selectedCoordinate}`
                        });
                    });
                } else {
                    profileConfigs.push({
                        fileId: realFileId,
                        regionId: selectedRegionId,
                        statsType: statsType,
                        coordinate: selectedCoordinate,
                        colorKey: realFileId,
                        label: `${realFileId}-${selectedRegionId}-${statsType}-${selectedCoordinate}`
                    });
                }
            } else if (this.activeProfileCategory === ProfileCategory.REGION) {
                const selectedStatsType = this.selectedStatsTypes[0];
                const selectedCoordinate = this.selectedCoordinates[0];

                this.selectedRegionIds?.forEach(selectedRegionId => {
                    const region = this.selectedFrame.getRegion(selectedRegionId);
                    const statsType = region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum;
                    profileConfigs.push({
                        fileId: realFileId,
                        regionId: selectedRegionId,
                        statsType: statsType,
                        coordinate: selectedCoordinate,
                        colorKey: selectedRegionId,
                        label: `${realFileId}-${selectedRegionId}-${statsType}-${selectedCoordinate}`
                    });
                });
            } else if (this.activeProfileCategory === ProfileCategory.STATISTIC) {
                const selectedRegionId = this.selectedRegionIds[0];
                const selectedCoordinate = this.selectedCoordinates[0];
                const region = this.selectedFrame.getRegion(selectedRegionId);

                if (region?.isClosedRegion) {
                    this.selectedStatsTypes.forEach(statsType => {
                        profileConfigs.push({
                            fileId: realFileId,
                            regionId: selectedRegionId,
                            statsType: statsType,
                            coordinate: selectedCoordinate,
                            colorKey: statsType,
                            label: `${realFileId}-${selectedRegionId}-${statsType}-${selectedCoordinate}`
                        });
                    });
                } else {
                    profileConfigs.push({
                        fileId: realFileId,
                        regionId: selectedRegionId,
                        statsType: CARTA.StatsType.Sum,
                        coordinate: selectedCoordinate,
                        colorKey: CARTA.StatsType.Sum,
                        label: `${realFileId}-${selectedRegionId}-${CARTA.StatsType.Sum}-${selectedCoordinate}`
                    });
                }
            } else if (this.activeProfileCategory === ProfileCategory.STOKES) {
                const selectedRegionId = this.selectedRegionIds[0];
                const selectedStatsType = this.selectedStatsTypes[0];
                const region = this.selectedFrame.getRegion(selectedRegionId);
                const statsType = region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum;

                this.selectedCoordinates?.forEach(coordinate => {
                    profileConfigs.push({
                        fileId: realFileId,
                        regionId: selectedRegionId,
                        statsType: statsType,
                        coordinate: coordinate,
                        colorKey: coordinate,
                        label: `${realFileId}-${selectedRegionId}-${statsType}-${coordinate}`
                    });
                });
            }
        }
        return profileConfigs;
    }

    @computed get profiles(): {
        data: ProcessedSpectralProfile,
        colorKey: string,
        label: string
    }[] {
        let profiles = [];
        this.profileConfigs?.forEach(profileConfig => {
            const frameProfileStoreMap = AppStore.Instance.spectralProfiles.get(profileConfig.fileId);
            const regionProfileStoreMap = frameProfileStoreMap?.get(profileConfig.regionId);
            const profileData = regionProfileStoreMap?.getProfile(profileConfig.coordinate, profileConfig.statsType);
            if (profileData) {
                profiles.push({
                    data: profileData,
                    colorKey: profileConfig.colorKey,
                    label: profileConfig.label
                });
            }
        });
        return profiles;
    }

    @computed get profileOrderedKeys(): LineKey[] {
        if (this.activeProfileCategory === ProfileCategory.NONE) {
            return [this.selectedFrameFileId];
        } else if (this.activeProfileCategory === ProfileCategory.IMAGE) {
            const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
            // TODO: should check whether readFileId is included in matchedFileIds
            return matchedFileIds?.includes(this.selectedFrameFileId) ? matchedFileIds : [this.selectedFrameFileId];
        } else if (this.activeProfileCategory === ProfileCategory.REGION) {
            return this.selectedRegionIds;
        } else if (this.activeProfileCategory === ProfileCategory.STATISTIC) {
            return this.selectedStatsTypes;
        } else if (this.activeProfileCategory === ProfileCategory.STOKES) {
            return this.selectedCoordinates;
        }
        return undefined;
    }

    @computed get profileOptions(): LineOption[] {
        if (this.activeProfileCategory === ProfileCategory.NONE || this.activeProfileCategory === ProfileCategory.IMAGE) {
            return this.frameOptions;
        } else if (this.activeProfileCategory === ProfileCategory.REGION) {
            return this.regionOptions;
        } else if (this.activeProfileCategory === ProfileCategory.STATISTIC) {
            return this.statsTypeOptions;
        } else if (this.activeProfileCategory === ProfileCategory.STOKES) {
            return this.coordinateOptions;
        }
        return undefined;
    }

    @computed get frameOptions(): LineOption[] {
        let options: LineOption[] = [{value: ACTIVE_FILE_ID, label: "Active"}];
        const appStore = AppStore.Instance;
        const frameNameOptions = appStore.frameNames;
        if (this.activeProfileCategory === ProfileCategory.IMAGE) {
            const matchedFrameIds = appStore.spatialAndSpectalMatchedFileIds;
            frameNameOptions?.forEach(frameNameOption => {
                const isMatched = matchedFrameIds?.length > 1 && matchedFrameIds?.includes(frameNameOption.value as number);
                options.push({
                    value: frameNameOption.value,
                    label: `${frameNameOption.label}${isMatched ? " (matched)" : ""}`,
                    hightlight: isMatched
                });
            });
        } else {
            options = options.concat(frameNameOptions);
        }
        return options;
    }

    @computed get regionOptions(): LineOption[] {
        let options: LineOption[] = [{value: RegionId.ACTIVE, label: "Active", disabled: this.activeProfileCategory === ProfileCategory.REGION}];
        const frame = this.selectedFrame;
        if (frame?.regionSet?.regions) {
            const filteredRegions = frame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT));
            options = options.concat(filteredRegions?.map(r => {return {value: r.regionId, label: r.nameString};}));
        }
        return options;
    }

    @computed get statsTypeOptions(): LineOption[] {
        const sortedKeys = Array.from(STATISTICS_TEXT.keys())?.sort((a, b) => {return a-b;});
        return sortedKeys?.map(key => {return {value: key, label: STATISTICS_TEXT.get(key)};});
    }

    @computed get coordinateOptions(): LineOption[] {
        let options = [{value: "z", label: "z"}];
        this.selectedFrame?.stokesInfo?.forEach(stokes => options.push({value: `${stokes}z`, label: stokes}));
        return options;
    }

    @computed get selectedFrame(): FrameStore {
        return this.widgetStore.effectiveFrame;
    }

    @computed get selectedFrameFileId(): number {
        return this.widgetStore.fileId;
    }

    @computed get isSelectingSpecificFrame(): boolean {
        return this.widgetStore.isEffectiveFrameEqualToActiveFrame && this.selectedFrameFileId !== ACTIVE_FILE_ID;
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
        const widgetStore = this.widgetStore;
        const primaryLineColor = widgetStore.primaryLineColor;

        this.activeProfileCategory = profileCategory;
        widgetStore.clearProfileColors();
        // Reset region/statistics/stokes to default (only 1 item) when switching active profile category
        if (profileCategory === ProfileCategory.NONE || profileCategory === ProfileCategory.IMAGE) {
            this.selectedRegionIds = [this.DEFAULT_REGION_ID];
            this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
            this.selectedCoordinates = [this.DEFAULT_COORDINATE];
            widgetStore.setProfileColor(this.selectedFrameFileId, primaryLineColor);
        } else if (profileCategory === ProfileCategory.REGION) {
            this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
            this.selectedCoordinates = [this.DEFAULT_COORDINATE];
            widgetStore.setProfileColor(this.DEFAULT_REGION_ID, primaryLineColor);
        } else if (profileCategory === ProfileCategory.STATISTIC) {
            this.selectedRegionIds = [this.DEFAULT_REGION_ID];
            this.selectedCoordinates = [this.DEFAULT_COORDINATE];
            widgetStore.setProfileColor(this.DEFAULT_STATS_TYPE, primaryLineColor);
        } else if (profileCategory === ProfileCategory.STOKES) {
            this.selectedRegionIds = [this.DEFAULT_REGION_ID];
            this.selectedStatsTypes = [this.DEFAULT_STATS_TYPE];
            widgetStore.setProfileColor(this.DEFAULT_COORDINATE, primaryLineColor);
        }
    };

    @action selectFrame = (fileId: number) => {
        this.widgetStore.setFileId(fileId);
    };

    @action selectRegion = (regionId: number, color: string, isMultipleSelectionMode: boolean = false) => {
        if (isMultipleSelectionMode) {
            const profileKey = regionId;
            if (!this.selectedRegionIds.includes(regionId)) {
                this.selectedRegionIds = [...this.selectedRegionIds, regionId].sort((a, b) => {return a - b;});
                this.widgetStore.setProfileColor(profileKey, color);
            } else if (this.selectedRegionIds.length > 1) {
                this.selectedRegionIds = this.selectedRegionIds.filter(region => region !== regionId);
                this.widgetStore.removeProfileColor(profileKey);
            }
        } else {
            this.selectedRegionIds = [regionId];
        }
    };

    @action selectStatsType = (statsType: CARTA.StatsType, color: string, isMultipleSelectionMode: boolean = false) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            if (isMultipleSelectionMode) {
                const profileKey = statsType;
                if (!this.selectedStatsTypes.includes(statsType)) {
                    this.selectedStatsTypes = [...this.selectedStatsTypes, statsType].sort((a, b) => {return a - b;});
                    this.widgetStore.setProfileColor(profileKey, color);
                } else if (this.selectedStatsTypes.length > 1) {
                    this.selectedStatsTypes = this.selectedStatsTypes.filter(type => type !== statsType);
                    this.widgetStore.removeProfileColor(profileKey);
                }
            } else {
                this.selectedStatsTypes = [statsType];
            }
        }
    };

    @action selectCoordinate = (coordinate: string, color: string, isMultipleSelectionMode: boolean = false) => {
        if (SpectralProfileSelectionStore.ValidCoordinates.includes(coordinate)) {
            if (isMultipleSelectionMode) {
                const profileKey = coordinate;
                if (!this.selectedCoordinates.includes(coordinate)) {
                    this.selectedCoordinates = [...this.selectedCoordinates, coordinate].sort((a, b) => {
                        // always place z in the first element
                        if (a === 'z') {
                            return -1;
                        } else if (b === 'z') {
                            return 1;
                        }
                        return a.charCodeAt(0) - b.charCodeAt(0);
                    });
                    this.widgetStore.setProfileColor(profileKey, color);
                } else if (this.selectedCoordinates.length > 1) {
                    this.selectedCoordinates = this.selectedCoordinates.filter(coord => coord !== coordinate);
                    this.widgetStore.removeProfileColor(profileKey);
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

        this.selectedRegionIds = [];
        this.selectedStatsTypes = [];
        this.selectedCoordinates = [];
        this.setActiveProfileCategory(ProfileCategory.NONE);
    }
}

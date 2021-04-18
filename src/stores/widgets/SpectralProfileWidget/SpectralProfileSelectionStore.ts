import {action, autorun, computed, makeObservable, observable} from "mobx";
import {CARTA} from "carta-protobuf";
import {AppStore, FrameStore} from "stores";
import {ACTIVE_FILE_ID, RegionId, SpectralProfileWidgetStore} from "stores/widgets";
import {LineKey, LineOption, ProcessedSpectralProfile, StatsTypeString, STATISTICS_TEXT, SUPPORTED_STATISTICS_TYPES} from "models";
import {SWATCH_COLORS} from "utilities";

export enum MultiProfileCategory {
    NONE = "None", // Single profile mode: allow only 1 profile displayed in widget
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
    label: {image: string, plot: string};
}

interface SpectralConfig extends CARTA.SetSpectralRequirements.ISpectralConfig {
    fileId: number;
    regionId: number;
}

const SUPPORTED_STOKES = ["z", "Iz", "Qz", "Uz", "Vz"];
const SUPPORTED_STOKES_LABEL_MAP = new Map<string, string>([
    ["z", "Current"], ["Iz", "I"], ["Qz", "Q"], ["Uz", "U"], ["Vz", "V"]
]);

export class SpectralProfileSelectionStore {
    // profile selection
    @observable activeProfileCategory: MultiProfileCategory;
    @observable selectedRegionIds: number[];
    @observable selectedStatsTypes: CARTA.StatsType[];
    @observable selectedCoordinates: string[];

    private readonly widgetStore: SpectralProfileWidgetStore;
    private readonly DEFAULT_COORDINATE: string;

    // getFormattedSpectralConfigs() is a simple converter to transform this.profileConfigs to SpectralConfig,
    // and SpectralConfig is specially for CalculateRequirementsMap in SpectralProfileWidgetStore.
    // P.S. this.profileConfigs has the key statType & SpectralConfig has the key statsType's'
    public getFormattedSpectralConfigs = (): SpectralConfig[] => {
        let formattedSpectralConfigs: SpectralConfig[] = [];
        const profileConfigs = this.profileConfigs;
        if (profileConfigs?.length > 0) {
            if (this.activeProfileCategory === MultiProfileCategory.STATISTIC) {
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

    private genProfileLabel = (fileId: number, regionId: number, statsType: CARTA.StatsType, coordinate: string): {image: string, plot: string} => {
        return {
            image: AppStore.Instance.getFrameName(fileId),
            plot: `${regionId === RegionId.CURSOR ? "Cursor" : `Region ${regionId}`}, Statistic ${StatsTypeString(statsType)}, Cooridnate ${SUPPORTED_STOKES_LABEL_MAP.get(coordinate)}`
        };
    };

    @computed private get profileConfigs(): ProfileConfig[] {
        let profileConfigs: ProfileConfig[] = [];
        if (this.selectedFrame && this.selectedRegionIds?.length > 0 && this.selectedStatsTypes?.length > 0 && this.selectedCoordinates?.length > 0) {
            if (this.activeProfileCategory === MultiProfileCategory.NONE || this.activeProfileCategory === MultiProfileCategory.IMAGE) {
                const region = this.widgetStore.effectiveRegion;
                const statsType = region?.isClosedRegion ? this.selectedStatsTypes[0] : CARTA.StatsType.Sum;
                const selectedCoordinate = this.selectedCoordinates[0];
                const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
                if (this.activeProfileCategory === MultiProfileCategory.IMAGE && matchedFileIds?.includes(this.selectedFrameFileId)) {
                    matchedFileIds.forEach(fileId => {
                        profileConfigs.push({
                            fileId: fileId,
                            regionId: this.effectiveRegionId,
                            statsType: statsType,
                            coordinate: selectedCoordinate,
                            colorKey: fileId,
                            label: this.genProfileLabel(fileId, this.effectiveRegionId, statsType, selectedCoordinate)
                        });
                    });
                } else {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: this.effectiveRegionId,
                        statsType: statsType,
                        coordinate: selectedCoordinate,
                        colorKey: this.selectedFrameFileId,
                        label: this.genProfileLabel(this.selectedFrameFileId, this.effectiveRegionId, statsType, selectedCoordinate)
                    });
                }
            } else if (this.activeProfileCategory === MultiProfileCategory.REGION) {
                const selectedStatsType = this.selectedStatsTypes[0];
                const selectedCoordinate = this.selectedCoordinates[0];
                this.selectedRegionIds?.forEach(selectedRegionId => {
                    if (selectedRegionId !== RegionId.ACTIVE) {
                        const region = this.selectedFrame.getRegion(selectedRegionId);
                        const statsType = region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum;
                        profileConfigs.push({
                            fileId: this.selectedFrameFileId,
                            regionId: selectedRegionId,
                            statsType: statsType,
                            coordinate: selectedCoordinate,
                            colorKey: selectedRegionId,
                            label: this.genProfileLabel(this.selectedFrameFileId, selectedRegionId, statsType, selectedCoordinate)
                        });
                    }
                });
            } else if (this.activeProfileCategory === MultiProfileCategory.STATISTIC) {
                const selectedCoordinate = this.selectedCoordinates[0];
                const region = this.widgetStore.effectiveRegion;
                if (region?.isClosedRegion) {
                    this.selectedStatsTypes.forEach(statsType => {
                        profileConfigs.push({
                            fileId: this.selectedFrameFileId,
                            regionId: this.effectiveRegionId,
                            statsType: statsType,
                            coordinate: selectedCoordinate,
                            colorKey: statsType,
                            label: this.genProfileLabel(this.selectedFrameFileId, this.effectiveRegionId, statsType, selectedCoordinate)
                        });
                    });
                } else {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: this.effectiveRegionId,
                        statsType: CARTA.StatsType.Sum,
                        coordinate: selectedCoordinate,
                        colorKey: CARTA.StatsType.Sum,
                        label: this.genProfileLabel(this.selectedFrameFileId, this.effectiveRegionId, CARTA.StatsType.Sum, selectedCoordinate)
                    });
                }
            } else if (this.activeProfileCategory === MultiProfileCategory.STOKES) {
                const selectedStatsType = this.selectedStatsTypes[0];
                const region = this.widgetStore.effectiveRegion;
                const statsType = region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum;
                this.selectedCoordinates?.forEach(coordinate => {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: this.effectiveRegionId,
                        statsType: statsType,
                        coordinate: coordinate,
                        colorKey: coordinate,
                        label: this.genProfileLabel(this.selectedFrameFileId, this.effectiveRegionId, statsType, coordinate)
                    });
                });
            }
        }
        return profileConfigs;
    }

    @computed get profiles(): {
        channelValues: number[],
        data: ProcessedSpectralProfile,
        colorKey: string,
        label: {image: string, plot: string},
        comments: string[]
    }[] {
        let profiles = [];
        this.profileConfigs?.forEach(profileConfig => {
            const appStore = AppStore.Instance;
            const frame = appStore.getFrame(profileConfig.fileId);
            const frameProfileStoreMap = appStore.spectralProfiles.get(profileConfig.fileId);
            const regionProfileStoreMap = frameProfileStoreMap?.get(profileConfig.regionId);
            const profileData = regionProfileStoreMap?.getProfile(profileConfig.coordinate, profileConfig.statsType);
            if (frame && profileData) {
                profiles.push({
                    channelValues: frame.channelValues,
                    data: profileData,
                    colorKey: profileConfig.colorKey,
                    label: profileConfig.label,
                    comments: frame.getRegionProperties(profileConfig.regionId)
                });
            }
        });
        return profiles;
    }

    @computed get profilesPlotName(): {image: string, plot: string} {
        let images, regions, statTypes, coordinates;
        let prevFileId, prevRegionId, prevStatsType, prevCoordinate;
        images = regions = statTypes = coordinates = "";
        prevFileId = prevRegionId = prevStatsType = prevCoordinate = undefined;
        this.profileConfigs?.forEach((profileConfig, index) => {
            const fileName = AppStore.Instance.getFrame(profileConfig.fileId)?.filename;
            if (prevFileId !== profileConfig.fileId) {
                images += `${index === 0 ? "" : ","}${fileName}`;
            }
            if (prevRegionId !== profileConfig.regionId) {
                regions += `${index === 0 ? "" : ","}${profileConfig.regionId === RegionId.CURSOR ? "Cursor" : profileConfig.regionId}`;
            }
            if (prevStatsType !== profileConfig.statsType) {
                statTypes += `${index === 0 ? "" : ","}${StatsTypeString(profileConfig.statsType)}`;
            }
            if (prevCoordinate !== profileConfig.coordinate) {
                coordinates += `${index === 0 ? "" : ","}${SUPPORTED_STOKES_LABEL_MAP.get(profileConfig.coordinate)}`;
            }
            prevFileId = profileConfig.fileId;
            prevRegionId = profileConfig.regionId;
            prevStatsType = profileConfig.statsType;
            prevCoordinate = profileConfig.coordinate;
        });
        return {image: images, plot: `Z-Profile-Region_${regions}-Statistic_${statTypes}-Coordinate_${coordinates}`};
    }

    @computed get profileOrderedKeys(): LineKey[] {
        if (this.activeProfileCategory === MultiProfileCategory.NONE) {
            return [SpectralProfileWidgetStore.PRIMARY_LINE_KEY];
        } else if (this.activeProfileCategory === MultiProfileCategory.IMAGE) {
            const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
            return matchedFileIds?.includes(this.selectedFrameFileId) ? matchedFileIds : [this.selectedFrameFileId];
        } else if (this.activeProfileCategory === MultiProfileCategory.REGION) {
            return this.selectedRegionIds;
        } else if (this.activeProfileCategory === MultiProfileCategory.STATISTIC) {
            return this.selectedStatsTypes;
        } else if (this.activeProfileCategory === MultiProfileCategory.STOKES) {
            return this.selectedCoordinates;
        }
        return undefined;
    }

    @computed get profileOptions(): LineOption[] {
        if (this.activeProfileCategory === MultiProfileCategory.NONE) {
            return [{value: SpectralProfileWidgetStore.PRIMARY_LINE_KEY, label: SpectralProfileWidgetStore.PRIMARY_LINE_KEY}];
        } else if (this.activeProfileCategory === MultiProfileCategory.IMAGE) {
            return this.frameOptions;
        } else if (this.activeProfileCategory === MultiProfileCategory.REGION) {
            return this.regionOptions;
        } else if (this.activeProfileCategory === MultiProfileCategory.STATISTIC) {
            return this.statsTypeOptions;
        } else if (this.activeProfileCategory === MultiProfileCategory.STOKES) {
            return this.coordinateOptions;
        }
        return undefined;
    }

    @computed get frameOptions(): LineOption[] {
        let options: LineOption[] = [{value: ACTIVE_FILE_ID, label: "Active"}];

        const appStore = AppStore.Instance;
        const frameNameOptions = appStore.frameNames;
        if (this.activeProfileCategory === MultiProfileCategory.IMAGE) {
            const matchedFrameIds = appStore.spatialAndSpectalMatchedFileIds;

            // Highlight matched active option
            if (matchedFrameIds?.length > 1 && matchedFrameIds?.includes(appStore.activeFrameFileId)) {
                let activeOption = options.find(option => option.value === ACTIVE_FILE_ID);
                activeOption.label = "Active (matched)";
                activeOption.hightlight = true;
            }

            frameNameOptions?.forEach(frameNameOption => {
                const isMatched = matchedFrameIds?.length > 1 && matchedFrameIds?.includes(frameNameOption.value as number);
                options.push({
                    value: frameNameOption.value,
                    label: `${frameNameOption.label}${isMatched ? " (matched)" : ""}`,
                    hightlight: isMatched,
                    active: frameNameOption.value === appStore.activeFrameFileId
                });
            });
        } else {
            options = options.concat(frameNameOptions?.map(frameNameOption => {
                return {
                    value: frameNameOption.value,
                    label: frameNameOption.label,
                    active: frameNameOption.value === appStore.activeFrameFileId
                };
            }));
        }
        return options;
    }

    @computed get regionOptions(): LineOption[] {
        let options: LineOption[] = [{value: RegionId.ACTIVE, label: "Active", disabled: this.activeProfileCategory === MultiProfileCategory.REGION}];

        const frame = this.selectedFrame;
        if (frame?.regionSet?.regions) {
            const appStore = AppStore.Instance;
            const activeRegionId = appStore.selectedRegion ? appStore.selectedRegion.regionId : RegionId.CURSOR;
            const filteredRegions = frame.regionSet.regions.filter(r => !r.isTemporary && (r.isClosedRegion || r.regionType === CARTA.RegionType.POINT));
            options = options.concat(filteredRegions?.map(r => {
                return {
                    value: r.regionId,
                    label: r.nameString,
                    active: this.widgetStore.isEffectiveFrameEqualToActiveFrame && r.regionId === activeRegionId
                };
            }));
        }
        return options;
    }

    @computed get statsTypeOptions(): LineOption[] {
        const sortedKeys = Array.from(STATISTICS_TEXT.keys())?.sort((a, b) => {return a - b;});
        return sortedKeys?.map(key => {return {value: key, label: STATISTICS_TEXT.get(key)};});
    }

    @computed get coordinateOptions(): LineOption[] {
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

    @computed get selectedFrameWidgetFileId(): number {
        return this.widgetStore.fileId;
    }

    @computed get effectiveRegionId(): number {
        return this.widgetStore.effectiveRegionId;
    }

    @computed get isSelectingActiveFrame(): boolean {
        return this.widgetStore.isEffectiveFrameEqualToActiveFrame && this.selectedFrameWidgetFileId !== ACTIVE_FILE_ID;
    }

    @computed get isSelectingActiveRegion(): boolean {
        const appStore = AppStore.Instance;
        if (this.widgetStore.isEffectiveFrameEqualToActiveFrame && this.selectedRegionIds?.length === 1) {
            const selectedRegionId = this.selectedRegionIds[0];
            return selectedRegionId === (appStore.selectedRegion ? appStore.selectedRegion.regionId : RegionId.CURSOR);
        }
        return false;
    }

    @computed get isStatsTypeSelectionAvailable(): boolean {
        if (this.selectedFrame) {
            if (this.activeProfileCategory === MultiProfileCategory.REGION) {
                return this.selectedRegionIds?.some(selectedRegionId => {
                    const selectedRegion = this.selectedFrame.getRegion(selectedRegionId);
                    return selectedRegion?.isClosedRegion;
                });
            } else {
                const selectedRegion = this.widgetStore.effectiveRegion;
                return selectedRegion?.isClosedRegion;
            }
        }
        return false;
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

    @computed get isSingleProfileMode(): boolean {
        return this.activeProfileCategory === MultiProfileCategory.NONE;
    }

    @action private switchToSingleModeHandily = (profileCategory: MultiProfileCategory) => {
        if (profileCategory === MultiProfileCategory.REGION) {
            this.selectSingleRegionHandily();
        } else if (profileCategory === MultiProfileCategory.STATISTIC) {
            this.selectSingleStatHandily();
        } else if (profileCategory === MultiProfileCategory.STOKES) {
            this.selectSingleStokesHandily();
        }
    };

    // Keeps the only 1 selected, or keeps active region
    @action private selectSingleRegionHandily = () => {
        if (this.selectedRegionIds?.length === 1) {
            this.selectRegionSingleMode(this.selectedRegionIds[0]);
        } else if (this.selectedRegionIds?.length > 1) {
            this.selectRegionSingleMode(RegionId.ACTIVE);
        }
    };

    // Keeps the only 1 selected, or keeps default stats type
    @action private selectSingleStatHandily = () => {
        if (this.selectedStatsTypes?.length === 1) {
            this.selectStatSingleMode(this.selectedStatsTypes[0]);
        } else if (this.selectedStatsTypes?.length > 1) {
            this.selectStatSingleMode(CARTA.StatsType.Mean);
        }
    };

    // Keeps the only 1 selected, or keeps default stokes
    @action private selectSingleStokesHandily = () => {
        if (this.selectedCoordinates?.length === 1) {
            this.selectCoordinateSingleMode(this.selectedCoordinates[0]);
        } else if (this.selectedCoordinates?.length > 1) {
            this.selectCoordinateSingleMode(this.DEFAULT_COORDINATE);
        }
    };

    @action setActiveProfileCategory = (profileCategory: MultiProfileCategory) => {
        if (profileCategory === this.activeProfileCategory) {
            return;
        }

        // Switch previously selected category to single selection mode from multi selection mode
        if (this.activeProfileCategory === MultiProfileCategory.REGION ||
            this.activeProfileCategory === MultiProfileCategory.STATISTIC ||
            this.activeProfileCategory === MultiProfileCategory.STOKES) {
            this.switchToSingleModeHandily(this.activeProfileCategory);
        }
        this.activeProfileCategory = profileCategory;

        // Set profile color
        const widgetStore = this.widgetStore;
        const primaryLineColor = widgetStore.primaryLineColor;
        widgetStore.clearProfileColors();
        if (profileCategory === MultiProfileCategory.NONE) { // Single profile mode
            widgetStore.setProfileColor(SpectralProfileWidgetStore.PRIMARY_LINE_KEY, primaryLineColor);
        } else if (profileCategory === MultiProfileCategory.IMAGE) {
            if (this.selectedFrame) {
                widgetStore.setProfileColor(this.selectedFrameFileId, primaryLineColor);
            }
        } else if (profileCategory === MultiProfileCategory.REGION) {
            if (this.selectedRegionIds?.length > 0) {
                // Active region option will be disabled in multi selection mode, switch to specific region
                if (this.selectedRegionIds[0] === RegionId.ACTIVE) {
                    this.selectRegionSingleMode(this.effectiveRegionId);
                }
                widgetStore.setProfileColor(this.selectedRegionIds[0], primaryLineColor);
            }
        } else if (profileCategory === MultiProfileCategory.STATISTIC) {
            if (this.selectedStatsTypes?.length > 0) {
                widgetStore.setProfileColor(this.selectedStatsTypes[0], primaryLineColor);
            }
        } else if (profileCategory === MultiProfileCategory.STOKES) {
            if (this.selectedCoordinates?.length > 0) {
                widgetStore.setProfileColor(this.selectedCoordinates[0], primaryLineColor);
            }
        }
    };

    // When frame is changed,
    // Single profile mode(None)/Multi profile mode of Stat/Stokes:
    //      * region - switch to active to ensure getting correct region
    //      * stokes - handled in the autorun
    // Multi profile mode of Region:
    //      * region - active region is disabled, switch to specific region
    //      * stokes - handled in the autorun
    // Multi profile mode of Image(matched images):
    //      * region - switch to active of the selected frame, and regions are shared among matched images
    //      * stokes - handled in the autorun
    @action selectFrame = (fileId: number) => {
        const widgetStore = this.widgetStore;
        widgetStore.setFileId(fileId);
        const regionId = this.activeProfileCategory === MultiProfileCategory.REGION ? this.effectiveRegionId : RegionId.ACTIVE;
        widgetStore.setRegionId(fileId, regionId);
        this.selectedRegionIds = [regionId];
    };

    @action selectRegionSingleMode = (regionId: number) => {
        const widgetStore = this.widgetStore;
        widgetStore.setFileId(this.selectedFrameFileId);
        widgetStore.setRegionId(this.selectedFrameFileId, regionId);
        this.selectedRegionIds = [regionId];
    };

    @action selectStatSingleMode = (statsType: CARTA.StatsType) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            this.selectedStatsTypes = [statsType];
        }
    };

    @action selectCoordinateSingleMode = (coordinate: string) => {
        if (SUPPORTED_STOKES.includes(coordinate)) {
            this.selectedCoordinates = [coordinate];
        }
    };

    @action removeSelectedRegionMultiMode = (regionId: number) => {
        if (this.selectedRegionIds?.includes(regionId)) {
            this.selectedRegionIds = this.selectedRegionIds.filter(region => region !== regionId);
            this.widgetStore.removeProfileColor(regionId);
        }
    };

    @action selectRegionMultiMode = (regionId: number, color: string) => {
        if (this.selectedRegionIds?.includes(regionId) && this.selectedRegionIds?.length > 1) {
            // remove selection
            this.removeSelectedRegionMultiMode(regionId);
        } else if (!this.selectedRegionIds?.includes(regionId)) {
            // add selection
            this.selectedRegionIds = [...this.selectedRegionIds, regionId].sort((a, b) => {return a - b;});
            this.widgetStore.setProfileColor(regionId, color);
        }
    };

    @action selectStatMultiMode = (statsType: CARTA.StatsType, color: string) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            if (this.selectedStatsTypes?.includes(statsType) && this.selectedStatsTypes?.length > 1) {
                // remove selection
                this.selectedStatsTypes = this.selectedStatsTypes.filter(type => type !== statsType);
                this.widgetStore.removeProfileColor(statsType);
            } else if (!this.selectedStatsTypes?.includes(statsType)) {
                // add selection
                this.selectedStatsTypes = [...this.selectedStatsTypes, statsType].sort((a, b) => {return a - b;});
                this.widgetStore.setProfileColor(statsType, color);
            }
        }
    };

    @action selectCoordinateMultiMode = (coordinate: string, color: string) => {
        if (SUPPORTED_STOKES.includes(coordinate)) {
            if (this.selectedCoordinates?.includes(coordinate) && this.selectedCoordinates.length > 1) {
                // remove selection
                this.selectedCoordinates = this.selectedCoordinates.filter(coord => coord !== coordinate);
                this.widgetStore.removeProfileColor(coordinate);
            } else if (!this.selectedCoordinates.includes(coordinate)) {
                // add selection
                this.selectedCoordinates = [...this.selectedCoordinates, coordinate].sort((a, b) => {
                    // always place z in the first element
                    if (a === 'z') {
                        return -1;
                    } else if (b === 'z') {
                        return 1;
                    }
                    return a.charCodeAt(0) - b.charCodeAt(0);
                });
                this.widgetStore.setProfileColor(coordinate, color);
            }
        }
    };

    @action private initSingleMode = () => {
        this.activeProfileCategory = MultiProfileCategory.NONE;
        this.selectedRegionIds = [RegionId.ACTIVE];
        this.selectedStatsTypes = [CARTA.StatsType.Mean];
        this.selectedCoordinates = [this.DEFAULT_COORDINATE];
        const widgetStore = this.widgetStore;
        widgetStore.clearProfileColors();
        widgetStore.setProfileColor(SpectralProfileWidgetStore.PRIMARY_LINE_KEY, widgetStore.primaryLineColor);
    };

    constructor(widgetStore: SpectralProfileWidgetStore, coordinate: string) {
        makeObservable(this);
        this.widgetStore = widgetStore;
        this.DEFAULT_COORDINATE = coordinate;
        this.initSingleMode();

        // Handle empty frame: reset
        autorun(() => {
            if (!this.selectedFrame) {
                this.initSingleMode();
            }
        });

        // When selected region was deleted: remove regionId in selectedRegionIds if it does not existed in region options
        autorun(() => {
            if (this.activeProfileCategory === MultiProfileCategory.REGION) {
                this.selectedRegionIds?.forEach(selectedRegionId => {
                    if (!this.regionOptions?.find(regionOption => selectedRegionId === regionOption.value)) {
                        this.removeSelectedRegionMultiMode(selectedRegionId);
                    }
                });

                // Once selectedRegionIds becomes empty, add cursor region (active region is disabled in multi selection mode)
                if (this.selectedRegionIds?.length === 0) {
                    this.selectRegionMultiMode(RegionId.CURSOR, widgetStore.primaryLineColor);
                }
            } else {
                if (this.selectedRegionIds?.length > 0 && !this.regionOptions?.find(regionOption => this.selectedRegionIds[0] === regionOption.value)) {
                    this.selectRegionSingleMode(RegionId.ACTIVE);
                }
            }
        });

        // When frame is changed(coordinateOptions changes), selected stokes stay unchanged if new frame also support them, otherwise to default('z')
        autorun(() => {
            if (this.selectedCoordinates?.some(coordinate => !this.coordinateOptions?.find(coordinateOption => coordinate === coordinateOption.value))) {
                this.selectCoordinateSingleMode(this.DEFAULT_COORDINATE);
            }
        });

        // When in Multi profile mode of Image and there are matched files(may change dynamically), assign them colors
        autorun(() => {
            const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
            if (matchedFileIds?.length > 1 && this.activeProfileCategory === MultiProfileCategory.IMAGE) {
                if (matchedFileIds.includes(this.selectedFrameFileId)) {
                    matchedFileIds.forEach((fileId, index) => {
                        const widgetStore = this.widgetStore;
                        if (fileId === this.selectedFrameFileId) {
                            widgetStore.setProfileColor(fileId, widgetStore.primaryLineColor);
                        } else {
                            const color = SWATCH_COLORS[index % SWATCH_COLORS.length];
                            widgetStore.setProfileColor(fileId, color);
                        }
                    });
                }
            }
        });
    }
}

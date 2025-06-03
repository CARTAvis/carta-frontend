import {CARTA} from "carta-protobuf";
import {action, autorun, computed, makeObservable, observable, reaction} from "mobx";

import {GetIntensityOptions, IntensityConfig, LineKey, LineOption, POLARIZATION_LABELS, POLARIZATIONS, STATISTICS_TEXT, StatsTypeString, SUPPORTED_STATISTICS_TYPES, VALID_COORDINATES} from "models";
import {AppStore} from "stores";
import {FrameStore} from "stores/Frame";
import {ACTIVE_FILE_ID, RegionId, SpectralProfileWidgetStore} from "stores/Widgets";
import {genColorFromIndex, ProcessedSpectralProfile} from "utilities";

export enum MultiProfileCategory {
    NONE = "None", // Single profile mode: allow only 1 profile displayed in widget
    IMAGE = "Image",
    REGION = "Region",
    STATISTIC = "Statistic",
    STOKES = "Polarization"
}

interface ProfileConfig {
    fileId: number | undefined;
    regionId: number | null;
    statsType: CARTA.StatsType;
    coordinate: string;
    colorKey: LineKey | undefined;
    label: {image: string | undefined; plot: string};
}

interface SpectralConfig extends CARTA.SetSpectralRequirements.ISpectralConfig {
    fileId: number | undefined;
    regionId: number | null;
}

const MAXIMUM_PROFILES = 16;

type Profile = {
    channelValues: number[];
    channelSecondaryValues: number[];
    data: ProcessedSpectralProfile | null | undefined;
    colorKey: LineKey | undefined;
    label: {
        image: string | undefined;
        plot: string;
    };
    comments: string[];
    intensityConfig: IntensityConfig;
    intensityUnit: string;
};

export class SpectralProfileSelectionStore {
    // profile selection
    @observable activeProfileCategory: MultiProfileCategory;
    @observable selectedFileIds: number[];
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
                let statsTypes: CARTA.StatsType[] = [];
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

    private genProfileLabel = (fileId: number | undefined, regionName: string | undefined, statsType: CARTA.StatsType, coordinate: string): {image: string | undefined; plot: string} => {
        return {
            image: AppStore.Instance.getFrameName(fileId ?? NaN),
            plot: `${regionName}, Statistic ${StatsTypeString(statsType)}, Coordinate ${POLARIZATION_LABELS.get(coordinate.slice(0, coordinate.length - 1))}`
        };
    };

    @computed private get profileConfigs(): ProfileConfig[] {
        let profileConfigs: ProfileConfig[] = [];
        if (this.selectedFrame && this.selectedRegionIds?.length > 0 && this.selectedStatsTypes?.length > 0 && this.selectedCoordinates?.length > 0) {
            if (this.activeProfileCategory === MultiProfileCategory.NONE || this.activeProfileCategory === MultiProfileCategory.IMAGE) {
                const region = this.widgetStore.effectiveRegion;
                const statsType = region?.isClosedRegion ? this.selectedStatsTypes[0] : CARTA.StatsType.Sum;
                const selectedCoordinate = this.selectedCoordinates[0];
                if (this.activeProfileCategory === MultiProfileCategory.IMAGE && this.selectedFrameFileId !== undefined) {
                    const appStore = AppStore.Instance;

                    this.selectedFileIds?.forEach(fileId => {
                        const frame = appStore.getFrame(fileId);
                        if (frame) {
                            const hasCommonIntensityUnit = this.widgetStore.intensityUnit && GetIntensityOptions(frame.intensityConfig).includes(this.widgetStore.intensityUnit);
                            if (profileConfigs.length < MAXIMUM_PROFILES && (hasCommonIntensityUnit || fileId === this.selectedFrameFileId)) {
                                profileConfigs.push({
                                    fileId: fileId,
                                    regionId: this.effectiveRegionId,
                                    statsType: statsType,
                                    coordinate: selectedCoordinate,
                                    colorKey: fileId,
                                    label: this.genProfileLabel(fileId, region?.nameString, statsType, selectedCoordinate)
                                });
                            }
                        }
                    });
                } else {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: this.effectiveRegionId,
                        statsType: statsType,
                        coordinate: selectedCoordinate,
                        colorKey: this.selectedFrameFileId,
                        label: this.genProfileLabel(this.selectedFrameFileId, region?.nameString, statsType, selectedCoordinate)
                    });
                }
            } else if (this.activeProfileCategory === MultiProfileCategory.REGION) {
                const selectedStatsType = this.selectedStatsTypes[0];
                const selectedCoordinate = this.selectedCoordinates[0];
                this.selectedRegionIds?.forEach(selectedRegionId => {
                    if (selectedRegionId !== RegionId.ACTIVE) {
                        const region = this.selectedFrame?.getRegion(selectedRegionId);
                        const statsType = region?.isClosedRegion ? selectedStatsType : CARTA.StatsType.Sum;
                        profileConfigs.push({
                            fileId: this.selectedFrameFileId,
                            regionId: selectedRegionId,
                            statsType: statsType,
                            coordinate: selectedCoordinate,
                            colorKey: selectedRegionId,
                            label: this.genProfileLabel(this.selectedFrameFileId, region?.nameString, statsType, selectedCoordinate)
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
                            label: this.genProfileLabel(this.selectedFrameFileId, region?.nameString, statsType, selectedCoordinate)
                        });
                    });
                } else {
                    profileConfigs.push({
                        fileId: this.selectedFrameFileId,
                        regionId: this.effectiveRegionId,
                        statsType: CARTA.StatsType.Sum,
                        coordinate: selectedCoordinate,
                        colorKey: CARTA.StatsType.Sum,
                        label: this.genProfileLabel(this.selectedFrameFileId, region?.nameString, CARTA.StatsType.Sum, selectedCoordinate)
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
                        label: this.genProfileLabel(this.selectedFrameFileId, region?.nameString, statsType, coordinate)
                    });
                });
            }
        }
        return profileConfigs;
    }

    @computed get profiles(): Profile[] {
        let profiles: Profile[] = [];
        this.profileConfigs?.forEach(profileConfig => {
            const appStore = AppStore.Instance;
            const frame = appStore.getFrame(profileConfig.fileId ?? NaN);
            const frameProfileStoreMap = appStore.spectralProfiles.get(profileConfig.fileId ?? NaN);
            const regionProfileStoreMap = frameProfileStoreMap?.get(profileConfig.regionId ?? NaN);
            const profileData = regionProfileStoreMap?.getProfile(profileConfig.coordinate, profileConfig.statsType);
            if (frame) {
                profiles.push({
                    channelValues: frame.channelValues,
                    channelSecondaryValues: frame.channelSecondaryValues,
                    data: profileData,
                    colorKey: profileConfig.colorKey,
                    label: profileConfig.label,
                    comments: frame.getRegionProperties(profileConfig.regionId ?? NaN),
                    intensityConfig: frame.intensityConfig,
                    intensityUnit: frame.intensityUnit
                });
            }
        });
        return profiles;
    }

    @computed get profilesPlotName(): {image: string; plot: string} {
        let images, regions, statTypes, coordinates;
        let prevFileId, prevRegionId, prevStatsType, prevCoordinate;
        images = regions = statTypes = coordinates = "";
        prevFileId = prevRegionId = prevStatsType = prevCoordinate = undefined;
        this.profileConfigs?.forEach((profileConfig, index) => {
            const fileName = AppStore.Instance.getFrame(profileConfig.fileId ?? NaN)?.filename;
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
                coordinates += `${index === 0 ? "" : ","}${POLARIZATION_LABELS.get(profileConfig.coordinate.slice(0, profileConfig.coordinate.length - 1))}}`;
            }
            prevFileId = profileConfig.fileId;
            prevRegionId = profileConfig.regionId;
            prevStatsType = profileConfig.statsType;
            prevCoordinate = profileConfig.coordinate;
        });
        return {image: images, plot: `Z-Profile-Region_${regions}-Statistic_${statTypes}-Coordinate_${coordinates}`};
    }

    @computed get profileOrderedKeys(): LineKey[] | undefined {
        if (this.activeProfileCategory === MultiProfileCategory.NONE) {
            return [SpectralProfileWidgetStore.PRIMARY_LINE_KEY];
        } else if (this.activeProfileCategory === MultiProfileCategory.IMAGE && this.selectedFrameFileId !== undefined) {
            return this.selectedFileIds;
        } else if (this.activeProfileCategory === MultiProfileCategory.REGION) {
            return this.selectedRegionIds;
        } else if (this.activeProfileCategory === MultiProfileCategory.STATISTIC) {
            return this.selectedStatsTypes;
        } else if (this.activeProfileCategory === MultiProfileCategory.STOKES) {
            return this.selectedCoordinates;
        }
        return undefined;
    }

    @computed get profileOptions(): LineOption[] | undefined {
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
        let options: LineOption[] = [{value: ACTIVE_FILE_ID, label: "Active", disabled: this.activeProfileCategory === MultiProfileCategory.IMAGE}];

        const appStore = AppStore.Instance;
        const frameOptions = appStore.frameOptions;
        if (this.activeProfileCategory === MultiProfileCategory.IMAGE) {
            const matchedFrameIds = appStore.spatialAndSpectalMatchedFileIds;

            // Highlight matched active option
            if (matchedFrameIds?.length > 1 && matchedFrameIds?.includes(appStore.activeFrameFileId)) {
                const activeOption = options.find(option => option.value === ACTIVE_FILE_ID);
                if (activeOption) {
                    activeOption.label = "Active (matched)";
                    activeOption.hightlight = true;
                }
            }

            frameOptions?.forEach(frameNameOption => {
                const isMatched = matchedFrameIds?.length > 1 && matchedFrameIds?.includes(frameNameOption.value as number);
                options.push({
                    value: frameNameOption.value,
                    label: `${frameNameOption.label}${isMatched ? " (matched)" : ""}`,
                    hightlight: isMatched,
                    active: frameNameOption.value === appStore.activeFrameFileId,
                    disabled: !frameNameOption.hasZAxis
                });
            });

            options.forEach(option => {
                const frame = appStore.getFrame(option.value as number);
                if (frame) {
                    const hasCommonIntensityUnit = this.widgetStore.intensityUnit && GetIntensityOptions(frame.intensityConfig).includes(this.widgetStore.intensityUnit);
                    option.label += !((option.value as number) === ACTIVE_FILE_ID) && !hasCommonIntensityUnit && !((option.value as number) === this.selectedFrameFileId) ? " (hidden)" : "";
                }
            });
        } else {
            options = options.concat(
                frameOptions?.map(frameNameOption => {
                    return {
                        value: frameNameOption.value,
                        label: frameNameOption.label,
                        active: frameNameOption.value === appStore.activeFrameFileId,
                        disabled: !frameNameOption.hasZAxis
                    };
                })
            );
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
            options = options.concat(
                filteredRegions?.map(r => {
                    return {
                        value: r.regionId,
                        label: r.nameString,
                        active: r.regionId === activeRegionId
                    };
                })
            );
        }
        return options;
    }

    @computed get statsTypeOptions(): LineOption[] {
        const sortedKeys = Array.from(STATISTICS_TEXT.keys())?.sort((a, b) => {
            return a - b;
        });
        return sortedKeys?.map(key => {
            return {value: key, label: STATISTICS_TEXT.get(key)};
        });
    }

    @computed get coordinateOptions(): LineOption[] {
        let options = [{value: "z", label: "Current"}];
        if (this.selectedFrame?.hasStokes) {
            this.selectedFrame.polarizationInfo?.forEach(polarization => options.push({value: `${polarization.replace("Stokes ", "")}z`, label: polarization}));
        }
        return options;
    }

    @computed get selectedFrame(): FrameStore | null | undefined {
        return this.widgetStore.effectiveFrame;
    }

    @computed get selectedFrameFileId(): number | undefined {
        return this.selectedFrame?.frameInfo.fileId;
    }

    @computed get selectedFrameWidgetFileId(): number {
        return this.widgetStore.fileId;
    }

    @computed get effectiveRegionId(): number | null {
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
                    const selectedRegion = this.selectedFrame?.getRegion(selectedRegionId);
                    return selectedRegion?.isClosedRegion;
                });
            } else {
                const selectedRegion = this.widgetStore.effectiveRegion;
                return selectedRegion === undefined ? false : selectedRegion.isClosedRegion;
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

    @computed private get effectivePolarizations(): POLARIZATIONS[] {
        const polarizations: POLARIZATIONS[] = [];
        if (this.selectedCoordinates) {
            this.selectedCoordinates.forEach(coordinate => {
                polarizations.push(coordinate === "z" ? this.widgetStore.effectiveFrame?.requiredPolarization : POLARIZATIONS[coordinate.substring(0, coordinate.length - 1)]);
            });
        }
        return polarizations;
    }

    @computed get isCoordinatesPangleOnly(): boolean {
        return !this.effectivePolarizations?.some(polarization => POLARIZATIONS.Pangle !== polarization);
    }

    @computed get isCoordinatesPFtotalPFlinearOnly(): boolean {
        return !this.effectivePolarizations?.some(polarization => ![POLARIZATIONS.PFtotal, POLARIZATIONS.PFlinear].includes(polarization));
    }

    @computed get isCoordinatesIncludingNonIntensityUnit(): boolean {
        return this.effectivePolarizations.some(polarization => [POLARIZATIONS.PFtotal, POLARIZATIONS.PFlinear, POLARIZATIONS.Pangle].includes(polarization));
    }

    @computed get isSameCoordinatesUnit(): boolean {
        // unit of Fractional Polarization total/linear: %, unit of Polarization Angle: degree, others: Jy/Beam
        return this.isCoordinatesPFtotalPFlinearOnly || this.isCoordinatesPangleOnly || !this.isCoordinatesIncludingNonIntensityUnit;
    }

    @computed get isSingleProfileMode(): boolean {
        return this.activeProfileCategory === MultiProfileCategory.NONE;
    }

    @computed get isShowingProfilesOfMultiImages(): boolean {
        return this.activeProfileCategory === MultiProfileCategory.IMAGE && this.profiles?.length > 1;
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
        if (this.activeProfileCategory === MultiProfileCategory.REGION || this.activeProfileCategory === MultiProfileCategory.STATISTIC || this.activeProfileCategory === MultiProfileCategory.STOKES) {
            this.switchToSingleModeHandily(this.activeProfileCategory);
        }
        this.activeProfileCategory = profileCategory;

        // Set profile color
        const widgetStore = this.widgetStore;
        const primaryLineColor = widgetStore.primaryLineColor;
        widgetStore.clearProfileColors();

        if (profileCategory === MultiProfileCategory.NONE) {
            // Single profile mode
            widgetStore.setProfileColor(SpectralProfileWidgetStore.PRIMARY_LINE_KEY, primaryLineColor);
        } else if (profileCategory === MultiProfileCategory.IMAGE) {
            if (this.selectedFrame && this.selectedFrameFileId !== undefined) {
                // Reset selected frames
                this.selectedFileIds = [this.selectedFrameFileId];
                // Switch spectral system to Radio velocity for common use case
                this.selectedFrame.setSpectralCoordinateToRadioVelocity();
                widgetStore.setProfileColor(this.selectedFrameFileId, primaryLineColor);
            }
        } else if (profileCategory === MultiProfileCategory.REGION) {
            if (this.selectedRegionIds?.length > 0) {
                // Active region option will be disabled in multi selection mode, switch to specific region
                if (this.selectedRegionIds[0] === RegionId.ACTIVE && this.effectiveRegionId !== null) {
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

    private assignColor = (selectedId: number | string) => {
        const widgetStore = this.widgetStore;
        const profileColors = [...widgetStore.lineColorMap.values()]; // existing profile colors
        const profileColor = widgetStore.getProfileColor(selectedId);

        if (!profileColor) {
            let color: string = genColorFromIndex(0);

            // find color that is not used by other profiles
            for (let i = 0; i < profileColors.length + 1; i++) {
                color = genColorFromIndex(i);
                if (!profileColors.includes(color)) {
                    break;
                }
            }

            widgetStore.setProfileColor(selectedId, color);
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
        if (regionId !== null) {
            widgetStore.setRegionId(fileId, regionId);
            this.selectedRegionIds = [regionId];
        }
    };

    @action selectFrameMultiMode = (fileId: number) => {
        const widgetStore = this.widgetStore;
        const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;

        if (this.selectedFrameFileId !== undefined && (!matchedFileIds?.includes(fileId) || !matchedFileIds?.includes(this.selectedFrameFileId))) {
            this.selectedFileIds = [fileId];
            widgetStore.setFileId(fileId);
            widgetStore.clearProfileColors();
            this.assignColor(fileId);
            return;
        }

        if (this.selectedFileIds?.includes(fileId) && this.selectedFileIds?.length > 1) {
            // remove selection
            this.removeSelectedFileMultiMode(fileId);
        } else if (!this.selectedFileIds?.includes(fileId) && this.selectedFileIds?.length < MAXIMUM_PROFILES) {
            // add selection
            this.selectedFileIds = [...this.selectedFileIds, fileId].sort((a, b) => {
                return a - b;
            });
            this.assignColor(fileId);
        }
    };

    @action removeSelectedFileMultiMode = (fileId: number) => {
        if (this.selectedFileIds?.includes(fileId)) {
            this.selectedFileIds = this.selectedFileIds.filter(selectedFileId => selectedFileId !== fileId);
            this.widgetStore.removeProfileColor(fileId);
        }
    };

    @action selectRegionSingleMode = (regionId: number) => {
        const widgetStore = this.widgetStore;
        if (this.selectedFrameFileId !== undefined) {
            widgetStore.setFileId(this.selectedFrameFileId);
            widgetStore.setRegionId(this.selectedFrameFileId, regionId);
        }
        this.selectedRegionIds = [regionId];
    };

    @action selectStatSingleMode = (statsType: CARTA.StatsType) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            this.selectedStatsTypes = [statsType];
        }
    };

    @action selectCoordinateSingleMode = (coordinate: string) => {
        if (VALID_COORDINATES.includes(coordinate)) {
            this.selectedCoordinates = [coordinate];
        }
    };

    @action removeSelectedRegionMultiMode = (regionId: number) => {
        if (this.selectedRegionIds?.includes(regionId)) {
            this.selectedRegionIds = this.selectedRegionIds.filter(region => region !== regionId);
            this.widgetStore.removeProfileColor(regionId);
        }
    };

    @action selectRegionMultiMode = (regionId: number) => {
        if (this.selectedRegionIds?.includes(regionId) && this.selectedRegionIds?.length > 1) {
            // remove selection
            this.removeSelectedRegionMultiMode(regionId);
        } else if (!this.selectedRegionIds?.includes(regionId) && this.selectedRegionIds?.length < MAXIMUM_PROFILES) {
            // add selection
            this.selectedRegionIds = [...this.selectedRegionIds, regionId].sort((a, b) => {
                return a - b;
            });
            this.assignColor(regionId);
        }
    };

    @action selectStatMultiMode = (statsType: CARTA.StatsType) => {
        if (SUPPORTED_STATISTICS_TYPES.includes(statsType)) {
            if (this.selectedStatsTypes?.includes(statsType) && this.selectedStatsTypes?.length > 1) {
                // remove selection
                this.selectedStatsTypes = this.selectedStatsTypes.filter(type => type !== statsType);
                this.widgetStore.removeProfileColor(statsType);
            } else if (!this.selectedStatsTypes?.includes(statsType) && this.selectedStatsTypes?.length < MAXIMUM_PROFILES) {
                // add selection
                this.selectedStatsTypes = [...this.selectedStatsTypes, statsType].sort((a, b) => {
                    return a - b;
                });
                this.assignColor(statsType as number);
            }
        }
    };

    @action selectCoordinateMultiMode = (coordinate: string) => {
        if (VALID_COORDINATES.includes(coordinate)) {
            if (this.selectedCoordinates?.includes(coordinate) && this.selectedCoordinates.length > 1) {
                // remove selection
                this.selectedCoordinates = this.selectedCoordinates.filter(coord => coord !== coordinate);
                this.widgetStore.removeProfileColor(coordinate);
            } else if (!this.selectedCoordinates.includes(coordinate) && this.selectedCoordinates?.length < MAXIMUM_PROFILES) {
                // add selection
                this.selectedCoordinates = [...this.selectedCoordinates, coordinate].sort((a, b) => {
                    // always place z in the first element
                    if (a === "z") {
                        return -1;
                    } else if (b === "z") {
                        return 1;
                    }
                    return a.charCodeAt(0) - b.charCodeAt(0);
                });
                this.assignColor(coordinate);
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
                    this.selectRegionMultiMode(RegionId.CURSOR);
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

        // Selecting active frame in the single frame mode
        autorun(() => {
            if (this.activeProfileCategory !== MultiProfileCategory.IMAGE) {
                this.selectFrame(ACTIVE_FILE_ID);
            }
        });

        reaction(
            () => {
                const matchedFileIds = AppStore.Instance.spatialAndSpectalMatchedFileIds;
                return matchedFileIds;
            },
            matchedFileIds => {
                if (this.activeProfileCategory === MultiProfileCategory.IMAGE) {
                    // remove the profile if it is unmatched
                    this.selectedFileIds.forEach(fileId => {
                        if (!matchedFileIds?.includes(fileId)) {
                            this.removeSelectedFileMultiMode(fileId);
                        }
                    });

                    // if no selected frame under the multi-frame mode, add the selected frame
                    if (this.selectedFileIds.length === 0 && this.selectedFrameFileId !== undefined) {
                        this.selectedFileIds = [this.selectedFrameFileId];
                    }
                }
            }
        );
    }
}

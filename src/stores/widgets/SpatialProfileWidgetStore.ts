import {action, computed, observable} from "mobx";
import {PlotType} from "components/Shared";
import {FrameStore} from "../FrameStore";
import {CARTA} from "carta-protobuf";

export class SpatialProfileWidgetStore {
    @observable fileId: number;
    @observable regionId: number;
    @observable coordinate: string;
    @observable minX: number;
    @observable maxX: number;
    @observable minY: number;
    @observable maxY: number;
    @observable cursorX: number;
    @observable plotType: PlotType;
    @observable settingsPanelVisible: boolean;
    @observable meanRmsVisible: boolean;
    @observable wcsAxisVisible: boolean;
    @observable markerTextVisible: boolean;
    @observable isMouseMoveIntoLinePlots: boolean;

    private static ValidCoordinates = ["x", "y", "Ix", "Iy", "Qx", "Qy", "Ux", "Uy", "Vx", "Vz"];

    @action setFileId = (fileId: number) => {
        // Reset zoom when changing between files
        this.clearXYBounds();
        this.fileId = fileId;
    };

    @action setRegionId = (regionId: number) => {
        // Reset zoom when changing between regions
        this.clearXYBounds();
        this.regionId = regionId;
    };

    @action setCoordinate = (coordinate: string) => {
        // Check coordinate validity
        if (SpatialProfileWidgetStore.ValidCoordinates.indexOf(coordinate) !== -1) {
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

    @action setWcsAxisVisible = (val: boolean) => {
        this.wcsAxisVisible = val;
    };

    @action setPlotType = (val: PlotType) => {
        this.plotType = val;
    };

    @action setCursor = (cursorVal: number) => {
        this.cursorX = cursorVal;
    };

    @action setMouseMoveIntoLinePlots = (val: boolean) => {
        this.isMouseMoveIntoLinePlots = val;
    };

    constructor(coordinate: string = "x", fileId: number = -1, regionId: number = 0) {
        // Describes which data is being visualised
        this.coordinate = coordinate;
        this.fileId = fileId;
        this.regionId = regionId;

        // Describes how the data is visualised
        this.plotType = PlotType.STEPS;
        this.settingsPanelVisible = false;
        this.meanRmsVisible = false;
        this.markerTextVisible = false;
        this.wcsAxisVisible = true;
    }

    @computed get isAutoScaledX() {
        return (this.minX === undefined || this.maxX === undefined);
    }

    @computed get isAutoScaledY() {
        return (this.minY === undefined || this.maxY === undefined);
    }

    public static CalculateRequirementsMap(frame: FrameStore, widgetsMap: Map<string, SpatialProfileWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetSpatialRequirements>>();
        widgetsMap.forEach(widgetStore => {
            const fileId = frame.frameInfo.fileId;
            // Cursor region only for now
            const regionId = 0;
            const coordinate = widgetStore.coordinate;

            if (!frame.regionSet) {
                return;
            }

            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (region) {
                let frameRequirements = updatedRequirements.get(fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetSpatialRequirements>();
                    updatedRequirements.set(fileId, frameRequirements);
                }

                let regionRequirements = frameRequirements.get(regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetSpatialRequirements({regionId, fileId});
                    frameRequirements.set(regionId, regionRequirements);
                }

                if (!regionRequirements.spatialProfiles) {
                    regionRequirements.spatialProfiles = [];
                }

                if (regionRequirements.spatialProfiles.indexOf(coordinate) === -1) {
                    regionRequirements.spatialProfiles.push(coordinate);
                }
            }
        });

        return updatedRequirements;
    }

    // This function diffs the updated requirements map with the existing requirements map, and reacts to changes
    // Three diff cases are checked:
    // 1. The old map has an entry, but the new one does not => send an "empty" SetSpectralRequirements message
    // 2. The old and new maps both have entries, but they are different => send the new SetSpectralRequirements message
    // 3. The new map has an entry, but the old one does not => send the new SetSpectralRequirements message
    // The easiest way to check all three is to first add any missing entries to the new map (as empty requirements), and then check the updated maps entries
    public static DiffSpatialRequirements(originalRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetSpatialRequirements>>) {
        const diffList: CARTA.SetSpatialRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetSpatialRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetSpatialRequirements({fileId, regionId, spatialProfiles: []});
                    updatedFrameRequirements.set(regionId, updatedRegionRequirements);
                }
            });
        });

        // Go through updated requirements entries and find differences
        updatedRequirements.forEach((updatedFrameRequirements, fileId) => {
            let frameRequirements = originalRequirements.get(fileId);
            if (!frameRequirements) {
                // If there are no existing requirements for this fileId, all entries for this file are new
                updatedFrameRequirements.forEach(regionRequirements => diffList.push(regionRequirements));
            } else {
                updatedFrameRequirements.forEach((updatedRegionRequirements, regionId) => {
                    let regionRequirements = frameRequirements.get(regionId);
                    if (!regionRequirements) {
                        // If there are no existing requirements for this regionId, this is a new entry
                        diffList.push(updatedRegionRequirements);
                    } else {
                        // Deep equality comparison with sorted arrays
                        const configCount = regionRequirements.spatialProfiles ? regionRequirements.spatialProfiles.length : 0;
                        const updatedConfigCount = updatedRegionRequirements.spatialProfiles ? updatedRegionRequirements.spatialProfiles.length : 0;

                        if (configCount !== updatedConfigCount) {
                            diffList.push(updatedRegionRequirements);
                            return;
                        }

                        if (configCount === 0) {
                            return;
                        }
                        const sortedUpdatedConfigs = updatedRegionRequirements.spatialProfiles.sort();
                        const sortedConfigs = regionRequirements.spatialProfiles.sort();

                        for (let i = 0; i < updatedConfigCount; i++) {
                            const updatedConfig = sortedUpdatedConfigs[i];
                            const config = sortedConfigs[i];
                            if (updatedConfig !== config) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }
                        }
                    }
                });
            }

        });
        // Sort list so that requirements clearing occurs first
        return diffList.sort((a, b) => a.spatialProfiles.length > b.spatialProfiles.length ? 1 : -1);
    }
}
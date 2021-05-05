import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "stores/widgets";
import {action, observable, makeObservable} from "mobx";

export class StatsWidgetStore extends RegionWidgetStore {
    @observable coordinate: string;

    private static ValidCoordinates = ["z", "Iz", "Qz", "Uz", "Vz"];

    @action setCoordinate = (coordinate: string) => {
        // Check coordinate validity
        if (StatsWidgetStore.ValidCoordinates.indexOf(coordinate) !== -1) {
            this.coordinate = coordinate;
        }
    };

    constructor() {
        super(RegionsType.CLOSED);
        makeObservable(this);
        this.coordinate = "z";
    }

    public static CalculateRequirementsMap(widgetsMap: Map<string, StatsWidgetStore>) {
        const updatedRequirements = new Map<number, Map<number, CARTA.SetStatsRequirements>>();

        widgetsMap.forEach(widgetStore => {
            const frame = widgetStore.effectiveFrame;
            if (!frame || !frame.regionSet) {
                return;
            }
            const fileId = frame.frameInfo.fileId;
            const regionId = widgetStore.effectiveRegionId;
            const coordinate = widgetStore.coordinate;
            const region = frame.regionSet.regions.find(r => r.regionId === regionId);
            if (regionId === -1 || (region && region.isClosedRegion)) {

                let frameRequirements = updatedRequirements.get(fileId);
                if (!frameRequirements) {
                    frameRequirements = new Map<number, CARTA.SetStatsRequirements>();
                    updatedRequirements.set(fileId, frameRequirements);
                }

                let regionRequirements = frameRequirements.get(regionId);
                if (!regionRequirements) {
                    regionRequirements = new CARTA.SetStatsRequirements({fileId, regionId});
                    frameRequirements.set(regionId, regionRequirements);
                }

                if (!regionRequirements.statsConfigs) {
                    regionRequirements.statsConfigs =[];
                }

                let hitogramConfig = regionRequirements.statsConfigs.find(config => config.coordinate === coordinate);
                if (!hitogramConfig) {
                    regionRequirements.statsConfigs.push({coordinate: coordinate, statsTypes: AppStore.DEFAULT_STATS_TYPES});
                }

            }
        });
        return updatedRequirements;
    }

    public static DiffRequirementsArray(originalRequirements: Map<number, Array<number>>, updatedRequirements: Map<number, Array<number>>) {
        const diffList: CARTA.SetStatsRequirements[] = [];

        // Three possible scenarios:
        // 1. Existing array, no new array => diff should be empty stats requirements for each element of existing array
        // 2. No existing array, new array => diff should be full stats requirements for each element of new array
        // 3. Existing array and new array => diff should be empty stats for those missing in new array, full stats for those missing in old array

        // (1) & (3) handled first
        originalRequirements.forEach((statsArray, fileId) => {
            const updatedStatsArray = updatedRequirements.get(fileId);
            // If there's no new array, remove requirements for all existing regions
            if (!updatedStatsArray) {
                for (const regionId of statsArray) {
                    diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, statsConfigs: []}));
                }
            } else {
                // If regions in the new array are missing, remove requirements for those regions
                for (const regionId of statsArray) {
                    if (updatedStatsArray.indexOf(regionId) === -1) {
                        diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, statsConfigs: []}));
                    }
                }
                // If regions in the existing array are missing, add requirements for those regions
                for (const regionId of updatedStatsArray) {
                    if (statsArray.indexOf(regionId) === -1) {
                        diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, statsConfigs: [{ coordinate: "z", statsTypes: AppStore.DEFAULT_STATS_TYPES}]}));
                    }
                }
            }
        });

        updatedRequirements.forEach((updatedStatsArray, fileId) => {
            const statsArray = originalRequirements.get(fileId);
            // If there's no existing array, add requirements for all new regions
            if (!statsArray) {
                for (const regionId of updatedStatsArray) {
                    diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, statsConfigs: [{ coordinate: "z", statsTypes: AppStore.DEFAULT_STATS_TYPES}]}));
                }
            }
        });

        return diffList;
    }

    // This function diffs the updated requirements map with the existing requirements map, and reacts to changes
    // Three diff cases are checked:
    // 1. The old map has an entry, but the new one does not => send an "empty" SetSpectralRequirements message
    // 2. The old and new maps both have entries, but they are different => send the new SetSpectralRequirements message
    // 3. The new map has an entry, but the old one does not => send the new SetSpectralRequirements message
    // The easiest way to check all three is to first add any missing entries to the new map (as empty requirements), and then check the updated maps entries
    public static DiffStatsRequirements(originalRequirements: Map<number, Map<number, CARTA.SetStatsRequirements>>, updatedRequirements: Map<number, Map<number, CARTA.SetStatsRequirements>>) {
        const diffList: CARTA.SetStatsRequirements[] = [];

        // Fill updated requirements with missing entries
        originalRequirements.forEach((frameRequirements, fileId) => {
            let updatedFrameRequirements = updatedRequirements.get(fileId);
            if (!updatedFrameRequirements) {
                updatedFrameRequirements = new Map<number, CARTA.SetStatsRequirements>();
                updatedRequirements.set(fileId, updatedFrameRequirements);
            }
            frameRequirements.forEach((regionRequirements, regionId) => {
                let updatedRegionRequirements = updatedFrameRequirements.get(regionId);
                if (!updatedRegionRequirements) {
                    updatedRegionRequirements = new CARTA.SetStatsRequirements({fileId, regionId, statsConfigs: []});
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
                        const configCount = regionRequirements.statsConfigs ? regionRequirements.statsConfigs.length : 0;
                        const updatedConfigCount = updatedRegionRequirements.statsConfigs ? updatedRegionRequirements.statsConfigs.length : 0;

                        if (configCount !== updatedConfigCount) {
                            diffList.push(updatedRegionRequirements);
                            return;
                        }

                        if (configCount === 0) {
                            return;
                        }
                        const sortedUpdatedConfigs = updatedRegionRequirements.statsConfigs.sort(((a, b) => a.coordinate > b.coordinate ? 1 : -1));
                        const sortedConfigs = regionRequirements.statsConfigs.sort(((a, b) => a.coordinate > b.coordinate ? 1 : -1));

                        for (let i = 0; i < updatedConfigCount; i++) {
                            const updatedConfig = sortedUpdatedConfigs[i];
                            const config = sortedConfigs[i];
                            if (updatedConfig.coordinate !== config.coordinate) {
                                diffList.push(updatedRegionRequirements);
                                return;
                            }
                        }
                    }
                });
            }

        });
        // Sort list so that requirements clearing occurs first
        return diffList.sort((a, b) => a.statsConfigs.length > b.statsConfigs.length ? 1 : -1);
    }
}
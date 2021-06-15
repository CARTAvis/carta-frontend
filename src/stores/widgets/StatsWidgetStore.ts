import {CARTA} from "carta-protobuf";
import {AppStore} from "stores";
import {RegionWidgetStore, RegionsType} from "stores/widgets";

export class StatsWidgetStore extends RegionWidgetStore {
    constructor() {
        super(RegionsType.CLOSED);
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
                    diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, stats: []}));
                }
            } else {
                // If regions in the new array are missing, remove requirements for those regions
                for (const regionId of statsArray) {
                    if (updatedStatsArray.indexOf(regionId) === -1) {
                        diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, stats: []}));
                    }
                }
                // If regions in the existing array are missing, add requirements for those regions
                for (const regionId of updatedStatsArray) {
                    if (statsArray.indexOf(regionId) === -1) {
                        diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, stats: AppStore.DEFAULT_STATS_TYPES}));
                    }
                }
            }
        });

        updatedRequirements.forEach((updatedStatsArray, fileId) => {
            const statsArray = originalRequirements.get(fileId);
            // If there's no existing array, add requirements for all new regions
            if (!statsArray) {
                for (const regionId of updatedStatsArray) {
                    diffList.push(CARTA.SetStatsRequirements.create({fileId, regionId, stats: AppStore.DEFAULT_STATS_TYPES}));
                }
            }
        });

        return diffList;
    }
}

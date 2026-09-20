// @ts-ignore Generated protobuf module is linked during the application build.
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, ObservableMap} from "mobx";

import {RegionGroupType} from "enums";

export interface RegionGroupRegion {
    regionId: number;
    regionSum?: number;
    regionMean?: number;
}

export type RegionGroupEntry = {
    frameId: number;
    region: RegionGroupRegion;
};

export class RegionGroupStore {
    @observable regionGroupId: string;
    @observable regionGroupName: string;
    @observable regionGroupType: RegionGroupType;
    @observable regionGroup: ObservableMap<number, RegionGroupRegion> = new ObservableMap();

    constructor(regionGroupId = "", regionGroupName = "Region Group", regionGroupType: RegionGroupType = RegionGroupType.TIME_SERIES, entries?: Iterable<RegionGroupEntry>) {
        this.regionGroupId = regionGroupId;
        this.regionGroupName = regionGroupName;
        this.regionGroupType = regionGroupType;
        for (const entry of entries ?? []) {
            this.regionGroup.set(entry.frameId, {...entry.region});
        }
        makeObservable(this);
    }

    @computed get entries(): RegionGroupEntry[] {
        return Array.from(this.regionGroup, ([frameId, region]) => ({frameId, region}));
    }

    @action setName = (name: string) => {
        this.regionGroupName = name;
    };

    @action setType = (type: RegionGroupType) => {
        this.regionGroupType = type;
    };

    @action setRegion = (frameId: number, regionId: number, statistics?: Pick<RegionGroupRegion, "regionSum" | "regionMean">) => {
        const region: RegionGroupRegion = {regionId};
        if (statistics?.regionSum !== undefined) {
            region.regionSum = statistics.regionSum;
        }
        if (statistics?.regionMean !== undefined) {
            region.regionMean = statistics.regionMean;
        }
        this.regionGroup.set(frameId, region);
    };

    @action removeRegion = (frameId: number) => {
        this.regionGroup.delete(frameId);
    };

    @action updateRegionStats = (stats: CARTA.RegionStatsData) => {
        const region = this.regionGroup.get(stats.fileId);
        if (!region || region.regionId !== stats.regionId) {
            return;
        }

        this.setRegion(stats.fileId, region.regionId, {
            regionSum: stats.statistics?.find(value => value.statsType === CARTA.StatsType.Sum)?.value,
            regionMean: stats.statistics?.find(value => value.statsType === CARTA.StatsType.Mean)?.value
        });
    };

    @action clear = () => {
        this.regionGroup.clear();
    };

    copy = (regionGroupId: string, regionGroupName = this.regionGroupName): RegionGroupStore => {
        return new RegionGroupStore(regionGroupId, regionGroupName, this.regionGroupType, this.entries);
    };
}

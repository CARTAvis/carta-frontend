// @ts-ignore Generated protobuf module is linked during the application build.
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, ObservableMap} from "mobx";

import {RegionGroupType} from "enums";

export interface RegionGroupRegion {
    regionId?: number;
    mjdUtc?: number;
    isoUtc?: string;
    stokes?: number;
    regionSum?: number;
    regionFluxDensity?: number;
    regionMean?: number;
    regionSumUnit?: string;
    regionFluxDensityUnit?: string;
}

export type RegionGroupEntry = {
    frameId: number;
    region: RegionGroupRegion;
};

export type RegionGroupFrame = {
    frameId: number;
    mjdUtc: number;
    isoUtc: string;
    stokes: number;
    regionIds: readonly number[];
    regionSumUnit: string;
    regionFluxDensityUnit: string;
};

type RegionGroupStatistics = Pick<RegionGroupRegion, "regionSum" | "regionFluxDensity" | "regionMean">;

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

    @action setRegion = (frameId: number, regionId: number, statistics?: Pick<RegionGroupRegion, "regionSum" | "regionFluxDensity" | "regionMean">) => {
        const current = this.regionGroup.get(frameId);
        const isSameRegion = current?.regionId === regionId;
        const region: RegionGroupRegion = {
            ...current,
            regionId,
            regionSum: isSameRegion ? (current.regionSum ?? NaN) : NaN,
            regionFluxDensity: isSameRegion ? (current.regionFluxDensity ?? NaN) : NaN,
            regionMean: isSameRegion ? (current.regionMean ?? NaN) : NaN
        };
        if (statistics?.regionSum !== undefined) {
            region.regionSum = statistics.regionSum;
        }
        if (statistics?.regionFluxDensity !== undefined) {
            region.regionFluxDensity = statistics.regionFluxDensity;
        }
        if (statistics?.regionMean !== undefined) {
            region.regionMean = statistics.regionMean;
        }
        this.regionGroup.set(frameId, region);
    };

    @action syncTimeSeriesFrames = (frames: readonly RegionGroupFrame[], getStatistics?: (frameId: number, regionId: number, stokes: number) => RegionGroupStatistics | undefined) => {
        const frameIds = new Set(frames.map(frame => frame.frameId));
        for (const frameId of this.regionGroup.keys()) {
            if (!frameIds.has(frameId)) {
                this.regionGroup.delete(frameId);
            }
        }

        for (const frame of frames) {
            const current = this.regionGroup.get(frame.frameId);
            const regionId = current?.regionId !== undefined && frame.regionIds.includes(current.regionId) ? current.regionId : frame.regionIds[0];
            const shouldResetStatistics = current?.regionId !== regionId || current?.stokes !== frame.stokes;
            const statistics = regionId === undefined ? undefined : getStatistics?.(frame.frameId, regionId, frame.stokes);
            this.regionGroup.set(frame.frameId, {
                regionId,
                mjdUtc: frame.mjdUtc,
                isoUtc: frame.isoUtc,
                stokes: frame.stokes,
                regionSum: shouldResetStatistics ? (statistics?.regionSum ?? NaN) : (current?.regionSum ?? statistics?.regionSum ?? NaN),
                regionFluxDensity: shouldResetStatistics ? (statistics?.regionFluxDensity ?? NaN) : (current?.regionFluxDensity ?? statistics?.regionFluxDensity ?? NaN),
                regionMean: shouldResetStatistics ? (statistics?.regionMean ?? NaN) : (current?.regionMean ?? statistics?.regionMean ?? NaN),
                regionSumUnit: frame.regionSumUnit,
                regionFluxDensityUnit: frame.regionFluxDensityUnit
            });
        }
    };

    @action removeRegion = (frameId: number) => {
        this.regionGroup.delete(frameId);
    };

    @action updateRegionStats = (stats: CARTA.RegionStatsData) => {
        const region = this.regionGroup.get(stats.fileId);
        if (!region || region.regionId === undefined || region.regionId !== stats.regionId || region.stokes !== stats.stokes) {
            return;
        }

        this.setRegion(stats.fileId, region.regionId, {
            regionSum: stats.statistics?.find(value => value.statsType === CARTA.StatsType.Sum)?.value ?? undefined,
            regionFluxDensity: stats.statistics?.find(value => value.statsType === CARTA.StatsType.FluxDensity)?.value ?? undefined,
            regionMean: stats.statistics?.find(value => value.statsType === CARTA.StatsType.Mean)?.value ?? undefined
        });
    };

    @action clear = () => {
        this.regionGroup.clear();
    };
}

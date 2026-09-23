// @ts-ignore Generated protobuf module is linked during the application build.
import {CARTA} from "carta-protobuf";
import {action, computed, makeObservable, observable, ObservableMap} from "mobx";

import {RegionGroupType} from "enums";

export interface RegionGroupRegion {
    frameId?: number;
    regionId?: number;
    isDisplayed?: boolean;
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

export type RegionSeriesFrame = Omit<RegionGroupFrame, "mjdUtc" | "isoUtc">;

type RegionGroupStatistics = Pick<RegionGroupRegion, "regionSum" | "regionFluxDensity" | "regionMean">;

export class RegionGroupStore {
    @observable regionGroupId: string;
    @observable regionGroupName: string;
    @observable regionGroupType: RegionGroupType;
    @observable regionSeriesFrameId: number | undefined = undefined;
    @observable regionGroup: ObservableMap<number, RegionGroupRegion> = new ObservableMap();

    constructor(regionGroupId = "", regionGroupName = "Region Group", regionGroupType: RegionGroupType = RegionGroupType.TIME_SERIES, entries?: Iterable<RegionGroupEntry>) {
        this.regionGroupId = regionGroupId;
        this.regionGroupName = regionGroupName;
        this.regionGroupType = regionGroupType;
        for (const entry of entries ?? []) {
            const entryId = regionGroupType === RegionGroupType.REGION_SERIES ? entry.region.regionId : entry.frameId;
            if (entryId !== undefined) {
                this.regionGroup.set(entryId, regionGroupType === RegionGroupType.REGION_SERIES ? {...entry.region, frameId: entry.frameId} : {...entry.region});
                if (regionGroupType === RegionGroupType.REGION_SERIES) {
                    this.regionSeriesFrameId = entry.frameId;
                }
            }
        }
        makeObservable(this);
    }

    @computed get entries(): RegionGroupEntry[] {
        return Array.from(this.regionGroup, ([entryId, region]) => ({frameId: region.frameId ?? entryId, region}));
    }

    @action setName = (name: string) => {
        this.regionGroupName = name;
    };

    @action setType = (type: RegionGroupType) => {
        if (this.regionGroupType !== type) {
            this.regionGroup.clear();
            this.regionSeriesFrameId = undefined;
        }
        this.regionGroupType = type;
    };

    @action setRegionSeriesFrame = (frameId?: number) => {
        if (this.regionSeriesFrameId !== frameId) {
            this.regionGroup.clear();
            this.regionSeriesFrameId = frameId;
        }
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
                isDisplayed: current?.isDisplayed ?? true,
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

    @action syncRegionSeriesFrame = (frame: RegionSeriesFrame, getStatistics?: (frameId: number, regionId: number, stokes: number) => RegionGroupStatistics | undefined) => {
        if (this.regionSeriesFrameId !== frame.frameId) {
            return;
        }

        const regionIds = new Set(frame.regionIds);
        for (const regionId of this.regionGroup.keys()) {
            if (!regionIds.has(regionId)) {
                this.regionGroup.delete(regionId);
            }
        }

        for (const regionId of frame.regionIds) {
            const current = this.regionGroup.get(regionId);
            const shouldResetStatistics = current?.frameId !== frame.frameId || current?.stokes !== frame.stokes;
            const statistics = getStatistics?.(frame.frameId, regionId, frame.stokes);
            this.regionGroup.set(regionId, {
                frameId: frame.frameId,
                regionId,
                isDisplayed: current?.isDisplayed ?? true,
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

    @action setDisplayed = (frameId: number, isDisplayed: boolean) => {
        const region = this.regionGroup.get(frameId);
        if (region) {
            this.regionGroup.set(frameId, {...region, isDisplayed});
        }
    };

    @action updateRegionStats = (stats: CARTA.RegionStatsData) => {
        const entryId = this.regionGroupType === RegionGroupType.REGION_SERIES ? stats.regionId : stats.fileId;
        const region = this.regionGroup.get(entryId);
        if (!region || (region.frameId ?? stats.fileId) !== stats.fileId || region.regionId === undefined || region.regionId !== stats.regionId || region.stokes !== stats.stokes) {
            return;
        }

        this.regionGroup.set(entryId, {
            ...region,
            regionSum: stats.statistics?.find(value => value.statsType === CARTA.StatsType.Sum)?.value ?? region.regionSum,
            regionFluxDensity: stats.statistics?.find(value => value.statsType === CARTA.StatsType.FluxDensity)?.value ?? region.regionFluxDensity,
            regionMean: stats.statistics?.find(value => value.statsType === CARTA.StatsType.Mean)?.value ?? region.regionMean
        });
    };

    @action clear = () => {
        this.regionGroup.clear();
    };
}

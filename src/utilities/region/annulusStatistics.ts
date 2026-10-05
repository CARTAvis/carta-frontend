import {CARTA} from "carta-protobuf";

/** The region's mean contrast relative to its selected background mean. */
export function getAnnulusSignalToNoise(data: CARTA.RegionStatsData, background: CARTA.RegionStatsData): number {
    const mean = data.statistics.find(statistic => statistic.statsType === CARTA.StatsType.Mean)?.value;
    const backgroundMean = background.statistics.find(statistic => statistic.statsType === CARTA.StatsType.Mean)?.value;
    if (
        data.fileId !== background.fileId ||
        data.channel !== background.channel ||
        data.stokes !== background.stokes ||
        mean == null ||
        backgroundMean == null ||
        !Number.isFinite(mean) ||
        !Number.isFinite(backgroundMean) ||
        backgroundMean === 0
    ) {
        return NaN;
    }
    const ratio = (mean - backgroundMean) / backgroundMean;
    return Number.isFinite(ratio) ? ratio : NaN;
}

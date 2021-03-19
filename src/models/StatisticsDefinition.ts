import {CARTA} from "carta-protobuf";

export const SUPPORTED_STATISTICS_TYPES = [
    CARTA.StatsType.Sum,
    CARTA.StatsType.FluxDensity,
    CARTA.StatsType.Mean,
    CARTA.StatsType.Sigma,
    CARTA.StatsType.Min,
    CARTA.StatsType.Max,
    CARTA.StatsType.Extrema,
    CARTA.StatsType.RMS,
    CARTA.StatsType.SumSq,
];

export const STATISTICS_TEXT = new Map<CARTA.StatsType, string>([
    [CARTA.StatsType.Sum, "Sum"],
    [CARTA.StatsType.FluxDensity, "FluxDensity"],
    [CARTA.StatsType.Mean, "Mean"],
    [CARTA.StatsType.Sigma, "StdDev"],
    [CARTA.StatsType.Min, "Min"],
    [CARTA.StatsType.Max, "Max"],
    [CARTA.StatsType.Extrema, "Extrema"],
    [CARTA.StatsType.RMS, "RMS"],
    [CARTA.StatsType.SumSq, "SumSq"]
]);

export const StatsTypeString = (statsType: CARTA.StatsType): string => {
    return STATISTICS_TEXT.get(statsType) ?? "Not Implemented";
};

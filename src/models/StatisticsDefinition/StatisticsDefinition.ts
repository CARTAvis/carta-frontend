import {CARTA} from "carta-protobuf";

export const NUM_BEAMS_STATS_TYPE = "NumBeams";
export const BEAM_AREA_STATS_TYPE = "BeamArea";
export const BEAM_PIXELS_STATS_TYPE = "BeamAreaPixels";
export type StatsDisplayType = CARTA.StatsType | typeof NUM_BEAMS_STATS_TYPE | typeof BEAM_AREA_STATS_TYPE | typeof BEAM_PIXELS_STATS_TYPE;

export const SUPPORTED_STATISTICS_TYPES = [
    CARTA.StatsType.Sum,
    CARTA.StatsType.FluxDensity,
    CARTA.StatsType.Mean,
    CARTA.StatsType.RMS,
    CARTA.StatsType.Sigma,
    CARTA.StatsType.SumSq,
    CARTA.StatsType.Min,
    CARTA.StatsType.Max,
    CARTA.StatsType.Extrema
];

export const STATISTICS_NAME_MAP = new Map<StatsDisplayType, string>([
    [CARTA.StatsType.NumPixels, "NumPixels"],
    [NUM_BEAMS_STATS_TYPE, "NumBeams"],
    [BEAM_AREA_STATS_TYPE, "BeamArea"],
    [BEAM_PIXELS_STATS_TYPE, "BeamAreaPixels"],
    [CARTA.StatsType.Sum, "Sum"],
    [CARTA.StatsType.FluxDensity, "FluxDensity"],
    [CARTA.StatsType.Mean, "Mean"],
    [CARTA.StatsType.Sigma, "StdDev"],
    [CARTA.StatsType.Min, "Min"],
    [CARTA.StatsType.Max, "Max"],
    [CARTA.StatsType.Extrema, "Extrema"],
    [CARTA.StatsType.RMS, "RMS"],
    [CARTA.StatsType.SumSq, "SumSq"],
    [CARTA.StatsType.Median, "Median"],
    [CARTA.StatsType.MedAbsDevMed, "MedAbsDevMed"],
    [CARTA.StatsType.Quartile, "Quartile"],
    [CARTA.StatsType.Q1, "Q1"],
    [CARTA.StatsType.Q3, "Q3"]
]);

export const DEFAULT_STATS_DISPLAY_TYPES = Array.from(STATISTICS_NAME_MAP.keys()).filter(
    type => ![CARTA.StatsType.Median, CARTA.StatsType.MedAbsDevMed, CARTA.StatsType.Quartile, CARTA.StatsType.Q1, CARTA.StatsType.Q3].includes(type as CARTA.StatsType)
);

export const StatsTypeString = (statsType: CARTA.StatsType): string => {
    return STATISTICS_NAME_MAP.get(statsType) ?? "Not Implemented";
};

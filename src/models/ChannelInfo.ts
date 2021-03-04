import {SpectralTypeSet} from "./SpectralDefinition";

export interface ChannelInfo {
    fromWCS: boolean;
    channelType: SpectralTypeSet;
    indexes: number[];
    values: number[];
    rawValues: number[];
    getChannelIndexWCS: (x: number) => number;
    getChannelIndexSimple: (x: number) => number;
}